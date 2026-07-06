import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/auth.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const token = req.query.token
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required' })
    return
  }

  const { data: share, error: shareError } = await supabaseAdmin
    .from('shares')
    .select('comic_book_id')
    .eq('share_token', token)
    .maybeSingle()

  if (shareError || !share) {
    res.status(404).json({ error: 'share link not found' })
    return
  }

  const { data: comic, error: comicError } = await supabaseAdmin
    .from('comic_books')
    .select('title')
    .eq('id', share.comic_book_id)
    .single()

  if (comicError || !comic) {
    res.status(404).json({ error: 'share link not found' })
    return
  }

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('pages')
    .select(
      'id, page_order, panel_url, enhanced_narration, narration_bar_text, speech_bubbles, narration_audio_url',
    )
    .eq('comic_book_id', share.comic_book_id)
    .order('page_order', { ascending: true })

  if (pagesError) {
    res.status(500).json({ error: "couldn't load that comic — try again" })
    return
  }

  res.status(200).json({
    comic: {
      title: comic.title,
      pages: (pages ?? []).map((page) => ({
        id: page.id,
        page_order: page.page_order,
        panel_url: page.panel_url
          ? supabaseAdmin.storage.from('panels').getPublicUrl(page.panel_url).data.publicUrl
          : null,
        enhanced_narration: page.enhanced_narration,
        narration_bar_text: page.narration_bar_text,
        speech_bubbles: page.speech_bubbles,
        narration_audio_url: page.narration_audio_url
          ? supabaseAdmin.storage.from('narration-audio').getPublicUrl(page.narration_audio_url).data.publicUrl
          : null,
      })),
    },
  })
}
