import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { SpeechBubble } from '@/lib/pages'

export type Share = Tables<'shares'>

export type SharedPage = {
  id: string
  page_order: number
  panel_url: string | null
  enhanced_narration: string | null
  narration_bar_text: string | null
  speech_bubbles: SpeechBubble[]
  narration_audio_url: string | null
}

export type SharedComic = {
  title: string
  pages: SharedPage[]
}

export async function getShareForComic(comicId: string): Promise<Share | null> {
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('comic_book_id', comicId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createShare(userId: string, comicId: string): Promise<Share> {
  const { data, error } = await supabase
    .from('shares')
    .insert({ user_id: userId, comic_book_id: comicId })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Returns the existing share for a comic, creating one if none exists yet — links are permanent (per scope.md). */
export async function getOrCreateShare(userId: string, comicId: string): Promise<Share> {
  const existing = await getShareForComic(comicId)
  if (existing) return existing
  return createShare(userId, comicId)
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/view/${token}`
}

export async function fetchSharedComic(token: string): Promise<SharedComic> {
  const res = await fetch(`/api/share/${token}`)
  if (res.status === 404) {
    throw new Error('not_found')
  }
  if (!res.ok) {
    throw new Error('failed to load shared comic')
  }
  const data = (await res.json()) as { comic: SharedComic }
  return data.comic
}
