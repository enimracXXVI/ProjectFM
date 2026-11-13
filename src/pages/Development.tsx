import { clsx } from 'clsx'
import { useMemo } from 'react'
import { useUrlState } from '../lib/urlState'
import { Link } from 'react-router-dom'
import { Sparkline } from '../components/Sparkline'
import { Card, PageHeader, Placeholder, Stat } from '../components/ui'
import { attributeLabel } from '../data/config'
import { useCareerSnapshots, usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { computeDevelopment, type Change } from '../lib/development'

const WINDOWS: [number | null, string][] = [
  [5, 'Last 5'],
  [10, 'Last 10'],
  [20, 'Last 20'],
  [null, 'All'],
]

const date = (iso: string) => new Date(iso).toLocaleDateString()

export function Development() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data: snapshots, isPending, error } = useCareerSnapshots(career.id)
  const { data: players } = usePlayers(career.id)
  const [window, setWindow] = useUrlState<number | null>('last', 5)

  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players])
  const rows = useMemo(
    () =>
      computeDevelopment(snapshots ?? [], window).filter(
        (r) => byId.has(r.playerId) && byId.get(r.playerId)!.in_squad,
      ),
    [snapshots, window, byId],
  )

  if (isPending) return <PageHeader title="Development" subtitle="Loading…" />
  if (error) return <Placeholder>{error.message}</Placeholder>

  const improved = rows.filter((r) => r.gain > 0).length
  const declined = rows.filter((r) => r.gain < 0).length
  const totalGain = rows.reduce((s, r) => s + r.gain, 0)

  const label = (c: Change) => attributeLabel(config, c.name)

  return (
    <>
      <PageHeader
        title="Development"
        subtitle="Attribute changes between imports. Import your squad attributes regularly to track growth."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Imports"
        >
          {WINDOWS.map(([w, text]) => (
            <button
              key={text}
              type="button"
              aria-pressed={window === w}
              onClick={() => setWindow(w)}
              className={clsx(
                'min-h-10 rounded-md px-3 text-sm',
                window === w ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">changes</span>
      </div>

      {rows.length === 0 ? (
        <Placeholder>
          Nothing to compare yet. Development needs at least two imports of your squad attributes
          view.{' '}
          <Link to="/import" className="text-accent underline">
            Import
          </Link>{' '}
          again after some in-game time.
        </Placeholder>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="Improved" value={<span className="text-emerald-400">{improved}</span>} />
            <Stat label="Declined" value={<span className="text-red-400">{declined}</span>} />
            <Stat
              label="Squad total"
              value={
                <span className={totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {totalGain > 0 ? '+' : ''}
                  {totalGain}
                </span>
              }
            />
          </div>

          <ul className="grid gap-2">
            {rows.map((r) => {
              const p = byId.get(r.playerId)!
              const ups = r.changes.filter((c) => c.diff > 0).slice(0, 4)
              const downs = r.changes
                .filter((c) => c.diff < 0)
                .slice(-3)
                .reverse()
              return (
                <li key={r.playerId}>
                  <Card className={clsx('p-3', !p.in_squad && 'opacity-60')}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link to={`/squad/${p.id}`} className="font-semibold hover:text-accent">
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {[p.positions, p.age && `${p.age} yrs`].filter(Boolean).join(' · ')} ·{' '}
                          {r.imports} imports, {date(r.from)} → {date(r.to)}
                        </p>
                      </div>
                      <Sparkline values={r.trend} width={72} />
                      <span
                        className={clsx(
                          'w-12 shrink-0 text-right text-xl font-semibold tabular-nums',
                          r.gain > 0
                            ? 'text-emerald-400'
                            : r.gain < 0
                              ? 'text-red-400'
                              : 'text-muted',
                        )}
                      >
                        {r.gain > 0 ? '+' : ''}
                        {r.gain}
                      </span>
                    </div>
                    {(ups.length > 0 || downs.length > 0) && (
                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {ups.map((c) => (
                          <span key={c.name} className="text-emerald-400">
                            {label(c)} +{c.diff}
                          </span>
                        ))}
                        {downs.map((c) => (
                          <span key={c.name} className="text-red-400">
                            {label(c)} {c.diff}
                          </span>
                        ))}
                      </p>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
