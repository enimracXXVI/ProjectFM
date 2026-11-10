import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorText, Field } from '../components/form'
import { PageHeader, Placeholder } from '../components/ui'
import { deleteStaff, saveStaff, type StaffInput } from '../data/api'
import type { StaffRow } from '../data/db'
import { useStaff } from '../data/hooks'
import {
  KNOWN_REPUTATIONS,
  SCOUT_KEY_ATTRIBUTES,
  STAFF_ROLES,
  STAFF_SCALE_RANGES,
  STAFF_SECTIONS,
  ratingColor,
} from '../data/staffInfo'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

const empty: StaffInput = {
  name: '',
  role: 'Scout',
  age: null,
  nation: null,
  personality: null,
  reputation: null,
  attributes: {},
  knowledge: [],
  notes: null,
}

export function StaffEdit() {
  const { id = 'new' } = useParams()
  const career = useCurrentCareer()
  const { data, isPending } = useStaff(career.id)
  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  const existing = id === 'new' ? null : data?.find((s) => s.id === id)
  if (id !== 'new' && !existing) return <Placeholder>Staff member not found.</Placeholder>
  return <StaffForm key={id} existing={existing ?? null} />
}

function StaffForm({ existing }: { existing: StaffRow | null }) {
  const career = useCurrentCareer()
  const config = useConfig()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<StaffInput>(() =>
    existing
      ? {
          name: existing.name,
          role: existing.role,
          age: existing.age,
          nation: existing.nation,
          personality: existing.personality,
          reputation: existing.reputation,
          attributes: existing.attributes,
          knowledge: existing.knowledge,
          notes: existing.notes,
        }
      : empty,
  )
  const countries = useMemo(
    () => [...new Set(config.regions.flatMap((r) => r.countries))].sort(),
    [config.regions],
  )

  const done = () => {
    qc.invalidateQueries({ queryKey: ['staff', career.id] })
    qc.invalidateQueries({ queryKey: ['careers'] })
    navigate('/staff')
  }
  const save = useMutation({
    mutationFn: () => saveStaff(career.id, existing?.id ?? null, form),
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: () => deleteStaff(career, existing!.id),
    onSuccess: done,
  })

  const set = <K extends keyof StaffInput>(key: K, value: StaffInput[K]) =>
    setForm({ ...form, [key]: value })
  const setAttr = (name: string, word: string) => {
    const attributes = { ...form.attributes }
    if (word) attributes[name] = word
    else delete attributes[name]
    set('attributes', attributes)
  }
  const setKnowledge = (i: number, patch: Partial<StaffInput['knowledge'][number]>) =>
    set(
      'knowledge',
      form.knowledge.map((k, j) => (j === i ? { ...k, ...patch } : k)),
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit}>
      <Link
        to="/staff"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Staff
      </Link>
      <PageHeader title={existing ? existing.name : 'Add staff'} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          label="Name"
          required
          className="lg:col-span-2"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Role</span>
          <select
            value={form.role ?? ''}
            onChange={(e) => set('role', e.target.value || null)}
            className={input}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <Field
          label="Age"
          inputMode="numeric"
          value={form.age ?? ''}
          onChange={(e) => set('age', e.target.value ? Number(e.target.value) || null : null)}
        />
        <Field
          label="Nationality"
          list="countries"
          value={form.nation ?? ''}
          onChange={(e) => set('nation', e.target.value || null)}
        />
        <Field
          label="Personality"
          className="lg:col-span-2"
          value={form.personality ?? ''}
          onChange={(e) => set('personality', e.target.value || null)}
        />
        <Field
          label="Reputation"
          list="reputations"
          value={form.reputation ?? ''}
          onChange={(e) => set('reputation', e.target.value || null)}
        />
      </div>
      <datalist id="reputations">
        {KNOWN_REPUTATIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="countries">
        {countries.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="mt-6 grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {STAFF_SECTIONS.map((section) => (
          <section key={section.label}>
            <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
              {section.label}
            </h2>
            <ul className="text-sm">
              {section.attributes.map((a) => {
                const key = SCOUT_KEY_ATTRIBUTES.includes(a)
                return (
                  <li
                    key={a}
                    className={clsx(
                      'flex min-h-11 items-center justify-between gap-2 px-3 odd:bg-surface even:bg-surface/40',
                      key && 'border-l-2 border-accent',
                    )}
                  >
                    <span>{a}</span>
                    <select
                      aria-label={a}
                      value={form.attributes[a] ?? ''}
                      onChange={(e) => setAttr(a, e.target.value)}
                      className={clsx(
                        'min-h-9 w-36 rounded-lg border border-border bg-surface-2 px-2 text-right text-sm font-semibold',
                        ratingColor(form.attributes[a], config.staffScale),
                      )}
                    >
                      <option value="">–</option>
                      {config.staffScale.map((w) => (
                        <option key={w} value={w}>
                          {STAFF_SCALE_RANGES[w] ? `${w} (${STAFF_SCALE_RANGES[w]})` : w}
                        </option>
                      ))}
                    </select>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
            Scouting Knowledge
          </h2>
          <ul className="grid gap-2">
            {form.knowledge.map((k, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label="Nation"
                  list="countries"
                  placeholder="Nation"
                  value={k.nation}
                  onChange={(e) => setKnowledge(i, { nation: e.target.value })}
                  className={input}
                />
                <select
                  aria-label="Knowledge"
                  value={k.level}
                  onChange={(e) => setKnowledge(i, { level: e.target.value })}
                  className={`${input} w-36`}
                >
                  {config.knowledgeLevels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${k.nation || 'nation'}`}
                  onClick={() =>
                    set(
                      'knowledge',
                      form.knowledge.filter((_, j) => j !== i),
                    )
                  }
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              set('knowledge', [
                ...form.knowledge,
                { nation: '', level: config.knowledgeLevels.at(-1) ?? '' },
              ])
            }
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add nation
          </button>
        </section>
      </div>

      <label className="mt-6 grid max-w-2xl gap-1 text-sm">
        <span className="text-muted">Notes</span>
        <textarea
          rows={3}
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          className={`${input} py-2`}
        />
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete ${existing.name}? They are also removed from the scouting network.`,
                )
              )
                remove.mutate()
            }}
          >
            Delete
          </Button>
        )}
        <ErrorText error={save.error ?? remove.error} />
      </div>
    </form>
  )
}
