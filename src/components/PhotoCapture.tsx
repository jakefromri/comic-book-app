import { useRef } from 'react'
import { Camera, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PhotoCapture({
  previewUrl,
  disabled,
  onCapture,
}: {
  previewUrl: string | null
  disabled?: boolean
  onCapture: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onCapture(file)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {previewUrl ? (
        <div className="relative w-full max-w-sm">
          <img
            src={previewUrl}
            alt="your drawing"
            className="w-full rounded-2xl border-2 border-border object-cover"
          />
          <Button
            size="lg"
            variant="outline"
            className="absolute bottom-2 right-2 bg-surface/95"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <RotateCcw className="h-5 w-5" />
            retake
          </Button>
        </div>
      ) : (
        <Button
          size="xl"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="w-full max-w-sm"
        >
          <Camera className="h-7 w-7" />
          take a photo
        </Button>
      )}
    </div>
  )
}
