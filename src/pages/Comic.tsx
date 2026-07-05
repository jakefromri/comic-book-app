import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, ImageIcon } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuthContext } from '@/hooks/useAuthContext'
import { supabase } from '@/lib/supabase'
import { getComic, listPages, addPage, deletePage, reorderPages, type Page } from '@/lib/pages'
import type { ComicBook } from '@/lib/comics'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

function panelUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from('panels').getPublicUrl(path).data.publicUrl
}

function SortablePageCard({
  page,
  index,
  onOpen,
  onDelete,
}: {
  page: Page
  index: number
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const cover = panelUrl(page.panel_url)

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="relative">
        <button
          type="button"
          className="flex aspect-[3/4] w-full items-center justify-center bg-surface-raised"
          onClick={onOpen}
        >
          {cover ? (
            <img src={cover} alt={`page ${index + 1}`} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-text-muted" />
          )}
        </button>
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1 top-1 flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg bg-surface/90 active:cursor-grabbing"
          title="drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1 h-9 w-9 bg-surface/90"
          onClick={onDelete}
          title="delete page"
        >
          <Trash2 className="h-4 w-4 text-accent-red" />
        </Button>
      </div>
      <p className="p-2 text-center text-sm font-bold text-text-muted">page {index + 1}</p>
    </Card>
  )
}

export function Comic() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [comic, setComic] = useState<ComicBook | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getComic(id), listPages(id)])
      .then(([comicData, pagesData]) => {
        if (cancelled) return
        setComic(comicData)
        setPages(pagesData)
      })
      .catch(() => {
        if (!cancelled) setComic(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleAddPage() {
    if (!user || !id) return
    setSubmitting(true)
    setError(null)
    try {
      const nextOrder = pages.length ? Math.max(...pages.map((p) => p.page_order)) + 1 : 0
      const page = await addPage(user.id, id, nextOrder)
      setPages((prev) => [...prev, page])
    } catch {
      setError("couldn't add a page — try again")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSubmitting(true)
    setError(null)
    try {
      await deletePage(deleteTarget)
      const remaining = pages.filter((p) => p.id !== deleteTarget.id)
      await reorderPages(remaining)
      setPages(remaining.map((p, i) => ({ ...p, page_order: i })))
      setDeleteTarget(null)
    } catch {
      setError("couldn't delete that page — try again")
    } finally {
      setSubmitting(false)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(pages, oldIndex, newIndex).map((p, i) => ({
      ...p,
      page_order: i,
    }))
    setPages(reordered)
    void reorderPages(reordered)
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-muted">loading...</p>
      </div>
    )
  }

  if (!comic) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg font-bold">comic not found</p>
        <Button onClick={() => navigate('/')}>back to library</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-2xl font-bold">{comic.title}</h1>
        </div>
        <Button size="lg" onClick={() => void handleAddPage()} disabled={submitting}>
          <Plus className="h-5 w-5" />
          add page
        </Button>
      </header>

      {error && <p className="mb-4 text-sm text-accent-red">{error}</p>}

      {pages.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <ImageIcon className="h-16 w-16 text-accent-orange" />
          <div>
            <p className="text-lg font-bold">no pages yet!</p>
            <p className="text-text-muted">add your first page to start drawing</p>
          </div>
          <Button size="xl" onClick={() => void handleAddPage()} disabled={submitting}>
            <Plus className="h-6 w-6" />
            add first page
          </Button>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {pages.map((page, index) => (
                <SortablePageCard
                  key={page.id}
                  page={page}
                  index={index}
                  onOpen={() => navigate(`/comics/${comic.id}/pages/${page.id}`)}
                  onDelete={() => setDeleteTarget(page)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>delete this page?</DialogTitle>
            <DialogDescription>
              the drawing and generated panel for this page will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleDelete()}
            >
              delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
