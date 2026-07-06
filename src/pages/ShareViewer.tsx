import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { fetchSharedComic, type SharedComic } from '@/lib/shares'
import { ComicReader, type ReaderPage } from '@/components/ComicReader'
import { Button } from '@/components/ui/button'

type State = 'loading' | 'ready' | 'not_found' | 'error'

export function ShareViewer() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [state, setState] = useState<State>('loading')
  const [comic, setComic] = useState<SharedComic | null>(null)

  useEffect(() => {
    if (!shareToken) return
    let cancelled = false
    fetchSharedComic(shareToken)
      .then((data) => {
        if (cancelled) return
        setComic(data)
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setState(err instanceof Error && err.message === 'not_found' ? 'not_found' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [shareToken])

  if (state === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-black">
        <p className="text-white/70">loading comic...</p>
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
        <BookOpen className="h-16 w-16 text-accent-orange" />
        <div>
          <p className="text-lg font-bold">this link doesn't lead anywhere</p>
          <p className="text-white/70">the comic might have been removed, or the link is mistyped</p>
        </div>
        <Button size="lg" asChild>
          <Link to="/">go home</Link>
        </Button>
      </div>
    )
  }

  if (state === 'error' || !comic) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
        <p className="text-lg font-bold">couldn't load this comic</p>
        <p className="text-white/70">try refreshing the page</p>
        <Button size="lg" asChild>
          <Link to="/">go home</Link>
        </Button>
      </div>
    )
  }

  const pages: ReaderPage[] = comic.pages.map((page) => ({
    id: page.id,
    panelUrl: page.panel_url,
    displayText: page.narration_bar_text ?? page.enhanced_narration,
    speechBubbles: page.speech_bubbles,
    narrationAudioUrl: page.narration_audio_url,
  }))

  return <ComicReader title={comic.title} pages={pages} />
}
