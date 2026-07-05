import { authHeader } from '@/lib/voice'

const GENERATION_TIMEOUT_MS = 30_000

export class GenerationTimeoutError extends Error {}

/** Calls /api/generate for the given page and returns the new panel_url (storage path). */
export async function generatePanel(pageId: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ page_id: pageId }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? 'generation failed')
    }
    const data = (await res.json()) as { panel_url: string }
    return data.panel_url
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GenerationTimeoutError('generation is taking longer than expected')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
