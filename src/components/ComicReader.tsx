import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react'
import type { SpeechBubble } from '@/lib/pages'
import { PlaybackButton } from '@/components/PlaybackButton'
import { Button } from '@/components/ui/button'

const SWIPE_THRESHOLD_PX = 50

export type ReaderPage = {
  id: string
  panelUrl: string | null
  displayText: string | null
  speechBubbles: SpeechBubble[]
}

function ReaderBubble({ bubble }: { bubble: SpeechBubble }) {
  return (
    <div
      style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, width: `${bubble.width}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <div
        className={`rounded-2xl border-2 border-text-primary bg-white px-3 py-2 text-center text-sm font-bold text-text-primary shadow-md ${
          bubble.tail === 'left' ? 'rounded-bl-sm' : bubble.tail === 'right' ? 'rounded-br-sm' : ''
        }`}
      >
        {bubble.text}
      </div>
    </div>
  )
}

export function ComicReader({
  title,
  pages,
  onClose,
}: {
  title: string
  pages: ReaderPage[]
  onClose?: () => void
}) {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)

  const page = pages[index]
  const canGoPrev = index > 0
  const canGoNext = index < pages.length - 1

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1))
  }

  function goNext() {
    setIndex((i) => Math.min(pages.length - 1, i + 1))
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    startX.current = e.clientX
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return
    const delta = e.clientX - startX.current
    startX.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    if (delta < 0) goNext()
    else goPrev()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-2 p-4">
        <h2 className="truncate text-lg font-bold">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white/70">
            {pages.length ? `${index + 1} / ${pages.length}` : '0 / 0'}
          </span>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} title="close reader">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      {!page ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-white/70">this comic has no pages yet</p>
        </div>
      ) : (
        <div
          className="relative flex flex-1 touch-pan-y select-none items-center justify-center overflow-hidden p-4"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="relative aspect-[3/4] max-h-full w-full max-w-sm overflow-hidden rounded-2xl bg-neutral-900">
            {page.panelUrl ? (
              <img
                src={page.panelUrl}
                alt={`page ${index + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/50">
                <ImageIcon className="h-12 w-12" />
                <p className="text-sm font-bold">this page isn't ready yet</p>
              </div>
            )}

            {page.speechBubbles.map((bubble) => (
              <ReaderBubble key={bubble.id} bubble={bubble} />
            ))}

            {page.displayText && (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2">
                <p className="text-center text-sm font-bold text-white">{page.displayText}</p>
              </div>
            )}
          </div>

          {canGoPrev && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60"
              onClick={goPrev}
              title="previous page"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {canGoNext && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60"
              onClick={goNext}
              title="next page"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>
      )}

      {page && (
        <footer className="flex items-center justify-center p-4">
          <PlaybackButton text={page.displayText} />
        </footer>
      )}
    </div>
  )
}
