import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import type { RolePhase } from '../data/roles'
import type { AttributeValue } from '../import/parse'
import { useConfig } from '../lib/config'
import { scoreTextColor } from '../lib/attributes'
import { allRoleFits, scoreColor } from '../lib/roleFit'
import { Tooltip } from './Tooltip'

/** Best roles for a player, in and out of possession. */
export function RoleFitPanel({
  attributes,
  positions,
}: {
  attributes: Record<string, AttributeValue>
  positions: string | null
}) {
  const { roles, roleWeights } = useConfig()
  const [phase, setPhase] = useState<RolePhase>('ip')
  const [natural, setNatural] = useState(true)

  const fits = useMemo(
    () => allRoleFits(attributes, positions, roles, roleWeights),
    [attributes, positions, roles, roleWeights],
  )
  const shown = fits.filter((f) => f.role.phase === phase && (!natural || f.natural)).slice(0, 8)
  if (fits.length === 0) return null

  return (
    <section className="mb-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-1">
        <h2 className="mr-auto text-xs font-semibold text-muted">Best roles</h2>
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group">
          {(
            [
              ['ip', 'In possession'],
              ['oop', 'Out of possession'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
              className={clsx(
                'min-h-8 rounded px-2',
                phase === p ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-h-8 items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={natural} onChange={(e) => setNatural(e.target.checked)} />
          Natural positions only
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">No roles for the player's positions in this phase.</p>
      ) : (
        <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
          {shown.map((f) => (
            <li key={f.role.id} className="flex min-h-9 items-center gap-3 text-sm">
              <Tooltip
                title={f.role.name}
                text={`Key: ${f.role.key.join(', ')}. Preferred: ${f.role.preferred.join(', ')}.`}
              >
                <span tabIndex={0} className="w-48 shrink-0 cursor-help truncate">
                  {f.role.name}
                </span>
              </Tooltip>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={clsx('block h-full rounded-full', scoreColor(f.score))}
                  style={{ width: `${f.score}%` }}
                />
              </span>
              <span
                className={clsx(
                  'w-8 text-right font-semibold tabular-nums',
                  scoreTextColor(f.score),
                )}
              >
                {f.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
