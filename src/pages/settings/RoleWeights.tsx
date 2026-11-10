import { clsx } from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { attributeLabel } from '../../data/config'
import { ATTRIBUTE_GROUPS } from '../../import/fields'
import { useConfig } from '../../lib/config'
import type { RoleWeights, Tier } from '../../lib/roleFit'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

type Kind = 'outfield' | 'goalkeeper'

const ATTRS: Record<Kind, string[]> = {
  outfield: [
    ...ATTRIBUTE_GROUPS.Technical,
    ...ATTRIBUTE_GROUPS.Mental,
    ...ATTRIBUTE_GROUPS.Physical,
  ],
  goalkeeper: [
    ...ATTRIBUTE_GROUPS.Goalkeeping,
    'First Touch',
    'Passing',
    'Technique',
    ...ATTRIBUTE_GROUPS.Mental,
    ...ATTRIBUTE_GROUPS.Physical,
  ],
}

export function RoleWeightsSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('roleWeights')
  const [w, setW] = useState<RoleWeights>(config.roleWeights)
  const [prev, setPrev] = useState(config.roleWeights)
  if (config.roleWeights !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(config.roleWeights)
    setW(config.roleWeights)
  }
  const [kind, setKind] = useState<Kind>('outfield')
  const tiers = w[kind]
  const setTiers = (t: Tier[]) => setW({ ...w, [kind]: t })

  const tierIndex = (a: string) => tiers.findIndex((t) => t.attributes.includes(a))
  const assign = (a: string, to: number) =>
    setTiers(
      tiers.map((t, i) => ({
        ...t,
        attributes:
          i === to
            ? [...t.attributes.filter((x) => x !== a), a]
            : t.attributes.filter((x) => x !== a),
      })),
    )

  const num = (v: string) => Math.max(0, Number(v) || 0)
  const dirty = JSON.stringify(w) !== JSON.stringify(config.roleWeights)

  return (
    <SettingsShell
      title="Role weights"
      subtitle="How much each attribute counts in role scores. A starting point, not FM's own numbers."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(w)}
      onReset={() => reset.mutate()}
    >
      <section className="mb-6 rounded-xl border border-border bg-surface p-3">
        <h2 className="font-semibold">Role factors</h2>
        <p className="mb-2 text-xs text-muted">
          Multiply an attribute's weight when it is key, preferred, or neither for the role.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['key', 'Key'],
              ['preferred', 'Preferred'],
              ['other', 'Other'],
              ['defaultWeight', 'No tier'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="grid gap-1 text-xs text-muted">
              {label}
              <input
                type="number"
                step="0.05"
                min={0}
                value={w[k]}
                onChange={(e) => setW({ ...w, [k]: num(e.target.value) })}
                className={input}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="mb-3 flex w-fit rounded-lg border border-border p-0.5" role="group">
        {(
          [
            ['outfield', 'Outfield'],
            ['goalkeeper', 'Goalkeepers'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={clsx(
              'min-h-10 rounded-md px-3 text-sm',
              kind === k ? 'bg-surface-2 text-text' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mb-6 rounded-xl border border-border bg-surface p-3">
        <h2 className="mb-2 font-semibold">Importance tiers</h2>
        <ul className="grid gap-2">
          {tiers.map((t, i) => (
            <li key={i} className="flex items-end gap-2">
              <label className="grid flex-1 gap-1 text-xs text-muted">
                Name
                <input
                  value={t.name}
                  onChange={(e) =>
                    setTiers(tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  className={input}
                />
              </label>
              <label className="grid w-24 gap-1 text-xs text-muted">
                Weight
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={t.weight}
                  onChange={(e) =>
                    setTiers(
                      tiers.map((x, j) => (j === i ? { ...x, weight: num(e.target.value) } : x)),
                    )
                  }
                  className={input}
                />
              </label>
              <button
                type="button"
                aria-label={`Delete tier ${t.name}`}
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTiers([...tiers, { name: 'New tier', weight: 1, attributes: [] }])}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
        >
          <Plus className="size-4" aria-hidden /> Add tier
        </button>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Attributes</h2>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {ATTRS[kind].map((a) => {
            const i = tierIndex(a)
            return (
              <li key={a} className="flex min-h-11 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{attributeLabel(config, a)}</span>
                <select
                  aria-label={`Tier for ${a}`}
                  value={i}
                  onChange={(e) => assign(a, Number(e.target.value))}
                  className="min-h-10 w-36 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                >
                  <option value={-1}>No tier ({w.defaultWeight})</option>
                  {tiers.map((t, j) => (
                    <option key={j} value={j}>
                      {t.name} ({t.weight})
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      </section>
    </SettingsShell>
  )
}
