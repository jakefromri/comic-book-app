import { supabase } from '@/lib/supabase'
import type { ComicBook } from '@/lib/comics'
import type { Tables } from '@/types/database'

export type Page = Tables<'pages'>

export async function getPage(pageId: string): Promise<Page> {
  const { data, error } = await supabase.from('pages').select('*').eq('id', pageId).single()
  if (error) throw error
  return data
}

export async function getComic(comicId: string): Promise<ComicBook> {
  const { data, error } = await supabase
    .from('comic_books')
    .select('*')
    .eq('id', comicId)
    .single()
  if (error) throw error
  return data
}

export async function listPages(comicId: string): Promise<Page[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('comic_book_id', comicId)
    .order('page_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addPage(userId: string, comicId: string, nextOrder: number): Promise<Page> {
  const { data, error } = await supabase
    .from('pages')
    .insert({ user_id: userId, comic_book_id: comicId, page_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePage(page: Page): Promise<void> {
  if (page.drawing_url) {
    await supabase.storage.from('drawings').remove([page.drawing_url])
  }
  if (page.panel_url) {
    await supabase.storage.from('panels').remove([page.panel_url])
  }
  const { error } = await supabase.from('pages').delete().eq('id', page.id)
  if (error) throw error
}

/**
 * Uploads a new drawing photo for a page, replacing any existing one.
 * Clears panel_url since a changed drawing invalidates the previously generated panel.
 */
export async function uploadDrawing(userId: string, page: Page, file: File | Blob): Promise<Page> {
  const path = `${userId}/${page.comic_book_id}/${page.id}/drawing.jpg`
  const { error: uploadError } = await supabase.storage
    .from('drawings')
    .upload(path, file, { upsert: true, contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  if (page.panel_url) {
    await supabase.storage.from('panels').remove([page.panel_url])
  }

  const { data, error } = await supabase
    .from('pages')
    .update({ drawing_url: path, panel_url: null })
    .eq('id', page.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePageNarration(
  pageId: string,
  narration: { raw_transcription: string; enhanced_narration: string }
): Promise<Page> {
  const { data, error } = await supabase
    .from('pages')
    .update(narration)
    .eq('id', pageId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Persists page_order = array index for every page in the given order. */
export async function reorderPages(orderedPages: Page[]): Promise<void> {
  const results = await Promise.all(
    orderedPages.map((page, index) =>
      supabase.from('pages').update({ page_order: index }).eq('id', page.id)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
