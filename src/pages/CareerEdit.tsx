import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field } from '../components/form'
import { ImageSlot } from '../components/ImageSlot'
import { deleteCareer, updateCareer, type NewCareer } from '../data/api'
import type { Career } from '../data/db'

export function CareerEdit({ career, onDone }: { career: Career; onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<NewCareer>({
    name: career.name,
    club: career.club,
    nation: career.nation,
    start_season: career.start_season,
    current_season: career.current_season,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['careers'] })
  const save = useMutation({
    mutationFn: () => updateCareer(career.id, { ...form, nation: form.nation || null }),
    onSuccess: () => (refresh(), onDone()),
  })
  const remove = useMutation({
    mutationFn: () => deleteCareer(career.id),
    onSuccess: refresh,
  })

  const set = (key: keyof NewCareer) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  const confirmDelete = () => {
    const typed = window.prompt(
      `This permanently deletes "${career.name}" with all its players, imports and history.\n\nType the career name to confirm:`,
    )
    if (typed === career.name) remove.mutate()
  }

  return (
    <div className="grid gap-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Crest and kits</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ImageSlot career={career} slot="crest_url" label="Crest" />
          <ImageSlot career={career} slot="kit_home_url" label="Home kit" />
          <ImageSlot career={career} slot="kit_away_url" label="Away kit" />
          <ImageSlot career={career} slot="kit_third_url" label="Third kit" />
        </div>
        <p className="mt-2 text-xs text-muted">
          PNG, JPG, WebP, SVG or GIF. Pictures are resized to 512px; transparent backgrounds are
          kept.
        </p>
      </section>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Career name" required value={form.name} onChange={set('name')} />
        <Field label="Club" required value={form.club} onChange={set('club')} />
        <Field label="Country" value={form.nation ?? ''} onChange={set('nation')} />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First season"
            value={form.start_season ?? ''}
            onChange={set('start_season')}
          />
          <Field
            label="Current season"
            value={form.current_season ?? ''}
            onChange={set('current_season')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Close
          </Button>
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            onClick={confirmDelete}
            disabled={remove.isPending}
          >
            Delete career
          </Button>
          <ErrorText error={save.error ?? remove.error} />
        </div>
      </form>
    </div>
  )
}
