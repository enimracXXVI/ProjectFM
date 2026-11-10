import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatusChip } from '../components/StatusChip'
import { Placeholder } from '../components/ui'
import { usePlayer, useSnapshots } from '../data/hooks'
import { Tooltip } from '../components/Tooltip'
import { isGoalkeeper } from '../data/attributeInfo'
import { CONTRACT_VIEW, STATS_VIEW } from '../data/columns'
import { attributeLabel } from '../data/config'
import { useConfig } from '../lib/config'
import { attrColor, attrNumber, formatAttr } from '../lib/attributes'

export function PlayerDetail() {
  const { id = '' } = useParams()
  const config = useConfig()
  const { data: p, isPending, error } = usePlayer(id)
  const { data: allSnapshots } = useSnapshots(id)
  const snapshots = allSnapshots?.filter((s) => Object.keys(s.attributes).length > 0)
  const latestStats = allSnapshots
    ?.filter((s) => STATS_VIEW.columns.some((c) => s.extra?.[c.key] !== undefined))
    .at(-1)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error || !p) return <Placeholder>{error?.message ?? 'Player not found'}</Placeholder>

  // Compare with the previous import to show development
  const latest = snapshots?.at(-1) ?? null
  const previous = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  // FM layout: three columns, each with one or more sections; empty sections hidden
  const columns = config.layout[isGoalkeeper(p.positions) ? 'goalkeepers' : 'outfield']
    .map((col) =>
      col
        .map((s) => ({
          ...s,
          attributes: s.attributes.filter((n) => p.attributes[n] !== undefined),
        }))
        .filter((s) => s.attributes.length > 0),
    )
    .filter((col) => col.length > 0)

  return (
    <>
      <Link
        to="/squad"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Squad
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {p.squad_number != null && (
          <span className="grid size-12 place-items-center rounded-xl bg-accent/15 text-lg font-bold text-accent">
            {p.squad_number}
          </span>
        )}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {p.name} <StatusChip code={p.extra.status} />
          </h1>
          <p className="text-sm text-muted">
            {p.positions} · {p.age} years · {p.nation}
            {p.second_nation ? ` / ${p.second_nation}` : ''}
            {!p.in_squad && ' · Left the club'}
          </p>
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Info label="Height" value={p.height_cm ? `${p.height_cm} cm` : null} />
        <Info label="Left foot" value={p.left_foot} />
        <Info label="Right foot" value={p.right_foot} />
        <Info label="Personality" value={p.personality} />
        {p.extra.status && (
          <Info label="Status" value={config.statuses[p.extra.status]?.label || p.extra.status} />
        )}
        {p.extra.selection && <Info label="Selection" value={p.extra.selection} />}
        {p.extra.Ability && <Info label="Ability" value={`${p.extra.Ability} ★`} />}
        {p.extra.Potential && <Info label="Potential" value={`${p.extra.Potential} ★`} />}
      </dl>

      {[CONTRACT_VIEW, STATS_VIEW].map((view) => {
        const items = view.columns.filter((c) => p.extra[c.key] !== undefined)
        if (items.length === 0) return null
        return (
          <section key={view.label} className="mb-5">
            <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
              {view.label}
              {view === STATS_VIEW && latestStats?.season ? ` · ${latestStats.season}` : ''}
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {items.map((c) => (
                <Info key={c.key} label={c.key} value={p.extra[c.key]} />
              ))}
            </dl>
          </section>
        )
      })}

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col, ci) => (
          <div key={ci} className="grid content-start gap-4">
            {col.map((section, si) => (
              <section key={si}>
                <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
                  {section.label}
                </h2>
                <ul className="text-sm">
                  {section.attributes.map((n) => {
                    const now = attrNumber(p.attributes[n])
                    const before = previous ? attrNumber(previous.attributes[n]) : null
                    const diff = now !== null && before !== null ? now - before : 0
                    return (
                      <li
                        key={n}
                        className="flex min-h-9 items-center justify-between gap-2 px-3 odd:bg-surface even:bg-surface/40"
                      >
                        <Tooltip
                          title={attributeLabel(config, n)}
                          text={config.attributes[n]?.description || attributeLabel(config, n)}
                        >
                          <span tabIndex={0} className="cursor-help">
                            {attributeLabel(config, n)}
                          </span>
                        </Tooltip>
                        <span className="flex items-center gap-2 tabular-nums">
                          {diff !== 0 && (
                            <span
                              className={
                                diff > 0 ? 'text-xs text-emerald-400' : 'text-xs text-red-400'
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                          <span
                            className={`w-10 rounded bg-surface-2 py-0.5 text-center font-semibold ${attrColor(p.attributes[n])}`}
                          >
                            {formatAttr(p.attributes[n])}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>

      {latest && (
        <p className="mt-4 text-xs text-muted">
          Last updated {new Date(latest.created_at).toLocaleDateString()}
          {latest.season ? ` · season ${latest.season}` : ''}
          {previous &&
            ` · changes compared with ${new Date(previous.created_at).toLocaleDateString()}`}
        </p>
      )}
    </>
  )
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value ?? '–'}</dd>
    </div>
  )
}
