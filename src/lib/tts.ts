import { authHeader } from '@/lib/voice'

/**
 * Fetches (generating and caching server-side if needed) the narration audio
 * URL for a page. Returns null if there's no session — callers should fall
 * back to browser speechSynthesis rather than treating this as a hard error
 * (e.g. an anonymous share viewer opening a page before its owner ever
 * generated audio for it).
 */
export async function fetchNarrationAudioUrl(pageId: string): Promise<string | null> {
  const headers = await authHeader()
  if (!('Authorization' in headers)) return null

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ page_id: pageId }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { audio_url: string }
  return data.audio_url
}
