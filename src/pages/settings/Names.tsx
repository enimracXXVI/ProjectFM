import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import type { CompetitionKind } from '../../competitions/types'
import { teachJob } from '../../data/api'
import { DEFAULT_CONFIG, saveConfig } from '../../data/config'
import { JOB_BY_CODE, JOB_TITLES } from '../../data/staffJobs'
import { MORALE_WORDS } from '../../import/dump'
import { useCurrentCareer } from '../../lib/career'
import { useConfig } from '../../lib/config'

const field =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const num =
  'min-h-11 w-24 shrink-0 rounded-lg border border-border bg-surface-2 px-2 text-center text-base tabular-nums md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400'

type Row = [string, string]
const rows = (m: Record<string, string>): Row[] =>
  Object.entries(m).sort((a, b) => Number(a[0]) - Number(b[0]))
const toMap = (r: Row[]) => Object.fromEntries(r.filter(([k, v]) => k.trim() && v.trim()))

/** Names and words the app learned from FM (or that the user taught it), all editable. */
export function NamesSettings() {
  const config = useConfig()
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const stored = {
    morale: rows({ ...MORALE_WORDS, ...config.learned.morale }),
    rounds: rows(config.learned.rounds ?? {}),
    jobs: rows({ ...JOB_BY_CODE, ...config.learned.jobs }),
    comps: Object.entries(config.competitions).map(
      ([id, c]) => [id, c.name, c.kind] as [string, string, CompetitionKind],
    ),
  }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const save = useMutation({
    mutationFn: async () => {
      const jobs = toMap(form.jobs)
      await saveConfig('learned', {
        ...config.learned,
        morale: toMap(form.morale),
        rounds: toMap(form.rounds),
        jobs,
      })
      await saveConfig(
        'competitions',
        Object.fromEntries(
          form.comps.filter(([id, n]) => id && n).map(([id, name, kind]) => [id, { name, kind }]),
        ),
      )
      // Staff whose job title changed get the new one now
      const old = toMap(stored.jobs)
      for (const [code, title] of Object.entries(jobs))
        if (old[code] !== title) await teachJob(career.id, Number(code), title)
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const reset = useMutation({
    mutationFn: async () => {
      await saveConfig('learned', { ...config.learned, morale: {}, rounds: {}, jobs: {} })
      await saveConfig('competitions', DEFAULT_CONFIG.competitions)
    },
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <SettingsShell
      title="FM names and words"
      subtitle="Words and names the save only stores as numbers or IDs. Changes apply from your next import."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate()}
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Block
          title="Morale (value 1–20 → word)"
          onAdd={() => setForm({ ...form, morale: [...form.morale, ['', '']] })}
        >
          {form.morale.map(([v, w], i) => (
            <PairRow
              key={i}
              left={
                <input
                  aria-label="Value"
                  inputMode="numeric"
                  value={v}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      morale: form.morale.map((r, j) => (j === i ? [e.target.value, r[1]] : r)),
                    })
                  }
                  className={num}
                />
              }
              right={
                <input
                  aria-label={`Word for ${v}`}
                  value={w}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      morale: form.morale.map((r, j) => (j === i ? [r[0], e.target.value] : r)),
                    })
                  }
                  className={field}
                />
              }
              onRemove={() => setForm({ ...form, morale: form.morale.filter((_, j) => j !== i) })}
            />
          ))}
        </Block>

        <Block
          title="Competitions (FM ID → name and type)"
          onAdd={() => setForm({ ...form, comps: [...form.comps, ['', '', 'league']] })}
        >
          {form.comps.map(([id, name, kind], i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                aria-label="FM ID"
                inputMode="numeric"
                value={id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    comps: form.comps.map((r, j) => (j === i ? [e.target.value, r[1], r[2]] : r)),
                  })
                }
                className={num}
              />
              <input
                aria-label={`Name of ${id}`}
                value={name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    comps: form.comps.map((r, j) => (j === i ? [r[0], e.target.value, r[2]] : r)),
                  })
                }
                className={field}
              />
              <select
                aria-label="Type"
                value={kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    comps: form.comps.map((r, j) =>
                      j === i ? [r[0], r[1], e.target.value as CompetitionKind] : r,
                    ),
                  })
                }
                className="min-h-11 rounded-lg border border-border bg-surface-2 px-2 text-base md:text-sm"
              >
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="friendlies">Friendlies</option>
              </select>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Remove ${name}`}
                onClick={() => setForm({ ...form, comps: form.comps.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </Block>

        <Block
          title="Cup rounds (FM round code → name)"
          onAdd={() => setForm({ ...form, rounds: [...form.rounds, ['', '']] })}
        >
          {form.rounds.map(([v, w], i) => (
            <PairRow
              key={i}
              left={
                <input
                  aria-label="Round code"
                  inputMode="numeric"
                  value={v}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rounds: form.rounds.map((r, j) => (j === i ? [e.target.value, r[1]] : r)),
                    })
                  }
                  className={num}
                />
              }
              right={
                <input
                  aria-label={`Name of round ${v}`}
                  value={w}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rounds: form.rounds.map((r, j) => (j === i ? [r[0], e.target.value] : r)),
                    })
                  }
                  className={field}
                />
              }
              onRemove={() => setForm({ ...form, rounds: form.rounds.filter((_, j) => j !== i) })}
            />
          ))}
        </Block>

        <Block
          title="Staff jobs (FM job code → job)"
          onAdd={() => setForm({ ...form, jobs: [...form.jobs, ['', '']] })}
        >
          {form.jobs.map(([v, w], i) => (
            <PairRow
              key={i}
              left={
                <input
                  aria-label="Job code"
                  inputMode="numeric"
                  value={v}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      jobs: form.jobs.map((r, j) => (j === i ? [e.target.value, r[1]] : r)),
                    })
                  }
                  className={num}
                />
              }
              right={
                <select
                  aria-label={`Job for code ${v}`}
                  value={w}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      jobs: form.jobs.map((r, j) => (j === i ? [r[0], e.target.value] : r)),
                    })
                  }
                  className={field}
                >
                  {!JOB_TITLES.some(([t]) => t === w) && <option value={w}>{w || '–'}</option>}
                  {JOB_TITLES.map(([t]) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              }
              onRemove={() => setForm({ ...form, jobs: form.jobs.filter((_, j) => j !== i) })}
            />
          ))}
        </Block>
      </div>
    </SettingsShell>
  )
}

function Block({
  title,
  onAdd,
  children,
}: {
  title: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="grid gap-1">{children}</ul>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add
      </button>
    </section>
  )
}

function PairRow({
  left,
  right,
  onRemove,
}: {
  left: ReactNode
  right: ReactNode
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-2">
      {left}
      {right}
      <button type="button" className={iconBtn} aria-label="Remove" onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
