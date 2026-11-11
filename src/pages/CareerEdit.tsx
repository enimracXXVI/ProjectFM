import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useConfirm } from '../components/confirm'
import { Button, ErrorText, Field } from '../components/form'
import { ImageSlot } from '../components/ImageSlot'
import { deleteCareer, startFresh, updateCareer, type NewCareer } from '../data/api'
import { deleteWorld } from '../world/storage'
import { deleteCompetitions } from '../competitions/storage'
import type { Career } from '../data/db'

export function CareerEdit({ career, onDone }: { career: Career; onDone: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
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

  const [fresh, setFresh] = useState({ squad: true, staff: true, world: true })
  const reset = useMutation({
    mutationFn: async () => {
      await startFresh(career, fresh)
      if (fresh.world) {
        await deleteWorld(career.id)
        await deleteCompetitions(career.id)
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const confirmFresh = async () => {
    const parts = [
      fresh.squad && 'squad, player history and import log',
      fresh.staff && 'staff and scouting network',
      fresh.world && 'world database and competitions',
    ].filter(Boolean)
    if (
      await confirm({
        title: 'Start fresh?',
        message: `This permanently clears the ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]} of “${career.name}”. The career, crest, kits and Settings stay.`,
        confirmLabel: 'Clear',
        danger: true,
        typeToConfirm: career.name,
      })
    )
      reset.mutate()
  }

  const set = (key: keyof NewCareer) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  const confirmDelete = async () => {
    if (
      await confirm({
        title: 'Delete career?',
        message: `This permanently deletes “${career.name}” with all its players, staff, imports and history.`,
        confirmLabel: 'Delete career',
        danger: true,
        typeToConfirm: career.name,
      })
    )
      remove.mutate()
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

      <section className="rounded-lg border border-red-500/40 p-4">
        <h3 className="text-sm font-semibold">Start fresh</h3>
        <p className="mt-1 text-sm text-muted">
          Imports add to what is already saved. To start again from your next import, clear what you
          want here. The career, crest, kits and Settings stay.
        </p>
        <div className="mt-3 grid gap-1 text-sm">
          {(
            [
              ['squad', 'Squad, player history and import log'],
              ['staff', 'Staff and scouting network'],
              ['world', 'World database and competitions'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={fresh[key]}
                onChange={(e) => setFresh({ ...fresh, [key]: e.target.checked })}
                className="size-5"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="danger"
            onClick={confirmFresh}
            disabled={reset.isPending || !(fresh.squad || fresh.staff || fresh.world)}
          >
            {reset.isPending ? 'Clearing…' : 'Clear and start fresh'}
          </Button>
          {reset.isSuccess && (
            <span className="text-sm text-accent">Cleared. Import your save.</span>
          )}
          <ErrorText error={reset.error} />
        </div>
      </section>
    </div>
  )
}
