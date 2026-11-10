import { clsx } from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusChip } from '../components/StatusChip'
import { PageHeader, Placeholder } from '../components/ui'
import type { PlayerRow } from '../data/db'
import { usePlayers } from '../data/hooks'
import { ATTRIBUTE_GROUPS } from '../import/fields'
import { attrColor, attrNumber, formatAttr } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'

type View = 'profile' | 'attributes'
type SortKey = { col: string; asc: boolean }

const PROFILE_COLS: {
  key: string
  label: string
  get: (p: PlayerRow) => string | number | null
}[] = [
  { key: 'squad_number', label: 'No.', get: (p) => p.squad_number },
  { key: 'positions', label: 'Position', get: (p) => p.positions },
  { key: 'age', label: 'Age', get: (p) => p.age },
  { key: 'nation', label: 'Nation', get: (p) => p.nation },
  { key: 'height_cm', label: 'Height', get: (p) => p.height_cm },
  { key: 'left_foot', label: 'Left', get: (p) => p.left_foot },
  { key: 'right_foot', label: 'Right', get: (p) => p.right_foot },
  { key: 'personality', label: 'Personality', get: (p) => p.personality },
]

const ATTR_COLS = [
  ...ATTRIBUTE_GROUPS.Technical,
  ...ATTRIBUTE_GROUPS.Mental,
  ...ATTRIBUTE_GROUPS.Physical,
]

export function Squad() {
  const career = useCurrentCareer()
  const { data, isPending, error } = usePlayers(career.id)
  const [view, setView] = useState<View>('profile')
  const [filter, setFilter] = useState('')
  const [showLeft, setShowLeft] = useState(false)
  const [sort, setSort] = useState<SortKey>({ col: 'squad_number', asc: true })

  const players = useMemo(() => {
    const q = filter.toLowerCase()
    const list = (data ?? []).filter(
      (p) =>
        (showLeft || p.in_squad) &&
        (!q || p.name.toLowerCase().includes(q) || (p.positions ?? '').toLowerCase().includes(q)),
    )
    const value = (p: PlayerRow): string | number | null => {
      if (sort.col === 'name') return p.name
      const profile = PROFILE_COLS.find((c) => c.key === sort.col)
      return profile ? profile.get(p) : attrNumber(p.attributes[sort.col])
    }
    return list.sort((a, b) => {
      const [x, y] = [value(a), value(b)]
      if (x === y) return a.name.localeCompare(b.name)
      if (x === null) return 1
      if (y === null) return -1
      const r =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.asc ? r : -r
    })
  }, [data, filter, showLeft, sort])

  const toggleSort = (col: string) =>
    setSort((s) =>
      s.col === col ? { col, asc: !s.asc } : { col, asc: !ATTR_COLS.includes(col as never) },
    )

  if (isPending) return <PageHeader title="Squad" subtitle="Loading…" />
  if (error) return <Placeholder>{error.message}</Placeholder>

  const total = (data ?? []).filter((p) => p.in_squad).length

  return (
    <>
      <PageHeader
        title="Squad"
        subtitle={`${total} players · ${career.current_season ?? ''}`}
        actions={
          <Link to="/import" className="text-accent text-sm font-semibold">
            Import squad
          </Link>
        }
      />

      {total === 0 && !showLeft ? (
        <Placeholder>
          No players yet.{' '}
          <Link to="/import" className="text-accent underline">
            Import your squad
          </Link>{' '}
          from an FM export.
        </Placeholder>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Filter by name or position"
              aria-label="Filter players"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border-border bg-surface min-h-11 flex-1 rounded-lg border px-3 text-base md:max-w-xs md:text-sm"
            />
            <div
              className="border-border hidden rounded-lg border p-0.5 md:flex"
              role="group"
              aria-label="Columns"
            >
              {(['profile', 'attributes'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'min-h-10 rounded-md px-3 text-sm capitalize',
                    view === v ? 'bg-surface-2 text-text' : 'text-muted',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="text-muted flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLeft}
                onChange={(e) => setShowLeft(e.target.checked)}
              />
              Show former players
            </label>
          </div>

          {/* Phones: cards */}
          <ul className="grid gap-2 md:hidden">
            {players.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/squad/${p.id}`}
                  className={clsx(
                    'border-border bg-surface active:bg-surface-2 block rounded-xl border p-3',
                    !p.in_squad && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted w-6 text-right text-sm tabular-nums">
                      {p.squad_number ?? ''}
                    </span>
                    <span className="font-semibold">{p.name}</span>
                    <StatusChip code={p.extra.status} />
                    <span className="text-muted ml-auto text-sm">{p.age}</span>
                  </div>
                  <p className="text-muted mt-0.5 pl-8 text-xs">
                    {p.positions} · {p.nation}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet / desktop: table */}
          <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left text-xs tracking-wide uppercase">
                <tr>
                  <SortHeader col="name" label="Player" sort={sort} onSort={toggleSort} sticky />
                  {view === 'profile'
                    ? PROFILE_COLS.map((c) => (
                        <SortHeader
                          key={c.key}
                          col={c.key}
                          label={c.label}
                          sort={sort}
                          onSort={toggleSort}
                        />
                      ))
                    : ATTR_COLS.map((a) => (
                        <SortHeader
                          key={a}
                          col={a}
                          label={short(a)}
                          title={a}
                          sort={sort}
                          onSort={toggleSort}
                          compact
                        />
                      ))}
                </tr>
              </thead>
              <tbody className="divide-border bg-surface divide-y tabular-nums">
                {players.map((p) => (
                  <tr
                    key={p.id}
                    className={clsx('hover:bg-surface-2', !p.in_squad && 'opacity-50')}
                  >
                    <td className="sticky left-0 z-[1] bg-inherit px-4 py-2.5 whitespace-nowrap">
                      <Link to={`/squad/${p.id}`} className="hover:text-accent font-medium">
                        {p.name}
                      </Link>{' '}
                      <StatusChip code={p.extra.status} />
                    </td>
                    {view === 'profile'
                      ? PROFILE_COLS.map((c) => (
                          <td key={c.key} className="text-muted px-4 py-2.5 whitespace-nowrap">
                            {c.key === 'height_cm' && p.height_cm
                              ? `${p.height_cm} cm`
                              : (c.get(p) ?? '–')}
                          </td>
                        ))
                      : ATTR_COLS.map((a) => (
                          <td
                            key={a}
                            className={clsx(
                              'px-1.5 py-2.5 text-center font-semibold',
                              attrColor(p.attributes[a]),
                            )}
                          >
                            {formatAttr(p.attributes[a])}
                          </td>
                        ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

/** "Free Kick Taking" -> "Fre", "Off The Ball" -> "OtB": FM-style short headers. */
function short(name: string): string {
  const words = name.split(' ')
  return words.length > 1
    ? words.map((w, i) => (i === 0 ? w[0].toUpperCase() : w[0])).join('')
    : name.slice(0, 3)
}

function SortHeader({
  col,
  label,
  title,
  sort,
  onSort,
  sticky,
  compact,
}: {
  col: string
  label: string
  title?: string
  sort: SortKey
  onSort: (col: string) => void
  sticky?: boolean
  compact?: boolean
}) {
  const active = sort.col === col
  const Icon = sort.asc ? ChevronUp : ChevronDown
  return (
    <th
      className={clsx(sticky && 'bg-surface-2 sticky left-0 z-[1]', compact ? 'px-1.5' : 'px-4')}
      aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSort(col)}
        className={clsx(
          'inline-flex min-h-10 items-center gap-0.5 uppercase',
          active && 'text-text',
        )}
      >
        {label}
        {active && <Icon className="size-3.5" aria-hidden />}
      </button>
    </th>
  )
}
