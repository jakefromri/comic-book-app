import { useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { MessageSquarePlus, RefreshCw, Sparkles } from 'lucide-react'
import {
  getPanelPublicUrl,
  getSpeechBubbles,
  updatePageSpeechBubbles,
  updatePageNarrationBarText,
  type Page,
  type SpeechBubble,
} from '@/lib/pages'
import { Button } from '@/components/ui/button'
import { PlaybackButton } from '@/components/PlaybackButton'
import { SpeechBubbleItem } from '@/components/SpeechBubbleItem'

const SAVE_DEBOUNCE_MS = 500
const DEFAULT_BUBBLE_WIDTH = 32

export function PanelComposer({
  page,
  generating,
  onRegenerate,
  onUpdate,
}: {
  page: Page
  generating: boolean
  onRegenerate: () => void
  onUpdate: (page: Page) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bubblesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const narrationSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [bubbles, setBubbles] = useState<SpeechBubble[]>(() => getSpeechBubbles(page))
  const [narrationText, setNarrationText] = useState(
    page.narration_bar_text ?? page.enhanced_narration ?? ''
  )
  const [addingBubble, setAddingBubble] = useState(false)
  const [editingBubbleId, setEditingBubbleId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  function queueBubblesSave(next: SpeechBubble[]) {
    setSaveStatus('saving')
    if (bubblesSaveTimer.current) clearTimeout(bubblesSaveTimer.current)
    bubblesSaveTimer.current = setTimeout(() => {
      updatePageSpeechBubbles(page.id, next)
        .then((updated) => {
          onUpdate(updated)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
        })
        .catch(() => setSaveStatus('idle'))
    }, SAVE_DEBOUNCE_MS)
  }

  function queueNarrationSave(text: string) {
    setSaveStatus('saving')
    if (narrationSaveTimer.current) clearTimeout(narrationSaveTimer.current)
    narrationSaveTimer.current = setTimeout(() => {
      updatePageNarrationBarText(page.id, text)
        .then((updated) => {
          onUpdate(updated)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
        })
        .catch(() => setSaveStatus('idle'))
    }, SAVE_DEBOUNCE_MS)
  }

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!addingBubble || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    const newBubble: SpeechBubble = {
      id: crypto.randomUUID(),
      text: '',
      x: Math.min(95, Math.max(5, xPct)),
      y: Math.min(95, Math.max(5, yPct)),
      width: DEFAULT_BUBBLE_WIDTH,
      tail: 'none',
    }
    const next = [...bubbles, newBubble]
    setBubbles(next)
    queueBubblesSave(next)
    setAddingBubble(false)
    setEditingBubbleId(newBubble.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event
    if (!containerRef.current || (delta.x === 0 && delta.y === 0)) return
    const rect = containerRef.current.getBoundingClientRect()
    const dxPct = (delta.x / rect.width) * 100
    const dyPct = (delta.y / rect.height) * 100
    const next = bubbles.map((b) =>
      b.id === active.id
        ? { ...b, x: Math.min(98, Math.max(2, b.x + dxPct)), y: Math.min(98, Math.max(2, b.y + dyPct)) }
        : b
    )
    setBubbles(next)
    queueBubblesSave(next)
  }

  function handleBubbleTextChange(id: string, text: string) {
    const next = bubbles.map((b) => (b.id === id ? { ...b, text } : b))
    setBubbles(next)
    queueBubblesSave(next)
  }

  function handleBubbleTailChange(id: string, tail: SpeechBubble['tail']) {
    const next = bubbles.map((b) => (b.id === id ? { ...b, tail } : b))
    setBubbles(next)
    queueBubblesSave(next)
  }

  function handleBubbleDelete(id: string) {
    const next = bubbles.filter((b) => b.id !== id)
    setBubbles(next)
    queueBubblesSave(next)
    if (editingBubbleId === id) setEditingBubbleId(null)
  }

  const panelUrl = getPanelPublicUrl(page.panel_url)

  return (
    <div className="flex flex-col items-center gap-3 lg:grid lg:grid-cols-[60%_40%] lg:items-start lg:gap-6">
      <div className="flex w-full flex-col items-center gap-3">
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className={`relative w-full max-w-sm select-none overflow-hidden rounded-2xl border-2 border-border lg:max-w-none ${
            addingBubble ? 'cursor-crosshair' : ''
          }`}
        >
          <img src={panelUrl ?? undefined} alt="your generated comic panel" className="w-full object-cover" />

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {bubbles.map((bubble) => (
              <SpeechBubbleItem
                key={bubble.id}
                bubble={bubble}
                editing={editingBubbleId === bubble.id}
                onStartEdit={() => setEditingBubbleId(bubble.id)}
                onStopEdit={() => setEditingBubbleId(null)}
                onTextChange={(text) => handleBubbleTextChange(bubble.id, text)}
                onTailChange={(tail) => handleBubbleTailChange(bubble.id, tail)}
                onDelete={() => handleBubbleDelete(bubble.id)}
              />
            ))}
          </DndContext>

          <div
            className="absolute inset-x-0 bottom-0 bg-black/70 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              value={narrationText}
              onChange={(e) => {
                setNarrationText(e.target.value)
                queueNarrationSave(e.target.value)
              }}
              rows={2}
              placeholder="what's happening in this panel?"
              className="w-full resize-none border-none bg-transparent text-center text-sm font-bold text-white placeholder:text-white/60 focus:outline-none"
            />
          </div>
        </div>

        {addingBubble && (
          <p className="text-sm font-bold text-accent-orange">tap the panel to place your bubble!</p>
        )}
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 lg:sticky lg:top-6">
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => setAddingBubble((v) => !v)}>
            <MessageSquarePlus className="h-4 w-4" />
            {addingBubble ? 'cancel' : 'add bubble'}
          </Button>
          <span className="text-xs font-bold text-accent-green">
            {saveStatus === 'saved' ? 'saved ✓' : saveStatus === 'saving' ? 'saving...' : ''}
          </span>
          <PlaybackButton text={narrationText} />
        </div>

        <Button size="lg" variant="outline" disabled={generating} onClick={onRegenerate}>
          {generating ? (
            <Sparkles className="h-5 w-5 animate-pulse" />
          ) : (
            <RefreshCw className="h-5 w-5" />
          )}
          regenerate
        </Button>
      </div>
    </div>
  )
}
