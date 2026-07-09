import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fal } from '@fal-ai/client'
import { requireUser, supabaseAdmin } from './_lib/auth.js'

export const config = { runtime: 'nodejs', maxDuration: 60 }

fal.config({ credentials: process.env.FAL_API_KEY })

const STYLE_PREFIX =
  'Redraw this hand-drawn scene as a single Dragon Ball Z anime style comic book panel: ' +
  'vibrant full-color illustration, bold linework, dynamic action, speed lines, energy auras, ' +
  'dramatic lighting, manga shading, high quality, detailed expressive faces, cinematic composition.'

const CONSTRAINTS =
  'Output exactly one panel — no panel borders, no panel-within-panel grid, no comic page layout, ' +
  'no speech bubbles, no captions, no dialogue text, no watermark, no signature. Always render in ' +
  'full color — never black and white, never grayscale, never pencil or sketch shading.'

const DRAWING_INSTRUCTION =
  "Image 1 is a child's rough drawing — use it only for composition, pose, and scene layout. " +
  'Do not copy its coloring or line quality.'

const MAX_CHARACTERS_PER_SCENE = 4

type SceneCharacter = { name: string; description: string; photo_url: string | null }

function assemblePrompt(
  narration: string,
  characters: SceneCharacter[],
  photoUrlByCharacterName: Map<string, string>,
): string {
  let nextImageIndex = 2
  const referenceLines: string[] = []
  const textOnlyLines: string[] = []

  for (const c of characters) {
    const photoUrl = c.photo_url ? photoUrlByCharacterName.get(c.name) : undefined
    if (photoUrl) {
      referenceLines.push(
        `Image ${nextImageIndex} is a reference photo of ${c.name} — match their face, hair, and ` +
          `clothing design only. Do not copy their pose, framing, or expression from this photo; ` +
          `their pose and action come from the scene drawing and narration.`,
      )
      nextImageIndex += 1
    } else {
      textOnlyLines.push(`${c.name}: ${c.description}`)
    }
  }

  return [
    STYLE_PREFIX,
    CONSTRAINTS,
    DRAWING_INSTRUCTION,
    referenceLines.join(' '),
    textOnlyLines.length ? `Other characters in the scene — ${textOnlyLines.join('. ')}.` : '',
    `Scene: ${narration}.`,
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
    let characters: SceneCharacter[] = []
    const characterIds = page.characters_in_scene.slice(0, MAX_CHARACTERS_PER_SCENE)
    if (characterIds.length) {
      const { data: chars, error: charsError } = await supabaseAdmin
        .from('characters')
        .select('name, description, photo_url')
        .in('id', characterIds)
      if (charsError) throw charsError
      characters = chars ?? []
    }

    const { data: drawingBlob, error: downloadError } = await supabaseAdmin.storage
      .from('drawings')
      .download(page.drawing_url)
    if (downloadError || !drawingBlob) throw new Error('could not load drawing')

    // fal.ai's models need fetchable URLs, not our private buckets' signed
    // URLs (which can expire before the generation queue drains) — hand fal
    // its own storage instead of dealing with signed-URL expiry.
    const drawingUrl = await fal.storage.upload(drawingBlob)

    const photoUrlByCharacterName = new Map<string, string>()
    for (const c of characters) {
      if (!c.photo_url) continue
      const { data: photoBlob, error: photoError } = await supabaseAdmin.storage
        .from('characters')
        .download(c.photo_url)
      if (photoError || !photoBlob) continue
      photoUrlByCharacterName.set(c.name, await fal.storage.upload(photoBlob))
    }

    const prompt = assemblePrompt(page.enhanced_narration, characters, photoUrlByCharacterName)
    const imageUrls = [drawingUrl, ...characters.map((c) => photoUrlByCharacterName.get(c.name)).filter(Boolean)] as string[]

    const result = await fal.subscribe('fal-ai/flux-pro/kontext/multi', {
      input: {
        image_urls: imageUrls,
        prompt,
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

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('pages')
      .update({ panel_url: panelPath })
      .eq('id', page.id)
      .select('panel_url, updated_at')
      .single()
    if (updateError) throw updateError

    res.status(200).json({ panel_url: updated.panel_url, updated_at: updated.updated_at })
  } catch (err) {
    console.error('generate error', err)
    res.status(500).json({ error: "couldn't generate that panel — try again" })
  }
}
