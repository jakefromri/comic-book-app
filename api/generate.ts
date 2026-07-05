import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fal } from '@fal-ai/client'
import { requireUser, supabaseAdmin } from './_lib/auth'

export const config = { runtime: 'nodejs', maxDuration: 60 }

fal.config({ credentials: process.env.FAL_API_KEY })

const STYLE_PREFIX =
  'Dragon Ball Z anime style comic book panel, vibrant colors, bold linework, dynamic action, ' +
  'speed lines, energy auras, dramatic lighting, manga shading.'

const MAX_CHARACTERS_PER_SCENE = 4

function assemblePrompt(narration: string, characters: { name: string; description: string }[]): string {
  const characterBlock = characters.length
    ? characters.map((c) => `${c.name}: ${c.description}`).join('. ') + '.'
    : ''
  return [
    STYLE_PREFIX,
    characterBlock,
    `Scene: ${narration}.`,
    'High quality, detailed, expressive faces, cinematic composition.',
  ]
    .filter(Boolean)
    .join('\n')
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
    .select('id, user_id, comic_book_id, drawing_url, enhanced_narration, characters_in_scene')
    .eq('id', page_id)
    .single()

  if (pageError || !page || page.user_id !== userId) {
    res.status(404).json({ error: 'page not found' })
    return
  }
  if (!page.drawing_url || !page.enhanced_narration) {
    res.status(400).json({ error: 'this page needs a photo and narration before generating a panel' })
    return
  }

  try {
    let characters: { name: string; description: string }[] = []
    const characterIds = page.characters_in_scene.slice(0, MAX_CHARACTERS_PER_SCENE)
    if (characterIds.length) {
      const { data: chars, error: charsError } = await supabaseAdmin
        .from('characters')
        .select('name, description')
        .in('id', characterIds)
      if (charsError) throw charsError
      characters = chars ?? []
    }

    const { data: drawingBlob, error: downloadError } = await supabaseAdmin.storage
      .from('drawings')
      .download(page.drawing_url)
    if (downloadError || !drawingBlob) throw new Error('could not load drawing')

    // fal.ai's img2img model needs a fetchable URL, not our private bucket's
    // signed URL (which can expire before the generation queue drains) — hand
    // it fal's own storage instead of dealing with signed-URL expiry.
    const drawingUrl = await fal.storage.upload(drawingBlob)

    const prompt = assemblePrompt(page.enhanced_narration, characters)

    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: drawingUrl,
        prompt,
        strength: 0.65,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
    })

    const imageUrl = result.data?.images?.[0]?.url
    if (!imageUrl) throw new Error('no image returned')

    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) throw new Error('could not download generated panel')
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    const panelPath = `${page.user_id}/${page.comic_book_id}/${page.id}/panel.jpg`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('panels')
      .upload(panelPath, imageBuffer, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) throw uploadError

    const { error: updateError } = await supabaseAdmin
      .from('pages')
      .update({ panel_url: panelPath })
      .eq('id', page.id)
    if (updateError) throw updateError

    res.status(200).json({ panel_url: panelPath })
  } catch (err) {
    console.error('generate error', err)
    res.status(500).json({ error: "couldn't generate that panel — try again" })
  }
}
