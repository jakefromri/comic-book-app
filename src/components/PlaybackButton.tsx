import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchNarrationAudioUrl } from '@/lib/tts'

export function PlaybackButton({
  pageId,
  text,
  cachedAudioUrl = null,
}: {
  pageId: string
  text: string | null | undefined
  cachedAudioUrl?: string | null
}) {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // stop playback if the component unmounts mid-speech (e.g. navigating away)
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      audioRef.current?.pause()
    }
  }, [])

  if (!text) return null

  function stop() {
    window.speechSynthesis.cancel()
    audioRef.current?.pause()
    audioRef.current = null
    setSpeaking(false)
  }

  function speakWithBrowserVoice() {
    const utterance = new SpeechSynthesisUtterance(text ?? '')
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  async function play() {
    setSpeaking(true)

    // A cached URL (e.g. from the share viewer's already-generated audio) skips
    // the API round trip entirely. Otherwise try the narrator TTS endpoint —
    // it no-ops server-side back to null if there's no session to authenticate with.
    const url = cachedAudioUrl ?? (await fetchNarrationAudioUrl(pageId).catch(() => null))
    if (url) {
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setSpeaking(false)
      audio.onerror = () => setSpeaking(false)
      try {
        await audio.play()
        return
      } catch {
        // fall through to browser voice below
      }
    }

    speakWithBrowserVoice()
  }

  function handleToggle() {
    if (speaking) {
      stop()
      return
    }
    // only one utterance/clip should ever play across the whole app
    stop()
    void play()
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleToggle}
      title={speaking ? 'stop' : 'play narration'}
    >
      {speaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </Button>
  )
}
