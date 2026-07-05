import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { requireUser, supabaseAdmin } from './_lib/auth'

export const config = { runtime: 'nodejs' }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** Maps the recorder's MIME type to a filename Whisper will accept. */
function filenameForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'audio.mp4'
  if (mimeType.includes('webm')) return 'audio.webm'
  return 'audio.wav'
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

  const { audio_path, mime_type } = req.body as { audio_path?: string; mime_type?: string }
  if (!audio_path || typeof audio_path !== 'string') {
    res.status(400).json({ error: 'audio_path is required' })
    return
  }
  // Storage paths are namespaced by user id — reject anything outside the caller's own folder.
  if (!audio_path.startsWith(`${userId}/`)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  try {
    const { data: audioBlob, error: downloadError } = await supabaseAdmin.storage
      .from('temp-audio')
      .download(audio_path)
    if (downloadError || !audioBlob) {
      res.status(500).json({ error: 'could not read audio file' })
      return
    }

    const buffer = Buffer.from(await audioBlob.arrayBuffer())
    const file = await toFile(buffer, filenameForMimeType(mime_type ?? 'audio/webm'))

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    })

    res.status(200).json({ raw_transcription: transcription.text })
  } catch (err) {
    console.error('transcribe error', err)
    res.status(500).json({ error: 'transcription failed' })
  } finally {
    // Always clean up — temp-audio is scratch space, never a permanent record.
    await supabaseAdmin.storage.from('temp-audio').remove([audio_path])
  }
}
