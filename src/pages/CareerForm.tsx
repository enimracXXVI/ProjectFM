import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field } from '../components/form'
import { createCareer, type NewCareer } from '../data/api'
import { useCareer } from '../lib/career'

const empty: NewCareer = {
  name: '',
  club: '',
  nation: '',
  start_season: '2026/27',
  current_season: '2026/27',
}

export function CareerForm({ onDone }: { onDone?: () => void }) {
  const [form, setForm] = useState(empty)
  const { setCurrentId } = useCareer()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: createCareer,
    onSuccess: (career) => {
      qc.invalidateQueries({ queryKey: ['careers'] })
      setCurrentId(career.id)
      setForm(empty)
      onDone?.()
    },
  })

  const set = (key: keyof NewCareer) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...form, nation: form.nation || null })
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Career name"
        required
        placeholder="e.g. Viola Revival"
        value={form.name}
        onChange={set('name')}
      />
      <Field
        label="Club"
        required
        placeholder="e.g. Fiorentina"
        value={form.club}
        onChange={set('club')}
      />
      <Field
        label="Country"
        placeholder="e.g. Italy"
        value={form.nation ?? ''}
        onChange={set('nation')}
      />
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
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create career'}
        </Button>
        <ErrorText error={mutation.error} />
      </div>
    </form>
  )
}
