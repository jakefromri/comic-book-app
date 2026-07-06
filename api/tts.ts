import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import OpenAI from 'openai'
import { requireUser, supabaseAdmin } from './_lib/auth.js'

export const config = { runtime: 'nodejs' }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VOICE = 'onyx'
const NARRATOR_INSTRUCTIONS =
  'Speak like an upbeat, energetic Saturday-morning anime TV show narrator hyping up the hero for kids. ' +
  'Fast-paced, excited, big dramatic emphasis — think Pokemon episode narrator. Male voice, unaccented American English.'

function narrationAudioPublicUrl(path: string): string {
  return supabaseAdmin.storage.from('narration-audio').getPublicUrl(path).data.publicUrl
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const userId = await requireUser(req.headers.authorization)
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const { page_id } = req.body as { page_id?: string }
  if (!page_id || typeof page_id !== 'string') {
    res.status(400).json({ error: 'page_id is required' })
    return
  }

  const { data: page, error: pageError } = await supabaseAdmin
    .from('pages')
    .select(
      'id, user_id, comic_book_id, narration_bar_text, enhanced_narration, narration_audio_url, narration_audio_text_hash',
    )
    .eq('id', page_id)
    .single()

  if (pageError || !page || page.user_id !== userId) {
    res.status(404).json({ error: 'page not found' })
    return
  }

  const text = page.narration_bar_text ?? page.enhanced_narration
  if (!text) {
    res.status(400).json({ error: 'this page has no narration yet' })
    return
  }

  const textHash = createHash('sha256').update(text).digest('hex')

  // Cached audio still matches the current narration text — skip the OpenAI call entirely.
  if (page.narration_audio_url && page.narration_audio_text_hash === textHash) {
    res.status(200).json({ audio_url: narrationAudioPublicUrl(page.narration_audio_url) })
    return
  }

  try {
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: VOICE,
      input: text,
      instructions: NARRATOR_INSTRUCTIONS,
      response_format: 'mp3',
    })
    const audioBuffer = Buffer.from(await speech.arrayBuffer())

    const audioPath = `${page.user_id}/${page.comic_book_id}/${page.id}/narration.mp3`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('narration-audio')
      .upload(audioPath, audioBuffer, { upsert: true, contentType: 'audio/mpeg' })
    if (uploadError) throw uploadError

    const { error: updateError } = await supabaseAdmin
      .from('pages')
      .update({ narration_audio_url: audioPath, narration_audio_text_hash: textHash })
      .eq('id', page.id)
    if (updateError) throw updateError

    res.status(200).json({ audio_url: narrationAudioPublicUrl(audioPath) })
  } catch (err) {
    console.error('tts error', err)
    res.status(500).json({ error: "couldn't generate narration audio — try again" })
  }
}
