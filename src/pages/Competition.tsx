import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Card, Placeholder } from '../components/ui'
import { useCompetitions } from '../competitions/hooks'
import {
  clubsOf,
  lastPlayedMatchday,
  leagueTable,
  matchCountLabel,
  matchdayCount,
  matchdayOf,
  positionsByMatchday,
  type Venue,
} from '../competitions/league'
import type { CompetitionsFile, SaveCompetition } from '../competitions/types'
import { compInfo, compLabel, cupRounds, leaders, myFixtures } from '../competitions/view'
import { seasonLabel } from '../competitions/view'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { SERIES_COLORS } from '../lib/seriesColors'
import { FixtureRow, ResultBadge, Tabs } from './competitionParts'

export function Competition() {
  const { dbId = '' } = useParams()
  const [params] = useSearchParams()
  const career = useCurrentCareer()
  const config = useConfig()
  const season = params.get('season') ? Number(params.get('season')) : null
  const { data, isPending, error } = useCompetitions(career.id, season)
  const comp = data?.competitions.find((c) => String(c.databaseId) === dbId)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error) return <Placeholder>{error.message}</Placeholder>
  if (!data || !comp) return <Placeholder>Competition not found in this season.</Placeholder>
  const kind = compInfo(config, comp)?.kind ?? 'cup'

  return (
    <>
      <Link
        to={`/competitions?season=${data.season ?? ''}`}
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Competitions
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{compLabel(config, comp)}</h1>
      <p className="mb-4 text-sm text-muted">
        {data.season ? seasonLabel(data.season) : ''} · ID {comp.databaseId}
      </p>
      {kind === 'league' ? (
        <League file={data} comp={comp} />
      ) : kind === 'cup' ? (
        <Cup file={data} comp={comp} />
      ) : (
        <Friendlies file={data} comp={comp} />
      )}
    </>
  )
}

type LeagueTab = 'table' | 'matchdays' | 'positions' | 'fixtures' | 'players'

function League({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const [tab, setTab] = useState<LeagueTab>('table')
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ['table', 'Table'],
          ['matchdays', 'Matchdays'],
          ['positions', 'Positions'],
          ['fixtures', 'My games'],
          ['players', 'Players'],
        ]}
      />
      {tab === 'table' && <LeagueTable file={file} comp={comp} />}
      {tab === 'matchdays' && <Matchdays file={file} comp={comp} />}
      {tab === 'positions' && <PositionChart file={file} comp={comp} />}
      {tab === 'fixtures' && <MyGames file={file} comp={comp} />}
      {tab === 'players' && <Players file={file} comp={comp} />}
    </>
  )
}

function LeagueTable({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const last = lastPlayedMatchday(comp.fixtures)
  const [venue, setVenue] = useState<Venue>('all')
  const [md, setMd] = useState<number>(last)
  const rows = leagueTable(comp.fixtures, { matchday: md || null, venue })
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-60 flex-1">
          <Tabs
            value={venue}
            onChange={setVenue}
            options={[
              ['all', 'Overall'],
              ['home', 'Home'],
              ['away', 'Away'],
            ]}
          />
        </div>
        <select
          aria-label="Table after matchday"
          value={md}
          onChange={(e) => setMd(Number(e.target.value))}
          className="mb-3 min-h-11 rounded-lg border border-border bg-surface px-3 text-base md:text-sm"
        >
          {Array.from({ length: Math.max(last, 1) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              After matchday {n}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-2 py-2 text-right">#</th>
              <th className="px-2 py-2 text-left">Club</th>
              <th className="px-2 py-2">P</th>
              <th className="px-2 py-2">W</th>
              <th className="px-2 py-2">D</th>
              <th className="px-2 py-2">L</th>
              <th className="hidden px-2 py-2 sm:table-cell">GF</th>
              <th className="hidden px-2 py-2 sm:table-cell">GA</th>
              <th className="px-2 py-2">GD</th>
              <th className="px-2 py-2">Pts</th>
              <th className="hidden px-2 py-2 text-left md:table-cell">Form</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {rows.map((r) => (
              <tr
                key={r.club}
                className={clsx(
                  'border-t border-border text-center',
                  r.club === file.club && 'bg-accent/10 font-semibold',
                )}
              >
                <td className="px-2 py-2 text-right text-muted">{r.position}</td>
                <td className="max-w-40 truncate px-2 py-2 text-left">{r.short}</td>
                <td className="px-2 py-2">{r.played}</td>
                <td className="px-2 py-2">{r.won}</td>
                <td className="px-2 py-2">{r.drawn}</td>
                <td className="px-2 py-2">{r.lost}</td>
                <td className="hidden px-2 py-2 sm:table-cell">{r.gf}</td>
                <td className="hidden px-2 py-2 sm:table-cell">{r.ga}</td>
                <td className="px-2 py-2">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="px-2 py-2 font-bold">{r.points}</td>
                <td className="hidden px-2 py-2 md:table-cell">
                  <span className="flex gap-0.5">
                    {r.form.map((o, i) => (
                      <ResultBadge key={i} r={o} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Level on points: results between those teams, then goal difference, then goals scored (FM’s
        Serie A rules). {matchCountLabel(comp.fixtures)}
      </p>
    </>
  )
}

function Matchdays({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const total = matchdayCount(comp.fixtures)
  const [md, setMd] = useState(Math.max(1, lastPlayedMatchday(comp.fixtures)))
  const games = comp.fixtures.filter((f) => matchdayOf(f) === md)
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMd(Math.max(1, md - 1))}
          className="min-h-11 rounded-lg border border-border px-3"
          aria-label="Previous matchday"
        >
          ‹
        </button>
        <select
          aria-label="Matchday"
          value={md}
          onChange={(e) => setMd(Number(e.target.value))}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-base md:text-sm"
        >
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Matchday {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMd(Math.min(total, md + 1))}
          className="min-h-11 rounded-lg border border-border px-3"
          aria-label="Next matchday"
        >
          ›
        </button>
      </div>
      <Card className="grid gap-0.5 p-2">
        {games.map((f, i) => (
          <FixtureRow key={i} f={f} club={file.club} compDbId={comp.databaseId} />
        ))}
      </Card>
    </>
  )
}

function PositionChart({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const positions = positionsByMatchday(comp.fixtures)
  const clubs = clubsOf(comp.fixtures)
  const [others, setOthers] = useState<number[]>([])
  const teams = clubs.size
  const shown = [file.club, ...others].filter((c) => positions.has(c))
  const n = Math.max(...[...positions.values()].map((p) => p.length), 0)
  if (n === 0) return <Placeholder>No matchday played yet.</Placeholder>
  const W = 640
  const H = 320
  const pad = { l: 28, r: 12, t: 12, b: 24 }
  const x = (i: number) =>
    pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (pos: number) => pad.t + ((pos - 1) / Math.max(teams - 1, 1)) * (H - pad.t - pad.b)
  const colorOf = (i: number) =>
    i === 0 ? 'var(--color-accent)' : SERIES_COLORS[i % SERIES_COLORS.length]
  return (
    <Card>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="League position after each matchday"
      >
        {[1, Math.ceil(teams / 2), teams].map((p) => (
          <g key={p}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(p)}
              y2={y(p)}
              stroke="var(--color-border)"
              strokeDasharray="3 4"
            />
            <text
              x={pad.l - 6}
              y={y(p) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-muted)"
            >
              {p}
            </text>
          </g>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-muted)"
          >
            {i + 1}
          </text>
        ))}
        {shown.map((club, si) => {
          const pts = positions.get(club)!
          return (
            <g key={club}>
              <polyline
                points={pts.map((p, i) => `${x(i)},${y(p)}`).join(' ')}
                fill="none"
                stroke={colorOf(si)}
                strokeWidth={si === 0 ? 3 : 2}
              />
              {pts.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p)} r={si === 0 ? 4 : 3} fill={colorOf(si)}>
                  <title>{`${clubs.get(club)?.short}: ${p} after matchday ${i + 1}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {shown.map((club, si) => (
          <span
            key={club}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(si) }} />
            {clubs.get(club)?.short}
            {si > 0 && (
              <button
                type="button"
                aria-label={`Remove ${clubs.get(club)?.short}`}
                onClick={() => setOthers(others.filter((o) => o !== club))}
                className="text-muted hover:text-text"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {others.length < 4 && (
          <select
            value=""
            aria-label="Add a club"
            onChange={(e) => e.target.value && setOthers([...others, Number(e.target.value)])}
            className="min-h-9 rounded-lg border border-border bg-surface px-2 text-base md:text-sm"
          >
            <option value="">Add a club…</option>
            {[...clubs.entries()]
              .filter(([c]) => !shown.includes(c))
              .sort((a, b) => a[1].short.localeCompare(b[1].short))
              .map(([c, v]) => (
                <option key={c} value={c}>
                  {v.short}
                </option>
              ))}
          </select>
        )}
      </div>
    </Card>
  )
}

function MyGames({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const games = myFixtures(file, comp)
  return (
    <Card className="grid gap-0.5 p-2">
      {games.length === 0 && <p className="p-2 text-sm text-muted">No games.</p>}
      {games.map((f, i) => (
        <FixtureRow key={i} f={f} club={file.club} compDbId={comp.databaseId} />
      ))}
    </Card>
  )
}

type LeaderSort = 'goals' | 'assists' | 'rating'

function Players({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const [sort, setSort] = useState<LeaderSort>('goals')
  const all = leaders(file, comp.id)
  const rows = [...all]
    .filter((l) => (sort === 'rating' ? l.rating !== null : l[sort] > 0))
    .sort((a, b) =>
      sort === 'rating'
        ? (b.rating ?? 0) - (a.rating ?? 0) || b.apps - a.apps
        : b[sort] - a[sort] || a.apps - b.apps,
    )
    .slice(0, 20)
  return (
    <>
      <Tabs
        value={sort}
        onChange={setSort}
        options={[
          ['goals', 'Goals'],
          ['assists', 'Assists'],
          ['rating', 'Average rating'],
        ]}
      />
      {rows.length === 0 ? (
        <Placeholder>No player stats yet.</Placeholder>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-2 py-2 text-right">#</th>
                <th className="px-2 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-left">Club</th>
                <th className="px-2 py-2">Apps</th>
                <th className="px-2 py-2">Gls</th>
                <th className="px-2 py-2">Ast</th>
                <th className="px-2 py-2">Rating</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {rows.map((l, i) => (
                <tr key={l.key} className="border-t border-border text-center">
                  <td className="px-2 py-2 text-right text-muted">{i + 1}</td>
                  <td className="max-w-44 truncate px-2 py-2 text-left">{l.name}</td>
                  <td className="max-w-32 truncate px-2 py-2 text-left text-muted">{l.club}</td>
                  <td className="px-2 py-2">{l.apps}</td>
                  <td className={clsx('px-2 py-2', sort === 'goals' && 'font-bold')}>{l.goals}</td>
                  <td className={clsx('px-2 py-2', sort === 'assists' && 'font-bold')}>
                    {l.assists}
                  </td>
                  <td className={clsx('px-2 py-2', sort === 'rating' && 'font-bold')}>
                    {l.rating?.toFixed(2) ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        From FM’s per-match player stats, which FM keeps for the teams it follows closely.
      </p>
    </>
  )
}

function Cup({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  const config = useConfig()
  const [tab, setTab] = useState<'rounds' | 'fixtures' | 'players'>('rounds')
  const rounds = cupRounds(comp, config.learned.rounds ?? {})
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ['rounds', 'Rounds'],
          ['fixtures', 'My games'],
          ['players', 'Players'],
        ]}
      />
      {tab === 'rounds' && (
        <div className="grid gap-4">
          {rounds.map((r) => {
            const mineFirst = [...r.ties].sort(
              (a, b) =>
                Number([b.a.club, b.b.club].includes(file.club)) -
                Number([a.a.club, a.b.club].includes(file.club)),
            )
            return (
              <section key={String(r.stage)}>
                <h2 className="mb-1 text-sm font-semibold">
                  {r.name}
                  <span className="ml-2 text-xs font-normal text-muted">{r.date}</span>
                </h2>
                <Card className="grid gap-0.5 p-2">
                  {mineFirst.map((t) =>
                    t.legs.length === 1 ? (
                      <FixtureRow
                        key={t.key}
                        f={t.legs[0]}
                        club={file.club}
                        compDbId={comp.databaseId}
                      />
                    ) : (
                      <div key={t.key} className="rounded-lg border border-border/60 p-1">
                        {t.legs.map((f, i) => (
                          <FixtureRow key={i} f={f} club={file.club} compDbId={comp.databaseId} />
                        ))}
                        {t.agg && (
                          <p className="px-2 pb-1 text-xs text-muted">
                            Aggregate {t.a.name} {t.agg[0]} – {t.agg[1]} {t.b.name}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </Card>
              </section>
            )
          })}
        </div>
      )}
      {tab === 'fixtures' && <MyGames file={file} comp={comp} />}
      {tab === 'players' && <Players file={file} comp={comp} />}
    </>
  )
}

function Friendlies({ file, comp }: { file: CompetitionsFile; comp: SaveCompetition }) {
  return <MyGames file={file} comp={comp} />
}
