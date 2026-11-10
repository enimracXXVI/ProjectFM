import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { setCareerImage, type CareerImageSlot } from '../data/api'
import type { Career } from '../data/db'
import { prepareImage } from '../lib/images'
import { ErrorText } from './form'

/** Upload / replace / remove one career image (crest or kit). */
export function ImageSlot({
  career,
  slot,
  label,
}: {
  career: Career
  slot: CareerImageSlot
  label: string
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (file: File | null) =>
      setCareerImage(career, slot, file ? await prepareImage(file) : null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['careers'] }),
  })
  const url = career[slot]

  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <label className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2 hover:border-muted">
        {url ? (
          <img src={url} alt={label} className="size-full object-contain p-2" />
        ) : (
          <ImagePlus className="size-6 text-muted" aria-hidden />
        )}
        {mutation.isPending && (
          <span className="absolute inset-0 grid place-items-center bg-bg/70 text-xs">
            Uploading…
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={`Upload ${label}`}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) mutation.mutate(f)
          }}
        />
      </label>
      {url && (
        <button
          type="button"
          onClick={() => mutation.mutate(null)}
          className="inline-flex min-h-9 items-center gap-1 text-xs text-muted hover:text-red-400"
        >
          <Trash2 className="size-3.5" aria-hidden /> Remove
        </button>
      )}
      <ErrorText error={mutation.error} />
    </div>
  )
}
