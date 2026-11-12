import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DbUpdateNotice } from '../components/DbUpdateNotice'
import { PageHeader, Placeholder } from '../components/ui'
import type { StaffRow } from '../data/db'
import { useStaff } from '../data/hooks'
import { GROUP_COLUMNS, STAFF_GROUPS, groupOf, jobOrder, type StaffGroup } from '../data/staffJobs'
import { ratingColor } from '../data/staffInfo'
import { TEAMS, type Team } from '../data/teams'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { byLastName, shortName } from '../lib/names'
import { valueOf, wordOf } from '../lib/valueWord'
import { Tabs } from './competitionParts'

const teamOfStaff = (s: StaffRow): Team => (s.team === 'u21' || s.team === 'u18' ? s.team : 'first')

/** All staff, first team and youth teams, grouped like FM's staff screen. */
export function Staff() {
  const career = useCurrentCareer()
  const { data, isPending, error } = useStaff(career.id)
  const [team, setTeam] = useState<Team | 'all'>('all')
  const all = data ?? []
  // Staff imported before migration 0007 have no team or job code
  const needsUpdate = all.length > 0 && all.every((s) => s.job_code === undefined)
  const { staffGroups } = useConfig()
  const list = all.filter((s) => team === 'all' || teamOfStaff(s) === team)
  const groups = STAFF_GROUPS.map(
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
          onChange={setTeam}
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
      <div className="grid gap-6">
        {groups.map(([g, label, rows]) =>
          rows.length ? (
            <StaffTable key={g} group={g} label={label} rows={rows} showTeam={team === 'all'} />
          ) : null,
        )}
      </div>
    </>
  )
}

function StaffTable({
  group,
  label,
  rows,
  showTeam,
}: {
  group: StaffGroup
  label: string
  rows: StaffRow[]
  showTeam: boolean
}) {
  const { staffScale } = useConfig()
  const columns = GROUP_COLUMNS[group]
  const sorted = [...rows].sort((a, b) => jobOrder(a.role) - jobOrder(b.role) || byLastName(a, b))
  const teamLabel = (s: StaffRow) => TEAMS.find(([t]) => t === teamOfStaff(s))?.[1]
  return (
    <section>
      <h2 className="mb-2 font-semibold">
        {rows.length} {label}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="sticky left-0 z-[1] bg-surface-2 px-3 py-2">Name</th>
              <th className="px-3 py-2">Job</th>
              {showTeam && <th className="px-3 py-2">Team</th>}
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2">Personality</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-2 text-center" title={c}>
                  {SHORT[c] ?? c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface">
            {sorted.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="sticky left-0 z-[1] bg-surface px-3 py-2 whitespace-nowrap">
                  <Link to={`/staff/${s.id}`} className="font-medium hover:text-accent">
                    {shortName(s)}
                  </Link>
                  <span className="ml-1 hidden text-xs text-muted sm:inline">{s.nation}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-accent">{s.role ?? '–'}</td>
                {showTeam && (
                  <td className="px-3 py-2 whitespace-nowrap text-muted">{teamLabel(s)}</td>
                )}
                <td className="px-3 py-2 text-right tabular-nums">{s.age ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{s.personality ?? '–'}</td>
                {columns.map((c) => {
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

/** Column headers (full name on hover). */
const SHORT: Record<string, string> = {
  Attacking: 'ATT',
  Defending: 'DEF',
  Fitness: 'FIT',
  Goalkeeping: 'GK',
  Possession: 'POS',
  Tactical: 'TAC',
  Technical: 'TEC',
  'Set Pieces': 'SP',
  'Working With Youngsters': 'YTH',
  Motivating: 'MOT',
  'Judging Player Ability': 'JPA',
  'Judging Player Potential': 'JPP',
  'Analysing Data': 'DATA',
  'Judging Staff Ability': 'JSA',
  Negotiating: 'NEG',
  Adaptability: 'ADA',
  Authority: 'AUT',
  Physiotherapy: 'PHY',
  'Sports Science': 'SCI',
  'People Management': 'MAN',
  Determination: 'DET',
}
