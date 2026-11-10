import { clsx } from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusChip } from '../components/StatusChip'
import { Tooltip } from '../components/Tooltip'
import { PageHeader, Placeholder } from '../components/ui'
import { FIELD_INFO, isGoalkeeper } from '../data/attributeInfo'
import { attributeLabel, tableSections } from '../data/config'
import type { PlayerRow } from '../data/db'
import { usePlayers } from '../data/hooks'
import { attrColor, attrNumber, formatAttr } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { sortValue } from '../lib/values'

type View = 'profile' | 'attributes' | 'contract' | 'stats'
type Role = 'outfield' | 'goalkeepers'
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
  { key: 'ability', label: 'Ability', get: (p) => sortValue(p.extra.Ability) },
  { key: 'potential', label: 'Potential', get: (p) => sortValue(p.extra.Potential) },
]

const STAR_KEYS = new Set(['ability', 'potential'])

const PROFILE_KEYS = new Set(PROFILE_COLS.map((c) => c.key))

export function Squad() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data, isPending, error } = usePlayers(career.id)
  const [view, setView] = useState<View>('profile')
  const [role, setRole] = useState<Role>('outfield')
  const [filter, setFilter] = useState('')
  const [showLeft, setShowLeft] = useState(false)
  const [sort, setSort] = useState<SortKey>({ col: 'squad_number', asc: true })

  const players = useMemo(() => {
    const q = filter.toLowerCase()
    const list = (data ?? []).filter(
      (p) =>
        (showLeft || p.in_squad) &&
        (view === 'profile' || isGoalkeeper(p.positions) === (role === 'goalkeepers')) &&
        (!q || p.name.toLowerCase().includes(q) || (p.positions ?? '').toLowerCase().includes(q)),
    )
    const value = (p: PlayerRow): string | number | null => {
      if (sort.col === 'name') return p.name
      if (sort.col.startsWith('x:')) return sortValue(p.extra[sort.col.slice(2)])
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
  }, [data, filter, showLeft, sort, view, role])

  // Only sections/columns that have data for the players shown
  const sections = useMemo(
    () =>
      tableSections(config.layout, role)
        .map((s) => ({
          ...s,
          attributes: s.attributes.filter((a) =>
            players.some((p) => p.attributes[a] !== undefined),
          ),
        }))
        .filter((s) => s.attributes.length > 0),
    [role, players, config.layout],
  )

  // Contract / stats columns that have data
  const extraView = view === 'contract' || view === 'stats' ? config.views[view] : undefined
  const extraCols = useMemo(
    () =>
      (extraView?.columns ?? []).filter((c) => players.some((p) => p.extra[c.key] !== undefined)),
    [extraView, players],
  )

  // Attributes read best highest-first; text/profile columns lowest-first
  const toggleSort = (col: string) =>
    setSort((s) =>
      s.col === col
        ? { col, asc: !s.asc }
        : { col, asc: col === 'name' || (PROFILE_KEYS.has(col) && !STAR_KEYS.has(col)) },
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
          <div className="flex gap-4">
            <Link to="/development" className="text-sm font-semibold text-accent">
              Development
            </Link>
            <Link to="/import" className="text-sm font-semibold text-accent">
              Import squad
            </Link>
          </div>
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
              className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-base md:max-w-xs md:text-sm"
            />
            <div className="hidden gap-2 md:flex">
              <Segmented
                label="Columns"
                value={view}
                onChange={setView}
                options={[
                  ['profile', 'Profile'],
                  ['attributes', 'Attributes'],
                  ['contract', 'Contract'],
                  ['stats', 'Stats'],
                ]}
              />
              {view === 'attributes' && (
                <Segmented
                  label="Players"
                  value={role}
                  onChange={setRole}
                  options={[
                    ['outfield', 'Outfield'],
                    ['goalkeepers', 'Goalkeepers'],
                  ]}
                />
              )}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
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
                    'block rounded-xl border border-border bg-surface p-3 active:bg-surface-2',
                    !p.in_squad && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right text-sm text-muted tabular-nums">
                      {p.squad_number ?? ''}
                    </span>
                    <span className="font-semibold">{p.name}</span>
                    <StatusChip code={p.extra.status} />
                    <span className="ml-auto text-sm text-muted">{p.age}</span>
                  </div>
                  <p className="mt-0.5 pl-8 text-xs text-muted">
                    {p.positions} · {p.nation}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet / desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs tracking-wide text-muted uppercase">
                {view === 'attributes' && (
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-[1] bg-surface-2 shadow-[inset_-1px_0_0_var(--color-border)]" />
                    {sections.map((s, i) => (
                      <th
                        key={i}
                        colSpan={s.attributes.length}
                        className="border-l-2 border-border px-2 pt-2 pb-1 text-center font-semibold text-text/80"
                      >
                        {s.label}
                      </th>
                    ))}
                  </tr>
                )}
                <tr>
                  <SortHeader
                    col="name"
                    label="Player"
                    info={FIELD_INFO.Player}
                    sort={sort}
                    onSort={toggleSort}
                    sticky
                  />
                  {extraView
                    ? extraCols.map((c) => (
                        <SortHeader
                          key={c.key}
                          col={`x:${c.key}`}
                          label={c.short}
                          title={c.label || c.key}
                          info={c.description || undefined}
                          showTitleOnly
                          sort={sort}
                          onSort={toggleSort}
                          compact
                        />
                      ))
                    : view === 'profile'
                      ? PROFILE_COLS.map((c) => (
                          <SortHeader
                            key={c.key}
                            col={c.key}
                            label={c.label}
                            info={FIELD_INFO[c.label]}
                            sort={sort}
                            onSort={toggleSort}
                          />
                        ))
                      : sections.flatMap((s) =>
                          s.attributes.map((a, i) => (
                            <SortHeader
                              key={a}
                              col={a}
                              label={config.attributes[a]?.abbr || a.slice(0, 3)}
                              title={attributeLabel(config, a)}
                              info={config.attributes[a]?.description || undefined}
                              sort={sort}
                              onSort={toggleSort}
                              compact
                              separator={i === 0}
                            />
                          )),
                        )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface tabular-nums">
                {players.map((p) => (
                  <tr
                    key={p.id}
                    className={clsx(
                      'group bg-surface hover:bg-surface-2',
                      // Fade former players' cells (not the row: the frozen cell must stay opaque)
                      !p.in_squad && '[&>td]:text-muted [&>td>*]:opacity-50',
                    )}
                  >
                    <td className="sticky left-0 z-[1] bg-surface px-4 py-2.5 whitespace-nowrap shadow-[inset_-1px_0_0_var(--color-border)] group-hover:bg-surface-2">
                      <Link to={`/squad/${p.id}`} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>{' '}
                      <StatusChip code={p.extra.status} />
                    </td>
                    {extraView
                      ? extraCols.map((c) => (
                          <td key={c.key} className="px-2 py-2.5 text-center whitespace-nowrap">
                            <span>{p.extra[c.key] ?? '–'}</span>
                          </td>
                        ))
                      : view === 'profile'
                        ? PROFILE_COLS.map((c) => (
                            <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-muted">
                              <span>
                                {c.key === 'height_cm' && p.height_cm
                                  ? `${p.height_cm} cm`
                                  : STAR_KEYS.has(c.key)
                                    ? (p.extra[c.label] ?? '–')
                                    : (c.get(p) ?? '–')}
                              </span>
                            </td>
                          ))
                        : sections.flatMap((s) =>
                            s.attributes.map((a, i) => (
                              <td
                                key={a}
                                className={clsx(
                                  'px-1.5 py-2.5 text-center font-semibold',
                                  i === 0 && 'border-l-2 border-border',
                                  attrColor(p.attributes[a]),
                                )}
                              >
                                <span>{formatAttr(p.attributes[a])}</span>
                              </td>
                            )),
                          )}
                  </tr>
                ))}
              </tbody>
            </table>
            {players.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No {view === 'attributes' ? role : 'players'} match.
              </p>
            )}
            {extraView && extraCols.length === 0 && players.length > 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No {extraView.label.toLowerCase()} data yet.{' '}
                <Link to="/import" className="text-accent underline">
                  Import
                </Link>{' '}
                an FM {extraView.label.toLowerCase()} view.
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            'min-h-10 rounded-md px-3 text-sm',
            value === v ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function SortHeader({
  col,
  label,
  title,
  info,
  sort,
  onSort,
  sticky,
  compact,
  separator,
  showTitleOnly,
}: {
  col: string
  label: string
  title?: string
  info?: string
  sort: SortKey
  onSort: (col: string) => void
  sticky?: boolean
  compact?: boolean
  separator?: boolean
  /** Show the tooltip even without a description (title only) when it adds information. */
  showTitleOnly?: boolean
}) {
  const active = sort.col === col
  const Icon = sort.asc ? ChevronUp : ChevronDown
  const button = (
    <button
      type="button"
      aria-label={title ?? label}
      onClick={() => onSort(col)}
      className={clsx(
        'inline-flex min-h-10 items-center gap-0.5 whitespace-nowrap uppercase',
        active && 'text-text',
      )}
    >
      {label}
      {active && <Icon className="size-3.5" aria-hidden />}
    </button>
  )
  return (
    <th
      className={clsx(
        sticky && 'sticky left-0 z-[1] bg-surface-2 shadow-[inset_-1px_0_0_var(--color-border)]',
        compact ? 'px-1.5 text-center' : 'px-4',
        separator && 'border-l-2 border-border',
      )}
      aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
    >
      {info || (showTitleOnly && title && title !== label) ? (
        <Tooltip title={title} text={info}>
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </th>
  )
}
