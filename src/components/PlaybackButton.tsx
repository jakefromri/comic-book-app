import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PlaybackButton({ text }: { text: string | null | undefined }) {
  const [speaking, setSpeaking] = useState(false)

  // stop playback if the component unmounts mid-speech (e.g. navigating away)
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  if (!text) return null

  function handleToggle() {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    // cancel first — only one utterance should ever play across the whole app
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text ?? '')
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
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
