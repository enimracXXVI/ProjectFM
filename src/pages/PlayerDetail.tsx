import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatusChip } from '../components/StatusChip'
import { Card, Placeholder } from '../components/ui'
import { usePlayer, useSnapshots } from '../data/hooks'
import { ATTRIBUTE_GROUPS, STATUS_LABELS } from '../import/fields'
import { attrColor, attrNumber, formatAttr } from '../lib/attributes'

export function PlayerDetail() {
  const { id = '' } = useParams()
  const { data: p, isPending, error } = usePlayer(id)
  const { data: snapshots } = useSnapshots(id)

  if (isPending) return <p className="text-muted text-sm">Loading…</p>
  if (error || !p) return <Placeholder>{error?.message ?? 'Player not found'}</Placeholder>

  // Compare with the previous import to show development
  const previous = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const groups = Object.entries(ATTRIBUTE_GROUPS).filter(([, names]) =>
    names.some((n) => p.attributes[n] !== undefined),
  )

  return (
    <>
      <Link
        to="/squad"
        className="text-muted hover:text-text mb-3 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Squad
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {p.squad_number != null && (
          <span className="bg-accent/15 text-accent grid size-12 place-items-center rounded-xl text-lg font-bold">
            {p.squad_number}
          </span>
        )}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {p.name} <StatusChip code={p.extra.status} />
          </h1>
          <p className="text-muted text-sm">
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
          <Info label="Status" value={STATUS_LABELS[p.extra.status] ?? p.extra.status} />
        )}
        {p.extra.selection && <Info label="Selection" value={p.extra.selection} />}
      </dl>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([group, names]) => (
          <Card key={group}>
            <h2 className="text-muted mb-2 text-sm font-semibold">{group}</h2>
            <ul className="grid gap-0.5 text-sm">
              {names
                .filter((n) => p.attributes[n] !== undefined)
                .map((n) => {
                  const now = attrNumber(p.attributes[n])
                  const before = previous ? attrNumber(previous.attributes[n]) : null
                  const diff = now !== null && before !== null ? now - before : 0
                  return (
                    <li key={n} className="flex min-h-8 items-center justify-between gap-2">
                      <span>{n}</span>
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
                          className={`w-10 text-right font-semibold ${attrColor(p.attributes[n])}`}
                        >
                          {formatAttr(p.attributes[n])}
                        </span>
                      </span>
                    </li>
                  )
                })}
            </ul>
          </Card>
        ))}
      </div>

      <p className="text-muted mt-4 text-xs">
        {snapshots?.length ?? 0} import{snapshots?.length === 1 ? '' : 's'} recorded
        {previous ? ' · changes shown against the previous import' : ''}
      </p>
    </>
  )
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-border bg-surface rounded-lg border px-3 py-2">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-medium">{value ?? '–'}</dd>
    </div>
  )
}
