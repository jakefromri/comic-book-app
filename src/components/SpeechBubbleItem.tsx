import { useState, type CSSProperties } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Trash2 } from 'lucide-react'
import type { SpeechBubble } from '@/lib/pages'

const TAIL_OPTIONS: { value: SpeechBubble['tail']; label: string }[] = [
  { value: 'left', label: '◣' },
  { value: 'none', label: '—' },
  { value: 'right', label: '◢' },
]

export function SpeechBubbleItem({
  bubble,
  editing,
  onStartEdit,
  onStopEdit,
  onTextChange,
  onTailChange,
  onDelete,
}: {
  bubble: SpeechBubble
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onTextChange: (text: string) => void
  onTailChange: (tail: SpeechBubble['tail']) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: bubble.id })
  const [draftText, setDraftText] = useState(bubble.text)

  const style: CSSProperties = {
    left: `${bubble.x}%`,
    top: `${bubble.y}%`,
    width: `${bubble.width}%`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging || editing ? 30 : 10,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="absolute -translate-x-1/2 -translate-y-1/2 touch-none"
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation()
          if (!editing) {
            setDraftText(bubble.text)
            onStartEdit()
          }
        }}
        className={`cursor-grab rounded-2xl border-2 border-text-primary bg-white px-3 py-2 text-center text-sm font-bold text-text-primary shadow-md active:cursor-grabbing ${
          bubble.tail === 'left' ? 'rounded-bl-sm' : bubble.tail === 'right' ? 'rounded-br-sm' : ''
        }`}
      >
        {bubble.text || 'tap to type...'}
      </div>

      {editing && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-xl border-2 border-border bg-surface p-3 shadow-lg"
        >
          <textarea
            autoFocus
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={() => {
              onTextChange(draftText)
              onStopEdit()
            }}
            placeholder="what are they saying?"
            className="mb-2 min-h-16 w-full resize-none rounded-lg border-2 border-border bg-white p-2 text-sm text-text-primary"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {TAIL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onTailChange(opt.value)}
                  title={`tail: ${opt.value}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border-2 text-xs ${
                    bubble.tail === opt.value
                      ? 'border-accent-orange bg-accent-orange text-white'
                      : 'border-border text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDelete}
              title="delete bubble"
              className="flex h-7 w-7 items-center justify-center rounded-md text-accent-red"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
