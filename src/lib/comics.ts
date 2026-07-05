import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type ComicBook = Tables<'comic_books'>

export type ComicBookWithCover = ComicBook & { coverUrl: string | null }

export async function listComics(userId: string): Promise<ComicBookWithCover[]> {
  const { data: comics, error } = await supabase
    .from('comic_books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('comic_book_id, panel_url, page_order')
    .eq('user_id', userId)
    .not('panel_url', 'is', null)
    .order('page_order', { ascending: true })
  if (pagesError) throw pagesError

  const coverByComic = new Map<string, string>()
  for (const page of pages ?? []) {
    if (page.panel_url && !coverByComic.has(page.comic_book_id)) {
      coverByComic.set(page.comic_book_id, page.panel_url)
    }
  }

  return (comics ?? []).map((comic) => ({
    ...comic,
    coverUrl: coverByComic.get(comic.id) ?? null,
  }))
}

export async function createComic(userId: string, title: string): Promise<ComicBook> {
  const { data, error } = await supabase
    .from('comic_books')
    .insert({ user_id: userId, title: title.trim() || 'Untitled Comic' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameComic(comicId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('comic_books')
    .update({ title: title.trim() || 'Untitled Comic' })
    .eq('id', comicId)
  if (error) throw error
}

export async function deleteComic(comicId: string): Promise<void> {
  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('drawing_url, panel_url')
    .eq('comic_book_id', comicId)
  if (pagesError) throw pagesError

  const drawingPaths = (pages ?? [])
    .map((p) => p.drawing_url)
    .filter((p): p is string => !!p)
  const panelPaths = (pages ?? [])
    .map((p) => p.panel_url)
    .filter((p): p is string => !!p)

  if (drawingPaths.length) {
    await supabase.storage.from('drawings').remove(drawingPaths)
  }
  if (panelPaths.length) {
    await supabase.storage.from('panels').remove(panelPaths)
  }

  // Row delete cascades to pages/shares via FK ON DELETE CASCADE.
  const { error } = await supabase.from('comic_books').delete().eq('id', comicId)
  if (error) throw error
}
