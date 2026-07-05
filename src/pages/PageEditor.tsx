import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Mic as MicIcon } from 'lucide-react'
import { useAuthContext } from '@/hooks/useAuthContext'
import { supabase } from '@/lib/supabase'
import { getComic, getPage, uploadDrawing, updatePageNarration, type Page } from '@/lib/pages'
import type { ComicBook } from '@/lib/comics'
import { uploadTempAudio, transcribeAudio, enhanceNarration } from '@/lib/voice'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PhotoCapture } from '@/components/PhotoCapture'
import { VoiceRecorder } from '@/components/VoiceRecorder'

type VoiceState = 'idle' | 'transcribing' | 'enhancing' | 'review' | 'saving'

export function PageEditor() {
  const { id: comicId, pageId } = useParams<{ id: string; pageId: string }>()
  const { user } = useAuthContext()
  const navigate = useNavigate()

  const [comic, setComic] = useState<ComicBook | null>(null)
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawingPreviewUrl, setDrawingPreviewUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [rawTranscription, setRawTranscription] = useState<string | null>(null)
  const [enhancedNarration, setEnhancedNarration] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const refreshDrawingPreview = useCallback((path: string | null) => {
    if (!path) {
      setDrawingPreviewUrl(null)
      return
    }
    supabase.storage
      .from('drawings')
      .createSignedUrl(path, 3600)
      .then(({ data }) => setDrawingPreviewUrl(data?.signedUrl ?? null))
      .catch(() => setDrawingPreviewUrl(null))
  }, [])

  useEffect(() => {
    if (!comicId || !pageId) return
    let cancelled = false
    Promise.all([getComic(comicId), getPage(pageId)])
      .then(([comicData, pageData]) => {
        if (cancelled) return
        setComic(comicData)
        setPage(pageData)
        refreshDrawingPreview(pageData.drawing_url)
      })
      .catch(() => {
        if (!cancelled) setPage(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [comicId, pageId, refreshDrawingPreview])

  async function handleCapture(file: File) {
    if (!user || !page) return
    setPhotoUploading(true)
    setError(null)
    try {
      const updated = await uploadDrawing(user.id, page, file)
      setPage(updated)
      refreshDrawingPreview(updated.drawing_url)
    } catch {
      setError("couldn't save that photo — try again")
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleRecorded(blob: Blob, mimeType: string) {
    if (!user) return
    setVoiceError(null)
    setVoiceState('transcribing')
    try {
      const audioPath = await uploadTempAudio(user.id, blob, mimeType)
      const raw = await transcribeAudio(audioPath, mimeType)
      setRawTranscription(raw)
      setVoiceState('enhancing')
      const enhanced = await enhanceNarration(raw)
      setEnhancedNarration(enhanced)
      setVoiceState('review')
    } catch {
      setVoiceError("couldn't hear that one — let's try again")
      setVoiceState('idle')
    }
  }

  function handleReRecord() {
    setRawTranscription(null)
    setEnhancedNarration(null)
    setVoiceError(null)
    setVoiceState('idle')
  }

  async function handleConfirmNarration() {
    if (!page || !rawTranscription || !enhancedNarration) return
    setVoiceState('saving')
    setVoiceError(null)
    try {
      const updated = await updatePageNarration(page.id, {
        raw_transcription: rawTranscription,
        enhanced_narration: enhancedNarration,
      })
      setPage(updated)
      setVoiceState('idle')
    } catch {
      setVoiceError("couldn't save that — try again")
      setVoiceState('review')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-muted">loading...</p>
      </div>
    )
  }

  if (!comic || !page) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg font-bold">page not found</p>
        <Button onClick={() => navigate('/')}>back to library</Button>
      </div>
    )
  }

  const hasDrawing = !!page.drawing_url
  const hasSavedNarration = !!page.enhanced_narration && voiceState === 'idle'

  return (
    <div className="mx-auto min-h-svh max-w-xl p-6">
      <header className="mb-6 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => navigate(`/comics/${comic.id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-2xl font-bold">{comic.title}</h1>
      </header>

      {error && <p className="mb-4 text-sm text-accent-red">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">1. your drawing</h2>
        <PhotoCapture
          previewUrl={drawingPreviewUrl}
          disabled={photoUploading}
          onCapture={(file) => void handleCapture(file)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">2. tell the story</h2>

        {!hasDrawing && (
          <Card className="p-6 text-center text-text-muted">take a photo first!</Card>
        )}

        {hasDrawing && voiceError && (
          <p className="mb-3 text-sm text-accent-red">{voiceError}</p>
        )}

        {hasDrawing && voiceState === 'idle' && !hasSavedNarration && (
          <VoiceRecorder
            onRecorded={(blob, mimeType) => void handleRecorded(blob, mimeType)}
            onPermissionDenied={() =>
              setVoiceError("we need microphone access to hear your story — check your browser settings")
            }
          />
        )}

        {(voiceState === 'transcribing' || voiceState === 'enhancing') && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <MicIcon className="h-10 w-10 animate-pulse text-accent-orange" />
            <p className="font-bold text-text-muted">
              {voiceState === 'transcribing' ? 'listening to your story...' : 'making it exciting...'}
            </p>
          </Card>
        )}

        {(voiceState === 'review' || voiceState === 'saving') && rawTranscription && enhancedNarration && (
          <Card className="flex flex-col gap-4 p-4">
            <div>
              <p className="text-xs font-bold uppercase text-text-muted">what you said</p>
              <p>{rawTranscription}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-text-muted">comic-book version</p>
              <p className="font-bold">{enhancedNarration}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={voiceState === 'saving'}
                onClick={handleReRecord}
              >
                re-record
              </Button>
              <Button
                className="flex-1"
                disabled={voiceState === 'saving'}
                onClick={() => void handleConfirmNarration()}
              >
                <Check className="h-5 w-5" />
                looks good!
              </Button>
            </div>
          </Card>
        )}

        {hasSavedNarration && (
          <Card className="flex flex-col gap-3 p-4">
            <p className="font-bold">{page.enhanced_narration}</p>
            <Button variant="outline" onClick={handleReRecord}>
              re-record
            </Button>
          </Card>
        )}
      </section>
    </div>
  )
}
