import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { detectRecorderMimeType } from '@/lib/voice'

const BAR_COUNT = 12
const IDLE_LEVELS = Array(BAR_COUNT).fill(4)

export function VoiceRecorder({
  disabled,
  onRecorded,
  onPermissionDenied,
}: {
  disabled?: boolean
  onRecorded: (blob: Blob, mimeType: string) => void
  onPermissionDenied: () => void
}) {
  const [recording, setRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  function stopVisualizer() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    setLevels(IDLE_LEVELS)
  }

  function startVisualizer(stream: MediaStream) {
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      setLevels(
        Array.from({ length: BAR_COUNT }, (_, i) => 4 + ((data[i * 2] ?? 0) / 255) * 28)
      )
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function startRecording() {
    if (recording || disabled) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onPermissionDenied()
      return
    }
    streamRef.current = stream

    const mimeType = detectRecorderMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const finalMimeType = mimeType || recorder.mimeType
      const blob = new Blob(chunksRef.current, { type: finalMimeType })
      cleanupStream()
      stopVisualizer()
      onRecorded(blob, finalMimeType)
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
    startVisualizer(stream)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  // Release anywhere (not just over the button) still stops the recording —
  // a kid's finger sliding off mid-hold shouldn't leave it stuck recording.
  useEffect(() => {
    if (!recording) return
    window.addEventListener('pointerup', stopRecording)
    return () => window.removeEventListener('pointerup', stopRecording)
  }, [recording])

  useEffect(() => {
    return () => {
      cleanupStream()
      stopVisualizer()
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={() => void startRecording()}
        className={`flex h-24 w-24 items-center justify-center rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 ${
          recording ? 'bg-accent-red text-white' : 'bg-accent-orange text-white'
        }`}
      >
        <Mic className="h-10 w-10" />
      </button>
      <div className="flex h-10 items-end gap-1" aria-hidden="true">
        {levels.map((height, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-accent-orange transition-[height] duration-75"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
      <p className="text-sm font-bold text-text-muted">
        {recording ? 'listening... let go when done!' : 'hold to record'}
      </p>
    </div>
  )
}
