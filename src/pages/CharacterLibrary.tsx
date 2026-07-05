import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, UserRound } from 'lucide-react'
import { useAuthContext } from '@/hooks/useAuthContext'
import { supabase } from '@/lib/supabase'
import { listCharacters, createCharacter, updateCharacter, deleteCharacter, type Character } from '@/lib/characters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { PhotoCapture } from '@/components/PhotoCapture'
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
  | { type: 'edit'; character: Character }
  | { type: 'delete'; character: Character }
  | null

function photoPreviewUrl(character: Character, signedUrls: Map<string, string>): string | null {
  if (!character.photo_url) return null
  return signedUrls.get(character.photo_url) ?? null
}

export function CharacterLibrary() {
  const { user } = useAuthContext()
  const [characters, setCharacters] = useState<Character[]>([])
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [photoInput, setPhotoInput] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      const data = await listCharacters(user.id)
      setCharacters(data)
      await refreshSignedUrls(data)
    } catch {
      setError("couldn't load your characters — try refreshing")
    } finally {
      setLoading(false)
    }
  }

  async function refreshSignedUrls(data: Character[]) {
    const paths = data.map((c) => c.photo_url).filter((p): p is string => !!p)
    if (!paths.length) return
    const entries = await Promise.all(
      paths.map(async (path) => {
        const { data: signed } = await supabase.storage.from('characters').createSignedUrl(path, 3600)
        return [path, signed?.signedUrl ?? ''] as const
      })
    )
    setSignedUrls(new Map(entries.filter(([, url]) => url)))
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listCharacters(user.id)
      .then(async (data) => {
        if (cancelled) return
        setCharacters(data)
        await refreshSignedUrls(data)
      })
      .catch(() => {
        if (!cancelled) setError("couldn't load your characters — try refreshing")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function resetForm() {
    setNameInput('')
    setDescriptionInput('')
    setPhotoInput(null)
    setPhotoPreview(null)
    setError(null)
  }

  function openCreate() {
    resetForm()
    setDialog({ type: 'create' })
  }

  function openEdit(character: Character) {
    resetForm()
    setNameInput(character.name)
    setDescriptionInput(character.description)
    setPhotoPreview(photoPreviewUrl(character, signedUrls))
    setDialog({ type: 'edit', character })
  }

  function openDelete(character: Character) {
    setError(null)
    setDialog({ type: 'delete', character })
  }

  function handlePhotoCapture(file: File) {
    setPhotoInput(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !dialog || dialog.type === 'delete') return
    setSubmitting(true)
    setError(null)
    try {
      if (dialog.type === 'create') {
        await createCharacter(user.id, {
          name: nameInput,
          description: descriptionInput,
          photo: photoInput,
        })
      } else {
        await updateCharacter(dialog.character, {
          name: nameInput,
          description: descriptionInput,
          photo: photoInput,
        })
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
      await deleteCharacter(dialog.character)
      setDialog(null)
      await refresh()
    } catch {
      setError("couldn't delete that character — try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-3xl p-6">
      <header className="mb-6 flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold">characters</h1>
        <Button size="lg" onClick={openCreate}>
          <Plus className="h-5 w-5" />
          new character
        </Button>
      </header>

      {loading ? (
        <p className="text-text-muted">loading...</p>
      ) : characters.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <UserRound className="h-16 w-16 text-accent-orange" />
          <div>
            <p className="text-lg font-bold">no characters yet!</p>
            <p className="text-text-muted">
              add the heroes of your story so they look the same on every page
            </p>
          </div>
          <Button size="xl" onClick={openCreate}>
            <Plus className="h-6 w-6" />
            add your first character
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {characters.map((character) => {
            const photo = photoPreviewUrl(character, signedUrls)
            return (
              <Card key={character.id} className="overflow-hidden">
                <div className="flex aspect-square items-center justify-center bg-surface-raised">
                  {photo ? (
                    <img src={photo} alt={character.name} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-10 w-10 text-text-muted" />
                  )}
                </div>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <p className="min-w-0 flex-1 truncate font-bold">{character.name}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(character)} title="edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openDelete(character)} title="delete">
                      <Trash2 className="h-4 w-4 text-accent-red" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={dialog?.type === 'create' || dialog?.type === 'edit'}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleFormSubmit(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{dialog?.type === 'edit' ? 'edit character' : 'new character'}</DialogTitle>
              <DialogDescription>
                describe what makes this character look unique — it gets used every time they show up in a panel
              </DialogDescription>
            </DialogHeader>

            <PhotoCapture previewUrl={photoPreview} onCapture={handlePhotoCapture} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="character-name">name</Label>
              <Input
                id="character-name"
                autoFocus
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="character-description">description</Label>
              <Textarea
                id="character-description"
                required
                placeholder="muscular warrior with spiky black hair, orange gi, intense expression, glowing aura"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-accent-red">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {dialog?.type === 'edit' ? 'save' : 'create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              delete "{dialog?.type === 'delete' ? dialog.character.name : ''}"?
            </DialogTitle>
            <DialogDescription>
              this doesn't affect panels already generated — it only stops them from being used in new ones.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
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
