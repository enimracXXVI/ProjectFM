import { clsx } from 'clsx'
import { PickList } from '../components/PickList'
import { leagueName, levelOf, topLevel } from '../world/leagues'
import { useSeasonStats, useStatsSeasons } from '../world/hooks'
import { seasonText } from '../data/seasons'
import {
  METRICS,
  STAT_KINDS,
  formatMetric,
  metricValue,
  statsIndex,
  type StatKind,
} from '../world/stats'
import { ClubCrest, Face, Flag } from '../components/Pictures'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { BOOL, NUM, TEXT, useUrlState, useUrlText } from '../lib/urlState'
import { Link } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { traitNames } from '../data/traits'
import { scoreTextColor } from '../lib/attributes'
import { parsePositions, roleScore, scoreColor } from '../lib/roleFit'
import { useWorld } from '../world/hooks'
import { eur } from '../lib/money'
import { regionLookup, rowToPlayer, searchKey, type WorldRow } from '../world/world'
import { byLastNameParts, type NameParts } from '../lib/names'

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

type SortCol = 'name' | 'age' | 'role' | 'ca' | 'pa' | 'value' | 'stat' | 'level'

export function World() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data, isPending, error } = useWorld(career.id)

  const [nameInput, setName, name] = useUrlText('q')
  // Phones: cards, or the table (scrolls both ways, header and names stay in place)
  const [layout, setLayout] = useUrlState<'cards' | 'table'>('layout', 'cards', TEXT as never)
  const [positions, setPositions] = useUrlState<string[]>('pos', [])
  const [traits, setTraits] = useUrlState<string[]>('traits', [])
  const [ageMinInput, setAgeMin, ageMin] = useUrlText('ageMin')
  const [ageMaxInput, setAgeMax, ageMax] = useUrlText('ageMax')
  const [regionId, setRegionId] = useUrlState('region', '', TEXT)
  const [nationInput, setNation, nation] = useUrlText('nation')
  const [clubInput, setClub, club] = useUrlText('club')
  const [roleId, setRoleId] = useUrlState('roleId', '', TEXT)
  const [caMinInput, setCaMin, caMin] = useUrlText('caMin')
  const [paMinInput, setPaMin, paMin] = useUrlText('paMin')
  const [hideMine, setHideMine] = useUrlState('hideMine', true, BOOL)
  // Season stats of every player (latest season stored): rank by a figure, minimum minutes
  const [statKey, setStatKey] = useUrlState('stat', '', TEXT)
  const [statKind, setStatKind] = useUrlState<StatKind>('statKind', 'overall', TEXT as never)
  // League and level: compare players across leagues of different strength
  const [league, setLeague] = useUrlState('league', '', TEXT)
  const [minLevelInput, setMinLevel, minLevel] = useUrlText('minLevel')
  const [weigh, setWeigh] = useUrlState('weigh', false, BOOL)
  const [minMinutesInput, setMinMinutes, minMinutes] = useUrlText('minMin')
  const [showFilters, setShowFilters] = useUrlState('filters', false, BOOL)
  const [sort, setSort] = useUrlState<{ col: SortCol; asc: boolean } | null>('sort', null)
  const [limit, setLimit] = useUrlState('shown', PAGE, NUM)

  const filters = useDeferredValue({
    name,
    positions,
    traits,
    ageMin,
    ageMax,
    regionId,
    nation,
    club,
    roleId,
    caMin,
    paMin,
    hideMine,
    statKey,
    statKind,
    minMinutes,
    league,
    minLevel,
    weigh,
  })
  const { data: seasons } = useStatsSeasons(career.id)
  const statsSeason = seasons?.[0] ?? null
  const wantStats = !!(filters.statKey || filters.minMinutes)
  const { data: statsFile, isPending: statsLoading } = useSeasonStats(
    career.id,
    wantStats ? statsSeason : null,
  )
  const stats = useMemo(
    () => (statsFile ? statsIndex(statsFile, filters.statKind) : null),
    [statsFile, filters.statKind],
  )
  const metric = METRICS.find((m) => m.key === filters.statKey) ?? null

  const regionOf = useMemo(() => regionLookup(config.regions), [config.regions])
  const role = config.roles.find((r) => r.id === filters.roleId)
  // Traits the world's players have, by name (FM's numbers named in Settings > Player traits)
  const traitOptions = useMemo(() => {
    const bits = new Set<number>()
    for (const r of data?.file.rows ?? []) for (const b of r[20] ?? []) bits.add(b)
    return [...bits]
      .map((b) => ({ bit: String(b), name: traitNames(String(b), config.traitNames)[0] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, config.traitNames])
  const nations = useMemo(
    () => [...new Set((data?.file.rows ?? []).map((r) => r[3]).filter(Boolean) as string[])].sort(),
    [data],
  )

  // Leagues the save keeps tables for, strongest first
  const leagueOptions = useMemo(
    () =>
      Object.entries(data?.file.leagues ?? {})
        .sort(([, a], [, b]) => (b.rep ?? 0) - (a.rep ?? 0))
        .map(([id, l]) => ({
          value: id,
          label: `${leagueName(id, l, config.competitions)} · level ${Math.round((l.rep ?? 0) / 100)}`,
        })),
    [data, config.competitions],
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
    const wantedTraits = f.traits.map(Number)
    const myClub = file.meta.myClub

    const minMin = f.minMinutes ? Number(f.minMinutes) : null
    const lvlMin = f.minLevel ? Number(f.minLevel) : null
    const top = topLevel(file)
    const out: {
      row: WorldRow
      score: number | null
      stat: number | null
      level: ReturnType<typeof levelOf>
    }[] = []
    for (const r of file.rows) {
      if (f.hideMine && r[5] && r[5] === myClub) continue
      if (amin !== null && (r[2] ?? 0) < amin) continue
      if (amax !== null && (r[2] ?? 99) > amax) continue
      if (cmin !== null && (r[9] ?? 0) < cmin) continue
      if (pmin !== null && (r[10] ?? 0) < pmin) continue
      if (nat && (r[3] ?? '').toLowerCase() !== nat && (r[4] ?? '').toLowerCase() !== nat) continue
      if (f.regionId && regionOf(r[3]) !== f.regionId) continue
      if (q && !searchKey(r[1]).includes(q)) continue
      if (clubQ && !searchKey(`${r[5] ?? ''} ${r[6] ?? ''}`).includes(clubQ)) continue
      if (wanted.size && !parsePositions(r[7]).some((p) => wanted.has(p))) continue
      if (wantedTraits.length && !wantedTraits.every((b) => r[20]?.includes(b))) continue
      if (minMin !== null && stats && (stats.get(r[0])?.minutes ?? 0) < minMin) continue
      if (f.league && String(r[28] ?? '') !== f.league) continue
      const level = levelOf(r, file.leagues)
      if (lvlMin !== null && (level?.level ?? 0) < lvlMin) continue
      const stat = metric && stats ? metricValue(stats.get(r[0]), metric.key) : null
      out.push({
        row: r,
        score: null,
        // Weighed: the figure times the player's level against the strongest league's
        stat: f.weigh && stat !== null ? stat * Math.min(1, (level?.level ?? 0) / top) : stat,
        level,
      })
    }
    if (role) {
      for (const o of out) {
        const score = roleScore(rowToPlayer(file, o.row).attributes, role, config.roleWeights)
        o.score =
          f.weigh && score !== null
            ? Math.round(score * Math.min(1, (o.level?.level ?? 0) / top))
            : score
      }
    }
    const col: SortCol = sort?.col ?? (metric ? 'stat' : role ? 'role' : 'value')
    const asc = sort?.asc ?? col === 'name'
    const val = (o: (typeof out)[number]): number | string | null =>
      col === 'name'
        ? o.row[1]
        : col === 'age'
          ? o.row[2]
          : col === 'level'
            ? (o.level?.level ?? null)
            : col === 'stat'
              ? o.stat
              : col === 'role'
                ? o.score
                : col === 'ca'
                  ? o.row[9]
                  : col === 'pa'
                    ? o.row[10]
                    : o.row[11]
    return out.sort((a, b) => {
      if (col === 'name')
        return asc
          ? byLastNameParts(nameParts(a.row), nameParts(b.row))
          : byLastNameParts(nameParts(b.row), nameParts(a.row))
      const [x, y] = [val(a), val(b)]
      if (x === y) return 0
      if (x === null) return 1
      if (y === null) return -1
      const d =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return asc ? d : -d
    })
  }, [data, filters, role, config.roleWeights, config.showHidden, regionOf, sort, stats, metric])

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
          No world database yet.{' '}
          <Link to="/import" className="text-accent underline">
            Import your FM save
          </Link>{' '}
          to fill it with every player.
        </Placeholder>
      </>
    )

  const toggleSort = (col: SortCol) =>
    setSort((s) => (s?.col === col ? { col, asc: !s.asc } : { col, asc: col === 'name' }))
  const sortIcon = (col: SortCol): typeof ChevronUp | null =>
    (sort?.col ?? (metric ? 'stat' : role ? 'role' : 'value')) === col
      ? (sort?.asc ?? col === 'name')
        ? ChevronUp
        : ChevronDown
      : null

  const shown = results.slice(0, limit)
  const leagueText = (row: WorldRow) =>
    row[28] != null
      ? leagueName(row[28], data.file.leagues?.[String(row[28])], config.competitions)
      : null
  const leagueCell = (row: WorldRow, level: ReturnType<typeof levelOf>) => (
    <span
      className="inline-flex max-w-56 items-center gap-1.5"
      title={
        level?.from === 'club'
          ? 'No table for this league in the save: level from the club’s reputation'
          : 'Level: average reputation of the league’s clubs'
      }
    >
      <span className="truncate">{leagueText(row) ?? '–'}</span>
      {level && (
        <span className="shrink-0 tabular-nums">
          {level.from === 'club' ? '≈' : ''}
          {level.level}
        </span>
      )}
    </span>
  )

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
            value={nameInput}
            onChange={(e) => (setName(e.target.value), setLimit(PAGE))}
            className={`${input} flex-1 sm:max-w-xs`}
          />
          <PickList
            value={roleId}
            placeholder="Rank by role"
            onChange={(v) => (setRoleId(v), setSort(null))}
            options={config.roles.map((r) => ({
              value: r.id,
              label: r.name,
              group: r.phase === 'ip' ? 'In possession' : 'Out of possession',
            }))}
            className="w-full sm:w-64"
          />
          <PickList
            value={statKey}
            placeholder="Rank by stat"
            onChange={(v) => (setStatKey(v), setSort(null))}
            options={METRICS.map((m) => ({ value: m.key, label: m.label, group: m.group }))}
            className="w-full sm:w-64"
          />
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
            {traitOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Add a trait the players must have"
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    !traits.includes(e.target.value) &&
                    setTraits([...traits, e.target.value])
                  }
                  className={`${input} max-w-xs`}
                >
                  <option value="">Has trait…</option>
                  {traitOptions
                    .filter((t) => !traits.includes(t.bit))
                    .map((t) => (
                      <option key={t.bit} value={t.bit}>
                        {t.name}
                      </option>
                    ))}
                </select>
                {traits.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-label={`Remove ${traitNames(b, config.traitNames)[0]}`}
                    onClick={() => setTraits(traits.filter((x) => x !== b))}
                    className="min-h-9 rounded-full border border-accent bg-accent/15 px-3 text-sm text-accent"
                  >
                    {traitNames(b, config.traitNames)[0]} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <select
                aria-label="Stats from"
                value={statKind}
                onChange={(e) => setStatKind(e.target.value as StatKind)}
                className={input}
              >
                {STAT_KINDS.map(([k, label]) => (
                  <option key={k} value={k}>
                    Stats: {label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Minimum minutes played"
                placeholder="Minutes from"
                inputMode="numeric"
                value={minMinutesInput}
                onChange={(e) => setMinMinutes(e.target.value)}
                className={input}
              />
              <PickList
                value={league}
                placeholder="Any league"
                onChange={setLeague}
                options={leagueOptions}
                className="col-span-2"
              />
              <input
                aria-label="Minimum level"
                title="Level 0–100: the league's strength (average reputation of its clubs), or the club's reputation where the save has no table for its league"
                placeholder="Level from"
                inputMode="numeric"
                value={minLevelInput}
                onChange={(e) => setMinLevel(e.target.value)}
                className={input}
              />
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                title="Role scores and stats are multiplied by the player's level against the strongest league's, so the same numbers count for less in a weaker league"
              >
                <input
                  type="checkbox"
                  checked={weigh}
                  onChange={(e) => setWeigh(e.target.checked)}
                />
                Weigh by level
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <input
                aria-label="Minimum age"
                placeholder="Age from"
                inputMode="numeric"
                value={ageMinInput}
                onChange={(e) => setAgeMin(e.target.value)}
                className={input}
              />
              <input
                aria-label="Maximum age"
                placeholder="Age to"
                inputMode="numeric"
                value={ageMaxInput}
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
                value={nationInput}
                onChange={(e) => setNation(e.target.value)}
                className={input}
              />
              <input
                aria-label="Club or division"
                placeholder="Club or division"
                value={clubInput}
                onChange={(e) => setClub(e.target.value)}
                className={input}
              />
              {config.showHidden && (
                <div className="flex gap-2">
                  <input
                    aria-label="Minimum CA"
                    placeholder="CA ≥"
                    inputMode="numeric"
                    value={caMinInput}
                    onChange={(e) => setCaMin(e.target.value)}
                    className={input}
                  />
                  <input
                    aria-label="Minimum PA"
                    placeholder="PA ≥"
                    inputMode="numeric"
                    value={paMinInput}
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
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {results.length.toLocaleString()} players match. Attributes are FM's exact values, also
          for players your scouts have not watched. Money in € at FM's rate; loanees show their full
          wage.
        </p>
        {wantStats && (
          <p className="mt-1 text-xs text-muted">
            {statsSeason === null
              ? 'No season stats yet: they are stored for every player from the next save import on.'
              : statsLoading
                ? 'Opening the season stats…'
                : `Stats: season ${seasonText(statsSeason)} up to the last import${filters.minMinutes ? `, at least ${filters.minMinutes} minutes` : ''}.`}
          </p>
        )}
      </Card>

      {/* Phones */}
      <div
        className="mb-3 flex w-fit rounded-lg border border-border p-0.5 md:hidden"
        role="group"
        aria-label="Layout"
      >
        {(
          [
            ['cards', 'Cards'],
            ['table', 'Table'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={layout === v}
            onClick={() => setLayout(v)}
            className={clsx(
              'min-h-10 rounded-md px-3 text-sm',
              layout === v ? 'bg-surface-2 text-text' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ul
        className={clsx(
          'grid grid-cols-[minmax(0,1fr)] gap-2 md:hidden',
          layout === 'table' && 'hidden',
        )}
      >
        {shown.map(({ row, score, stat }) => (
          <li key={row[0]}>
            <Link
              to={`/world/${row[0]}`}
              className="block rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{row[1]}</span>
                {score !== null && <span className="font-semibold tabular-nums">{score}</span>}
                {metric && (
                  <span className="font-semibold tabular-nums" title={metric.label}>
                    {formatMetric(metric.key, stat)}
                  </span>
                )}
                <span className="text-sm text-muted">{row[2]}</span>
              </div>
              <p className="truncate text-xs text-muted">
                {[row[7], row[3], row[5] ?? 'Free agent', leagueText(row)]
                  .filter(Boolean)
                  .join(' · ')}
                {config.showHidden && row[9] ? ` · CA ${row[9]}/${row[10]}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet / desktop */}
      <div
        className={clsx(
          'max-h-[calc(100dvh-9rem)] overflow-auto rounded-xl border border-border md:block',
          layout === 'table' ? 'block' : 'hidden',
        )}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[2] bg-surface-2 text-left text-xs tracking-wide text-muted">
            <tr>
              <SortTh
                label={'Player'}
                icon={sortIcon('name')}
                onClick={() => toggleSort('name')}
                className="sticky left-0 z-[1] bg-surface-2 px-4 shadow-[inset_-1px_0_0_var(--color-border)]"
              />
              {metric && (
                <SortTh
                  label={metric.label}
                  icon={sortIcon('stat')}
                  onClick={() => toggleSort('stat')}
                />
              )}
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
              <SortTh
                label={'League'}
                icon={sortIcon('level')}
                onClick={() => toggleSort('level')}
              />
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
            {shown.map(({ row, score, stat, level }) => (
              <tr key={row[0]} className="group hover:bg-surface-2">
                <td className="sticky left-0 z-[1] bg-surface px-4 py-2 whitespace-nowrap shadow-[inset_-1px_0_0_var(--color-border)] group-hover:bg-surface-2">
                  <Link
                    to={`/world/${row[0]}`}
                    className="inline-flex items-center gap-2 font-medium hover:text-accent"
                  >
                    <Face id={row[0]} className="size-6" />
                    {row[1]}
                  </Link>
                </td>
                {metric && (
                  <td className="px-3 py-2 font-semibold">{formatMetric(metric.key, stat)}</td>
                )}
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
                        <span className={clsx('font-semibold', scoreTextColor(score))}>
                          {score}
                        </span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2">{row[2] ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{row[7] ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Flag nation={row[3]} />
                    {row[3] ?? '–'}
                  </span>
                </td>
                <td className="max-w-56 truncate px-3 py-2 text-muted" title={row[6] ?? undefined}>
                  <span className="inline-flex items-center gap-1.5">
                    <ClubCrest id={row[23]} />
                    {row[5] ?? 'Free agent'}
                  </span>
                </td>
                <td className="max-w-56 px-3 py-2 whitespace-nowrap text-muted">
                  {leagueCell(row, level)}
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

const nameParts = (r: WorldRow): NameParts => ({ name: r[1], lastName: r[18], commonName: r[19] })
