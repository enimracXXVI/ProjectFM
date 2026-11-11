import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { parsePositions, roleScore, scoreColor } from '../lib/roleFit'
import { useWorld } from '../world/hooks'
import { eur } from '../lib/money'
import { regionLookup, rowToPlayer, searchKey, type WorldRow } from '../world/world'

const POSITIONS = [
  'GK',
  'D (C)',
  'D (L)',
  'D (R)',
  'WB (L)',
  'WB (R)',
  'DM',
  'M (C)',
  'M (L)',
  'M (R)',
  'AM (C)',
  'AM (L)',
  'AM (R)',
  'ST (C)',
]
const PAGE = 100

const input = 'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm'

type SortCol = 'name' | 'age' | 'role' | 'ca' | 'pa' | 'value'

export function World() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data, isPending, error } = useWorld(career.id)

  const [name, setName] = useState('')
  const [positions, setPositions] = useState<string[]>([])
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [regionId, setRegionId] = useState('')
  const [nation, setNation] = useState('')
  const [club, setClub] = useState('')
  const [roleId, setRoleId] = useState('')
  const [caMin, setCaMin] = useState('')
  const [paMin, setPaMin] = useState('')
  const [hideMine, setHideMine] = useState(true)
  const [listedOnly, setListedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<{ col: SortCol; asc: boolean } | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const filters = useDeferredValue({
    name,
    positions,
    ageMin,
    ageMax,
    regionId,
    nation,
    club,
    roleId,
    caMin,
    paMin,
    hideMine,
    listedOnly,
  })

  const regionOf = useMemo(() => regionLookup(config.regions), [config.regions])
  const role = config.roles.find((r) => r.id === filters.roleId)
  const nations = useMemo(
    () => [...new Set((data?.file.rows ?? []).map((r) => r[3]).filter(Boolean) as string[])].sort(),
    [data],
  )

  const results = useMemo(() => {
    if (!data) return []
    const file = data.file
    const f = filters
    const q = searchKey(f.name.trim())
    const clubQ = searchKey(f.club.trim())
    const nat = f.nation.trim().toLowerCase()
    const amin = f.ageMin ? Number(f.ageMin) : null
    const amax = f.ageMax ? Number(f.ageMax) : null
    const cmin = config.showHidden && f.caMin ? Number(f.caMin) : null
    const pmin = config.showHidden && f.paMin ? Number(f.paMin) : null
    const wanted = new Set(f.positions)
    const myClub = file.meta.myClub

    const out: { row: WorldRow; score: number | null }[] = []
    for (const r of file.rows) {
      if (f.hideMine && r[5] && r[5] === myClub) continue
      if (f.listedOnly && !r[14]) continue
      if (amin !== null && (r[2] ?? 0) < amin) continue
      if (amax !== null && (r[2] ?? 99) > amax) continue
      if (cmin !== null && (r[9] ?? 0) < cmin) continue
      if (pmin !== null && (r[10] ?? 0) < pmin) continue
      if (nat && (r[3] ?? '').toLowerCase() !== nat && (r[4] ?? '').toLowerCase() !== nat) continue
      if (f.regionId && regionOf(r[3]) !== f.regionId) continue
      if (q && !searchKey(r[1]).includes(q)) continue
      if (clubQ && !searchKey(`${r[5] ?? ''} ${r[6] ?? ''}`).includes(clubQ)) continue
      if (wanted.size && !parsePositions(r[7]).some((p) => wanted.has(p))) continue
      out.push({ row: r, score: null })
    }
    if (role) {
      for (const o of out) {
        o.score = roleScore(rowToPlayer(file, o.row).attributes, role, config.roleWeights)
      }
    }
    const col: SortCol = sort?.col ?? (role ? 'role' : config.showHidden ? 'ca' : 'name')
    const asc = sort?.asc ?? col === 'name'
    const val = (o: (typeof out)[number]): number | string | null =>
      col === 'name'
        ? o.row[1]
        : col === 'age'
          ? o.row[2]
          : col === 'role'
            ? o.score
            : col === 'ca'
              ? o.row[9]
              : col === 'pa'
                ? o.row[10]
                : o.row[11]
    return out.sort((a, b) => {
      const [x, y] = [val(a), val(b)]
      if (x === y) return 0
      if (x === null) return 1
      if (y === null) return -1
      const d =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return asc ? d : -d
    })
  }, [data, filters, role, config.roleWeights, config.showHidden, regionOf, sort])

  if (isPending)
    return (
      <>
        <PageHeader title="World" />
        <Placeholder>Opening the world database…</Placeholder>
      </>
    )
  if (error) return <Placeholder>{error.message}</Placeholder>
  if (!data)
    return (
      <>
        <PageHeader title="World" />
        <Placeholder>
          No world database yet. On your PC, press F9 in FM with FMSuperScout running, then{' '}
          <Link to="/import" className="text-accent underline">
            import dump.json
          </Link>{' '}
          with “Save world database” ticked.
        </Placeholder>
      </>
    )

  const toggleSort = (col: SortCol) =>
    setSort((s) => (s?.col === col ? { col, asc: !s.asc } : { col, asc: col === 'name' }))
  const sortIcon = (col: SortCol): typeof ChevronUp | null =>
    (sort?.col ?? (role ? 'role' : config.showHidden ? 'ca' : 'name')) === col
      ? (sort?.asc ?? col === 'name')
        ? ChevronUp
        : ChevronDown
      : null

  const shown = results.slice(0, limit)

  return (
    <>
      <PageHeader
        title="World"
        subtitle={`${data.file.rows.length.toLocaleString()} players · FM date ${data.file.meta.gameDate ?? '?'} · ${
          data.fromCache ? 'copy on this device' : 'just downloaded'
        }`}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="search"
            placeholder="Search name"
            aria-label="Search name"
            value={name}
            onChange={(e) => (setName(e.target.value), setLimit(PAGE))}
            className={`${input} flex-1 sm:max-w-xs`}
          />
          <select
            aria-label="Rank by role"
            value={roleId}
            onChange={(e) => (setRoleId(e.target.value), setSort(null))}
            className={`${input} sm:w-64`}
          >
            <option value="">Rank by role…</option>
            {(['ip', 'oop'] as const).map((phase) => (
              <optgroup key={phase} label={phase === 'ip' ? 'In possession' : 'Out of possession'}>
                {config.roles
                  .filter((r) => r.phase === phase)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {POSITIONS.map((p) => {
                const on = positions.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPositions(on ? positions.filter((x) => x !== p) : [...positions, p])
                    }
                    className={clsx(
                      'min-h-9 rounded-full border px-3 text-sm',
                      on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted',
                    )}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <input
                aria-label="Minimum age"
                placeholder="Age from"
                inputMode="numeric"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className={input}
              />
              <input
                aria-label="Maximum age"
                placeholder="Age to"
                inputMode="numeric"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className={input}
              />
              <select
                aria-label="Region"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className={input}
              >
                <option value="">Any region</option>
                {config.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Nationality"
                placeholder="Nationality"
                list="world-nations"
                value={nation}
                onChange={(e) => setNation(e.target.value)}
                className={input}
              />
              <input
                aria-label="Club or division"
                placeholder="Club or division"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className={input}
              />
              {config.showHidden && (
                <div className="flex gap-2">
                  <input
                    aria-label="Minimum CA"
                    placeholder="CA ≥"
                    inputMode="numeric"
                    value={caMin}
                    onChange={(e) => setCaMin(e.target.value)}
                    className={input}
                  />
                  <input
                    aria-label="Minimum PA"
                    placeholder="PA ≥"
                    inputMode="numeric"
                    value={paMin}
                    onChange={(e) => setPaMin(e.target.value)}
                    className={input}
                  />
                </div>
              )}
            </div>
            <datalist id="world-nations">
              {nations.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideMine}
                  onChange={(e) => setHideMine(e.target.checked)}
                />
                Hide my club
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={listedOnly}
                  onChange={(e) => setListedOnly(e.target.checked)}
                />
                Transfer listed only
              </label>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {results.length.toLocaleString()} players match. Attributes are FM's exact values, also
          for players your scouts have not watched. Money in € at FM's rate; loanees show their full
          wage.
        </p>
      </Card>

      {/* Phones */}
      <ul className="grid gap-2 md:hidden">
        {shown.map(({ row, score }) => (
          <li key={row[0]}>
            <Link
              to={`/world/${row[0]}`}
              className="block rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{row[1]}</span>
                {score !== null && <span className="font-semibold tabular-nums">{score}</span>}
                <span className="text-sm text-muted">{row[2]}</span>
              </div>
              <p className="truncate text-xs text-muted">
                {[row[7], row[3], row[5] ?? 'Free agent'].filter(Boolean).join(' · ')}
                {config.showHidden && row[9] ? ` · CA ${row[9]}/${row[10]}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet / desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs tracking-wide text-muted">
            <tr>
              <SortTh
                label={'Player'}
                icon={sortIcon('name')}
                onClick={() => toggleSort('name')}
                className="px-4"
              />
              {role && (
                <SortTh
                  label={role.name}
                  icon={sortIcon('role')}
                  onClick={() => toggleSort('role')}
                />
              )}
              <SortTh label={'Age'} icon={sortIcon('age')} onClick={() => toggleSort('age')} />
              <th className="px-3 uppercase">Position</th>
              <th className="px-3 uppercase">Nation</th>
              <th className="px-3 uppercase">Club</th>
              {config.showHidden && (
                <SortTh label={'CA'} icon={sortIcon('ca')} onClick={() => toggleSort('ca')} />
              )}
              {config.showHidden && (
                <SortTh label={'PA'} icon={sortIcon('pa')} onClick={() => toggleSort('pa')} />
              )}
              <SortTh
                label={'Value'}
                icon={sortIcon('value')}
                onClick={() => toggleSort('value')}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface tabular-nums">
            {shown.map(({ row, score }) => (
              <tr key={row[0]} className="hover:bg-surface-2">
                <td className="px-4 py-2 whitespace-nowrap">
                  <Link to={`/world/${row[0]}`} className="font-medium hover:text-accent">
                    {row[1]}
                  </Link>
                </td>
                {role && (
                  <td className="px-3 py-2">
                    {score === null ? (
                      <span className="text-muted">–</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className={clsx('block h-full rounded-full', scoreColor(score))}
                            style={{ width: `${score}%` }}
                          />
                        </span>
                        <span className="font-semibold">{score}</span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2">{row[2] ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{row[7] ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{row[3] ?? '–'}</td>
                <td className="max-w-56 truncate px-3 py-2 text-muted" title={row[6] ?? undefined}>
                  {row[5] ?? 'Free agent'}
                </td>
                {config.showHidden && <td className="px-3 py-2">{row[9] ?? '–'}</td>}
                {config.showHidden && <td className="px-3 py-2">{row[10] ?? '–'}</td>}
                <td className="px-3 py-2 whitespace-nowrap">{eur(row[11])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE)}
          className="mt-3 min-h-11 w-full rounded-lg border border-border text-sm font-semibold hover:bg-surface-2"
        >
          Show more ({(results.length - limit).toLocaleString()} left)
        </button>
      )}
    </>
  )
}

function SortTh({
  label,
  icon: Icon,
  onClick,
  className,
}: {
  label: string
  icon: typeof ChevronUp | null
  onClick: () => void
  className?: string
}) {
  return (
    <th className={clsx('px-3', className)}>
      <button
        type="button"
        onClick={onClick}
        className={clsx('inline-flex min-h-10 items-center gap-0.5 uppercase', Icon && 'text-text')}
      >
        {label}
        {Icon && <Icon className="size-3.5" aria-hidden />}
      </button>
    </th>
  )
}
