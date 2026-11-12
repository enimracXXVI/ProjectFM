import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { HeadToHead } from '../components/HeadToHead'
import { MatchLogCard } from '../components/MatchLogCard'
import { MatchStatsCard } from '../components/MatchStatsCard'
import { Card, Placeholder } from '../components/ui'
import { useCompetitions } from '../competitions/hooks'
import type { PlayerMatch } from '../competitions/types'
import { compLabel, fixtureKey, matchLines, resultFor } from '../competitions/view'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { ResultBadge } from './competitionParts'

/** Started, came on (minute), or unused, from FM's per-match minutes. */
function role(m: PlayerMatch): 'start' | 'sub' | 'unused' {
  if (m.minutes === null) return 'unused'
  if (m.leftAt !== null || m.minutes >= 90) return 'start'
  return 'sub'
}

const ratingColor = (r: number | null) =>
  r === null
    ? 'text-muted'
    : r >= 8
      ? 'text-emerald-400'
      : r >= 7
        ? 'text-lime-300'
        : r >= 6.5
          ? 'text-text'
          : r >= 6
            ? 'text-amber-400'
            : 'text-red-400'

export function Match() {
  const { dbId = '', key = '' } = useParams()
  const [params] = useSearchParams()
  const career = useCurrentCareer()
  const config = useConfig()
  const season = params.get('season') ? Number(params.get('season')) : null
  const { data, isPending, error } = useCompetitions(career.id, season)
  const { data: squad } = usePlayers(career.id)
  const comp = data?.competitions.find((c) => String(c.databaseId) === dbId)
  const f = comp?.fixtures.find((x) => fixtureKey(x) === key)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error) return <Placeholder>{error.message}</Placeholder>
  if (!data || !comp || !f) return <Placeholder>Match not found.</Placeholder>

  const lines = matchLines(data, comp.id, f)
  const squadUids = data.squads?.find(
    (s) => s.date === f.date && s.home === f.home && s.away === f.away,
  )
  const myXI = f.home === data.club ? squadUids?.homeXI : squadUids?.awayXI
  const myBench = f.home === data.club ? squadUids?.homeBench : squadUids?.awayBench
  // The matchday squad: XI and bench from the report when read, else every ID in the report
  const mySquad = myXI?.length
    ? new Set([...myXI, ...(myBench ?? [])])
    : squadUids
      ? new Set(f.home === data.club ? squadUids.homeSquad : squadUids.awaySquad)
      : null
  // Lines without minutes are bench players only when the matchday squad confirms it
  const mine = lines.filter(
    (m) =>
      m.club === data.club && (m.minutes !== null || !mySquad || mySquad.has(m.uniqueId ?? -1)),
  )
  const missing = mySquad
    ? (squad ?? [])
        .filter((p) => p.in_squad && !p.extra.team && p.fm_uid !== null && !mySquad.has(p.fm_uid))
        .map((p) => {
          const injury = (data.injuries ?? [])
            .filter(
              (i) =>
                i.uniqueId === p.fm_uid &&
                i.date &&
                i.date <= (f.date ?? '') &&
                daysBetween(i.date, f.date!) <= 120,
            )
            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
          return { p, injury }
        })
    : []
  const opponentId = f.home === data.club ? f.away : f.home
  const theirs = lines.filter((m) => m.club === opponentId)
  const squadId = new Map((squad ?? []).map((p) => [p.fm_uid, p.id]))

  return (
    <>
      <Link
        to={`/competitions/${dbId}?season=${data.season ?? ''}`}
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {compLabel(config, comp)}
      </Link>
      <Card className="mb-4 text-center">
        <p className="text-xs text-muted">
          {compLabel(config, comp)} · {f.date} {f.time} {f.stadium && `· ${f.stadium}`}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3 text-lg font-semibold sm:text-2xl">
          <span className="min-w-0 flex-1 truncate text-right">{f.homeShort ?? f.homeName}</span>
          <span className="rounded-lg bg-surface-2 px-3 py-1 tabular-nums">
            {f.hg} – {f.ag}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{f.awayShort ?? f.awayName}</span>
        </div>
        <div className="mt-2 flex justify-center">
          <ResultBadge r={resultFor(f, data.club)} />
        </div>
      </Card>

      {squadUids?.homeStats && squadUids.awayStats && (
        <div className="mb-4">
          <MatchStatsCard
            home={squadUids.homeStats}
            away={squadUids.awayStats}
            homeName={f.homeShort ?? f.homeName ?? ''}
            awayName={f.awayShort ?? f.awayName ?? ''}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Lineup
          title={data.clubName}
          lines={mine}
          squadId={squadId}
          xi={f.home === data.club ? squadUids?.homeXI : squadUids?.awayXI}
          bench={f.home === data.club ? squadUids?.homeBench : squadUids?.awayBench}
          names={squadUids?.names}
        />
        {(theirs.length > 0 || squadUids?.homeXI?.length) && (
          <Lineup
            title={(f.home === opponentId ? f.homeShort : f.awayShort) ?? 'Opponent'}
            lines={theirs}
            xi={f.home === opponentId ? squadUids?.homeXI : squadUids?.awayXI}
            bench={f.home === opponentId ? squadUids?.homeBench : squadUids?.awayBench}
            names={squadUids?.names}
          />
        )}
      </div>
      {missing.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold">Not in the matchday squad</h2>
          <ul className="grid gap-0.5 text-sm">
            {missing.map(({ p, injury }) => (
              <li key={p.id} className="flex min-h-9 items-center gap-2">
                <Link to={`/squad/${p.id}`} className="min-w-0 flex-1 truncate hover:text-accent">
                  {p.name}
                </Link>
                <span className={injury ? 'text-red-400' : 'text-muted'}>
                  {injury
                    ? `Injured ${injury.date}${injury.severity ? ` (${injury.severity}${injury.cause ? `, ${injury.cause.replace(/_/g, ' ')}` : ''})` : ''}`
                    : 'Not selected'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            The save records when an injury happened and how serious it was, not how long it lasts:
            an injury within 120 days before the match is shown.
          </p>
        </Card>
      )}

      {opponentId !== null && (
        <div className="mt-4">
          <HeadToHead
            opponent={opponentId}
            name={(f.home === opponentId ? f.homeShort : f.awayShort) ?? 'them'}
          />
        </div>
      )}

      <div className="mt-4">
        <MatchLogCard matchKey={key} competitionDbId={comp.databaseId} season={data.season} />
      </div>
    </>
  )
}

function Lineup({
  title,
  lines,
  squadId,
  xi,
  bench,
  names,
}: {
  title: string
  lines: PlayerMatch[]
  squadId?: Map<number | null, string>
  /** Starting XI and bench from FM's match report (Unique IDs), when known. */
  xi?: number[]
  bench?: number[]
  names?: Record<string, string | null>
}) {
  if (xi?.length) {
    // FM keeps per-player stats only for some players: the rest show by name
    const known = (u: number) => lines.find((m) => m.uniqueId === u)
    const line = (u: number): PlayerMatch =>
      known(u) ?? { ...EMPTY_LINE, uniqueId: u, name: names?.[String(u)] ?? '?' }
    const benchLines = (bench ?? []).map(line)
    const noStats = (bench ?? []).filter((u) => !known(u)).map(line)
    return (
      <LineupGroups
        title={title}
        squadId={squadId}
        groups={[
          ['Starting XI', xi.map(line)],
          ['Substitutes used', benchLines.filter((m) => (m.minutes ?? 0) > 0)],
          ['Unused substitutes', benchLines.filter((m) => !m.minutes && known(m.uniqueId ?? -1))],
          // FM kept no stats for these, so whether they came on is not known
          ['Substitutes', noStats],
        ]}
      />
    )
  }
  const groups: [string, PlayerMatch[]][] = [
    [
      'Starting XI',
      lines
        .filter((m) => role(m) === 'start')
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    ],
    [
      'Substitutes used',
      lines.filter((m) => role(m) === 'sub').sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0)),
    ],
    ['Unused substitutes', lines.filter((m) => role(m) === 'unused')],
  ]
  return <LineupGroups title={title} squadId={squadId} groups={groups} />
}

const EMPTY_LINE: PlayerMatch = {
  comp: 0,
  date: '',
  uniqueId: null,
  name: null,
  club: null,
  clubName: null,
  opponent: null,
  minutes: null,
  leftAt: null,
  goals: null,
  assists: null,
  rating: null,
  position: null,
  passes: null,
  passesDone: null,
}

function LineupGroups({
  title,
  squadId,
  groups,
}: {
  title: string
  squadId?: Map<number | null, string>
  groups: [string, PlayerMatch[]][]
}) {
  const lines = groups.flatMap(([, ms]) => ms)
  return (
    <Card>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {groups.map(([label, ms]) =>
        ms.length ? (
          <section key={label} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {label}
            </h3>
            <ul className="grid gap-0.5">
              {ms.map((m) => {
                const id = squadId?.get(m.uniqueId)
                const r = role(m)
                return (
                  <li
                    key={`${m.uniqueId}-${m.name}`}
                    className="flex min-h-9 items-center gap-2 text-sm"
                  >
                    {id ? (
                      <Link
                        to={`/squad/${id}`}
                        className="min-w-0 flex-1 truncate hover:text-accent"
                      >
                        {m.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    )}
                    {r === 'start' && m.leftAt !== null && (
                      <span className="text-xs text-red-400" title="Substituted">
                        ↓ {m.leftAt}′
                      </span>
                    )}
                    {r === 'sub' && (
                      <span className="text-xs text-emerald-400" title="Came on">
                        ↑ {90 - (m.minutes ?? 0)}′
                      </span>
                    )}
                    {!!m.goals && <span title="Goals">⚽{m.goals > 1 ? `×${m.goals}` : ''}</span>}
                    {!!m.assists && (
                      <span className="text-xs text-muted" title="Assists">
                        A{m.assists > 1 ? `×${m.assists}` : ''}
                      </span>
                    )}
                    <span
                      className={clsx(
                        'w-9 text-right font-semibold tabular-nums',
                        ratingColor(m.rating),
                      )}
                    >
                      {m.rating?.toFixed(1) ?? ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null,
      )}
      {lines.length === 0 && (
        <p className="text-sm text-muted">FM kept no player stats for this match.</p>
      )}
    </Card>
  )
}

const daysBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
