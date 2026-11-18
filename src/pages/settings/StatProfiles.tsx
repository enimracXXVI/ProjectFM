import { clsx } from 'clsx'
import { ArrowDown, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { PickList } from '../../components/PickList'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { StatProfile } from '../../world/profiles'
import { METRICS } from '../../world/stats'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const label = (key: string) => METRICS.find((m) => m.key === key)?.label ?? key

/** The figures behind each World stat profile, for roles and for positions. */
export function StatProfilesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('statProfiles')
  const stored = config.statProfiles
  const [form, setForm] = useState<StatProfile[]>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const update = (id: string, patch: Partial<StatProfile>) =>
    setForm(form.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const add = (kind: StatProfile['kind']) =>
    setForm([
      ...form,
      { id: `own-${Date.now()}`, name: 'New profile', kind, positions: [], metrics: [] },
    ])

  const editor = (p: StatProfile) => (
    <li key={p.id} className="grid gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Name"
          value={p.name}
          onChange={(e) => update(p.id, { name: e.target.value })}
          className={`${input} font-semibold sm:max-w-md`}
        />
        <input
          aria-label={`Positions compared for ${p.name}`}
          title="FM positions of the players compared, separated by commas: GK, D (C), D (L), WB (R), DM, M (C), AM (L), ST (C)…"
          value={p.positions.join(', ')}
          onChange={(e) =>
            update(p.id, {
              positions: e.target.value
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          className={`${input} sm:max-w-xs`}
        />
        <button
          type="button"
          aria-label={`Delete ${p.name}`}
          onClick={() => setForm(form.filter((x) => x.id !== p.id))}
          className="ml-auto grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {p.metrics.map((mt, i) => (
          <li
            key={mt.key}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border pr-1 pl-3 text-sm"
          >
            {label(mt.key)}
            <button
              type="button"
              aria-pressed={!!mt.low}
              title={
                mt.low ? 'Lower is better (click to change)' : 'Higher is better (click to change)'
              }
              onClick={() =>
                update(p.id, {
                  metrics: p.metrics.map((x, j) => (j === i ? { ...x, low: !x.low } : x)),
                })
              }
              className={clsx(
                'grid size-7 place-items-center rounded-full',
                mt.low ? 'text-amber-400' : 'text-muted hover:text-text',
              )}
            >
              <ArrowDown className={clsx('size-3.5', !mt.low && 'rotate-180')} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Remove ${label(mt.key)}`}
              onClick={() => update(p.id, { metrics: p.metrics.filter((_, j) => j !== i) })}
              className="grid size-7 place-items-center rounded-full text-muted hover:text-red-400"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        <li className="w-56">
          <PickList
            value=""
            placeholder="Add a figure"
            onChange={(key) =>
              key &&
              !p.metrics.some((x) => x.key === key) &&
              update(p.id, { metrics: [...p.metrics, { key }] })
            }
            options={METRICS.map((x) => ({ value: x.key, label: x.label, group: x.group }))}
          />
        </li>
      </ul>
    </li>
  )

  return (
    <SettingsShell
      title="Stat profiles"
      subtitle="The figures that matter for each role and each position. In World, ranking by a profile compares every player who plays its positions (with enough minutes) and scores him 0–100: the average of his percentiles in these figures. The arrow marks figures where lower is better."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form.filter((p) => p.name.trim()))}
      onReset={() => reset.mutate()}
    >
      {(['role', 'position'] as const).map((kind) => (
        <SettingsSection
          key={kind}
          id={`stat-profiles/${kind}`}
          title={kind === 'role' ? 'Roles' : 'Positions'}
          aside={form.filter((p) => p.kind === kind).length}
          className="mb-4"
        >
          <ul className="grid gap-2">{form.filter((p) => p.kind === kind).map(editor)}</ul>
          <button
            type="button"
            onClick={() => add(kind)}
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add {kind === 'role' ? 'a role' : 'a position'}
          </button>
        </SettingsSection>
      ))}
    </SettingsShell>
  )
}
