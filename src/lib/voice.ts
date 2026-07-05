import { supabase } from '@/lib/supabase'

/**
 * iOS Safari's MediaRecorder can't produce webm — it only supports mp4 (AAC).
 * Android Chrome is the opposite. Detect at runtime rather than hardcoding one.
 */
export function detectRecorderMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  return 'wav'
}

export async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Uploads a voice recording directly to Supabase Storage (bypassing Vercel's
 * 4.5MB serverless body limit) and returns the storage path for /api/transcribe.
 */
export async function uploadTempAudio(
  userId: string,
  blob: Blob,
  mimeType: string
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`
  const { error } = await supabase.storage
    .from('temp-audio')
    .upload(path, blob, { contentType: mimeType || 'application/octet-stream' })
  if (error) throw error
  return path
}

export async function transcribeAudio(audioPath: string, mimeType: string): Promise<string> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ audio_path: audioPath, mime_type: mimeType }),
  })
  if (!res.ok) throw new Error('transcription failed')
  const data = (await res.json()) as { raw_transcription: string }
  return data.raw_transcription
}

export async function enhanceNarration(rawTranscription: string): Promise<string> {
  const res = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ raw_transcription: rawTranscription }),
  })
  if (!res.ok) throw new Error('enhancement failed')
  const data = (await res.json()) as { enhanced_narration: string }
  return data.enhanced_narration
}
