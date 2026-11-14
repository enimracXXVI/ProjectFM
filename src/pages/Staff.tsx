import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { DbUpdateNotice } from '../components/DbUpdateNotice'
import { PageHeader, Placeholder } from '../components/ui'
import type { StaffRow } from '../data/db'
import { useStaff } from '../data/hooks'
import { STAFF_GROUPS, groupOf, jobOrder, type StaffGroup } from '../data/staffJobs'
import { ATTRIBUTE_GROUPS, ratingColor } from '../data/staffInfo'
import { TEAMS, type Team } from '../data/teams'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { byLastName } from '../lib/names'
import { valueOf, wordOf } from '../lib/valueWord'
import { Tabs } from './competitionParts'

const teamOfStaff = (s: StaffRow): Team => (s.team === 'u21' || s.team === 'u18' ? s.team : 'first')

/** All staff, first team and youth teams, grouped like FM's staff screen. */
export function Staff() {
  const career = useCurrentCareer()
  const { data, isPending, error } = useStaff(career.id)
  // Filters and sort live in the URL, so going back to this page keeps them
  const [params, setParams] = useSearchParams()
  const team = (params.get('team') ?? 'all') as Team | 'all'
  const category = (params.get('category') ?? 'all') as StaffGroup | 'all'
  const sort: Sort = { col: params.get('sort') ?? '', asc: params.get('dir') !== 'desc' }
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
  const onSort = (col: string) => {
    // Names and text sort A–Z first; numbers highest first
    const firstAsc = col === 'name' || col === 'job' || col === 'personality' || col === 'team'
    const asc = sort.col === col ? !sort.asc : firstAsc
    setParam({ sort: col, dir: asc ? 'asc' : 'desc' })
  }
  const all = data ?? []
  // Staff imported before migration 0007 have no team or job code
  const needsUpdate = all.length > 0 && all.every((s) => s.job_code === undefined)
  const { staffGroups } = useConfig()
  const list = all.filter((s) => team === 'all' || teamOfStaff(s) === team)
  const groups = STAFF_GROUPS.filter(([g]) => category === 'all' || g === category).map(
    ([g, label]) =>
      [g, label, list.filter((s) => groupOf(s.role, staffGroups) === g)] as [
        StaffGroup,
        string,
        StaffRow[],
      ],
  )

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={data ? `${all.length} members` : 'Loading…'}
        actions={
          <Link
            to="/staff/new"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-strong"
          >
            <Plus className="size-4" aria-hidden /> Add staff
          </Link>
        }
      />
      {needsUpdate && (
        <div className="mb-4">
          <DbUpdateNotice update="0007" />
          <p className="mt-2 text-sm text-muted">
            Then import your save again: every member of staff comes in, not only the scouts.
          </p>
        </div>
      )}
      {error && <Placeholder>{error.message}</Placeholder>}
      {!isPending && all.length === 0 && (
        <Placeholder>No staff yet. Import your FM save to bring in all your staff.</Placeholder>
      )}
      {all.length > 0 && (
        <Tabs
          value={team}
          onChange={(v) => setParam({ team: v === 'all' ? null : v })}
          options={[
            ['all', `All (${all.length})`],
            ...TEAMS.map(
              ([t, label]) =>
                [t, `${label} (${all.filter((s) => teamOfStaff(s) === t).length})`] as [
                  Team,
                  string,
                ],
            ),
          ]}
        />
      )}
      {all.length > 0 && (
        <Tabs
          value={category}
          onChange={(v) => setParam({ category: v === 'all' ? null : v })}
          options={[
            ['all', 'All jobs'],
            ...STAFF_GROUPS.map(
              ([g, label]) =>
                [
                  g,
                  `${label.replace(/ Staff$/, '')} (${list.filter((s) => groupOf(s.role, staffGroups) === g).length})`,
                ] as [StaffGroup, string],
            ),
          ]}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        {groups.map(([g, label, rows]) =>
          rows.length ? (
            <StaffTable
              key={g}
              label={label}
              rows={rows}
              showTeam={team === 'all'}
              sort={sort}
              onSort={onSort}
            />
          ) : null,
        )}
      </div>
    </>
  )
}

interface Sort {
  col: string
  asc: boolean
}

/** Every staff attribute, in Settings' order (Coaching, Scouting, Medical, Mental, Knowledge). */
const ALL_ATTRS = ATTRIBUTE_GROUPS.flatMap((g) => g.attributes)

const teamOrder = (s: StaffRow) => TEAMS.findIndex(([t]) => t === teamOfStaff(s))

function sortValue(s: StaffRow, col: string): number | string | null {
  if (col === 'name') return null
  if (col === 'job') return jobOrder(s.role)
  if (col === 'team') return teamOrder(s)
  if (col === 'age') return s.age
  if (col === 'personality') return s.personality ?? null
  const v = s.attributes[col]
  return v ? valueOf(v) : null
}

function StaffTable({
  label,
  rows,
  showTeam,
  sort,
  onSort,
}: {
  label: string
  rows: StaffRow[]
  showTeam: boolean
  sort: Sort
  onSort: (col: string) => void
}) {
  const { staffScale, staffShort } = useConfig()
  const sorted = [...rows].sort((a, b) => {
    if (sort.col === 'name') return sort.asc ? byLastName(a, b) : byLastName(b, a)
    if (sort.col) {
      const x = sortValue(a, sort.col)
      const y = sortValue(b, sort.col)
      // Empty values always last
      if (x === null && y !== null) return 1
      if (y === null && x !== null) return -1
      if (x !== null && y !== null && x !== y) {
        const c =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))
        if (c) return sort.asc ? c : -c
      }
    }
    return jobOrder(a.role) - jobOrder(b.role) || byLastName(a, b)
  })
  const teamLabel = (s: StaffRow) => TEAMS.find(([t]) => t === teamOfStaff(s))?.[1]
  const head = (col: string, text: string, title: string, className?: string) => {
    const active = sort.col === col
    const Icon = sort.asc ? ChevronUp : ChevronDown
    return (
      <th
        key={col}
        className={clsx('px-2 py-1', className)}
        aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          title={title}
          onClick={() => onSort(col)}
          className={clsx(
            'inline-flex min-h-9 items-center gap-0.5 whitespace-nowrap uppercase',
            active && 'text-text',
          )}
        >
          {text}
          {active && <Icon className="size-3.5" aria-hidden />}
        </button>
      </th>
    )
  }
  return (
    <section>
      <h2 className="mb-2 font-semibold">
        {rows.length} {label}
      </h2>
      <div className="max-h-[calc(100dvh-9rem)] overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[2] bg-surface-2 text-left text-xs text-muted">
            <tr>
              {head('name', 'Name', 'Name', 'sticky left-0 z-[1] bg-surface-2 pl-3')}
              {head('job', 'Job', 'Job')}
              {showTeam && head('team', 'Team', 'Team')}
              {head('age', 'Age', 'Age', 'text-right')}
              {head('personality', 'Personality', 'Personality')}
              {ALL_ATTRS.map((c) => head(c, staffShort[c] ?? c, c, 'text-center'))}
            </tr>
          </thead>
          <tbody className="bg-surface">
            {sorted.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="sticky left-0 z-[1] bg-surface px-3 py-2 whitespace-nowrap">
                  <Link to={`/staff/${s.id}`} className="font-medium hover:text-accent">
                    {s.name}
                  </Link>
                  <span className="ml-1 hidden text-xs text-muted sm:inline">{s.nation}</span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-accent">{s.role ?? '–'}</td>
                {showTeam && (
                  <td className="px-2 py-2 whitespace-nowrap text-muted">{teamLabel(s)}</td>
                )}
                <td className="px-2 py-2 text-right tabular-nums">{s.age ?? '–'}</td>
                <td className="px-2 py-2 whitespace-nowrap text-muted">{s.personality ?? '–'}</td>
                {ALL_ATTRS.map((c) => {
                  const v = s.attributes[c]
                  return (
                    <td
                      key={c}
                      title={v ? `${c}: ${wordOf(v)}` : c}
                      className={clsx(
                        'px-2 py-2 text-center font-semibold tabular-nums',
                        ratingColor(v, staffScale),
                      )}
                    >
                      {v ? (valueOf(v) ?? wordOf(v)) : '–'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
