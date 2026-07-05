import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, BookOpen, LogOut } from 'lucide-react'
import { useAuthContext } from '@/hooks/useAuthContext'
import { supabase } from '@/lib/supabase'
import {
  listComics,
  createComic,
  renameComic,
  deleteComic,
  type ComicBookWithCover,
} from '@/lib/comics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type DialogState =
  | { type: 'create' }
  | { type: 'rename'; comic: ComicBookWithCover }
  | { type: 'delete'; comic: ComicBookWithCover }
  | null

function coverUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from('panels').getPublicUrl(path).data.publicUrl
}

export function Library() {
  const { user, signOut } = useAuthContext()
  const [comics, setComics] = useState<ComicBookWithCover[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [titleInput, setTitleInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      setComics(await listComics(user.id))
    } catch {
      setError("couldn't load your comics — try refreshing")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listComics(user.id)
      .then((data) => {
        if (!cancelled) setComics(data)
      })
      .catch(() => {
        if (!cancelled) setError("couldn't load your comics — try refreshing")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function openCreate() {
    setTitleInput('')
    setError(null)
    setDialog({ type: 'create' })
  }

  function openRename(comic: ComicBookWithCover) {
    setTitleInput(comic.title)
    setError(null)
    setDialog({ type: 'rename', comic })
  }

  function openDelete(comic: ComicBookWithCover) {
    setError(null)
    setDialog({ type: 'delete', comic })
  }

  async function handleTitleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !dialog) return
    setSubmitting(true)
    setError(null)
    try {
      if (dialog.type === 'create') {
        await createComic(user.id, titleInput)
      } else if (dialog.type === 'rename') {
        await renameComic(dialog.comic.id, titleInput)
      }
      setDialog(null)
      await refresh()
    } catch {
      setError('something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (dialog?.type !== 'delete') return
    setSubmitting(true)
    setError(null)
    try {
      await deleteComic(dialog.comic.id)
      setDialog(null)
      await refresh()
    } catch {
      setError("couldn't delete that comic — try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">my comics</h1>
        <div className="flex items-center gap-2">
          <Button size="lg" onClick={openCreate}>
            <Plus className="h-5 w-5" />
            new comic
          </Button>
          <Button size="icon" variant="ghost" onClick={() => void signOut()} title="sign out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-text-muted">loading...</p>
      ) : comics.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <BookOpen className="h-16 w-16 text-accent-orange" />
          <div>
            <p className="text-lg font-bold">no comics yet!</p>
            <p className="text-text-muted">make your first comic book to get started</p>
          </div>
          <Button size="xl" onClick={openCreate}>
            <Plus className="h-6 w-6" />
            create your first comic
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {comics.map((comic) => {
            const cover = coverUrl(comic.coverUrl)
            return (
              <Card key={comic.id} className="overflow-hidden">
                <Link to={`/comics/${comic.id}`} className="block">
                  <div className="flex aspect-[3/4] items-center justify-center bg-surface-raised">
                    {cover ? (
                      <img
                        src={cover}
                        alt={comic.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-10 w-10 text-text-muted" />
                    )}
                  </div>
                </Link>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <Link to={`/comics/${comic.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-bold">{comic.title}</p>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openRename(comic)}
                      title="rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openDelete(comic)}
                      title="delete"
                    >
                      <Trash2 className="h-4 w-4 text-accent-red" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialog?.type === 'create' || dialog?.type === 'rename'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={handleTitleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{dialog?.type === 'rename' ? 'rename comic' : 'new comic'}</DialogTitle>
              <DialogDescription>give your comic book a title</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comic-title">title</Label>
              <Input
                id="comic-title"
                autoFocus
                required
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-accent-red">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {dialog?.type === 'rename' ? 'save' : 'create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>delete "{dialog?.type === 'delete' ? dialog.comic.title : ''}"?</DialogTitle>
            <DialogDescription>
              this deletes every page, drawing, and generated panel in this comic. this can't be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              cancel
            </Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={() => void handleDelete()}>
              delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
