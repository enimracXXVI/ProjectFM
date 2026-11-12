import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { HeadToHead } from '../components/HeadToHead'
import { MatchLogCard } from '../components/MatchLogCard'
import { MatchStatsCard } from '../components/MatchStatsCard'
import { Card, Placeholder } from '../components/ui'
import { useCompetitions } from '../competitions/hooks'
import { EVENT, type Fixture, type ReportPlayer } from '../competitions/types'
import { compLabel, fixtureKey, halfTime, resultFor } from '../competitions/view'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { ResultBadge } from './competitionParts'

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

  const ht = halfTime(f)
  const report = data.squads?.find(
    (s) => s.date === f.date && s.home === f.home && s.away === f.away,
  )
  const isMine = f.home === data.club || f.away === data.club
  const myPlayers = f.home === data.club ? report?.homePlayers : report?.awayPlayers
  const mySquad = myPlayers ? new Set(myPlayers.map((p) => p.id)) : null
  const missing =
    isMine && mySquad
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
  const squadId = new Map((squad ?? []).map((p) => [p.fm_uid, p.id]))
  const homeName = f.homeShort ?? f.homeName ?? ''
  const awayName = f.awayShort ?? f.awayName ?? ''

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
          <span className="min-w-0 flex-1 truncate text-right">{homeName}</span>
          <span className="rounded-lg bg-surface-2 px-3 py-1 tabular-nums">
            {f.hg} – {f.ag}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{awayName}</span>
        </div>
        {(ht || f.pens) && (
          <p className="mt-1 text-sm text-muted tabular-nums">
            {ht && `Half time ${ht[0]} – ${ht[1]}`}
            {ht && f.pens && ' · '}
            {f.pens &&
              `Penalties ${f.pens[0]} – ${f.pens[1]} (${f.pens[0] > f.pens[1] ? homeName : awayName} win)`}
          </p>
        )}
        {isMine && (
          <div className="mt-2 flex justify-center">
            <ResultBadge r={resultFor(f, data.club)} />
          </div>
        )}
      </Card>

      {(f.events?.length ?? 0) > 0 && (
        <div className="mb-4">
          <MatchEvents f={f} />
        </div>
      )}

      {report?.homeTeam && report.awayTeam && (
        <div className="mb-4">
          <MatchStatsCard
            homeTeam={report.homeTeam}
            awayTeam={report.awayTeam}
            homeName={homeName}
            awayName={awayName}
          />
        </div>
      )}

      {report?.homePlayers && report.awayPlayers ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Lineup title={homeName} players={report.homePlayers} squadId={squadId} />
          <Lineup title={awayName} players={report.awayPlayers} squadId={squadId} />
        </div>
      ) : (
        <Placeholder>
          FM kept no match report for this game, so there are no line-ups or player stats.
        </Placeholder>
      )}

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

      {isMine && opponentId !== null && (
        <div className="mt-4">
          <HeadToHead
            opponent={opponentId}
            name={(f.home === opponentId ? f.homeShort : f.awayShort) ?? 'them'}
          />
        </div>
      )}

      {isMine && (
        <div className="mt-4">
          <MatchLogCard matchKey={key} competitionDbId={comp.databaseId} season={data.season} />
        </div>
      )}
    </>
  )
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

const COLUMNS: [string, string, (p: ReportPlayer) => string][] = [
  ['G', 'Goals', (p) => (p.goals ? String(p.goals) : '')],
  ['A', 'Assists', (p) => (p.assists ? String(p.assists) : '')],
  ['Sh', 'Shots (on target)', (p) => (p.shots ? `${p.shots} (${p.onTarget})` : '')],
  ['xG', 'Expected goals', (p) => (p.xg ? p.xg.toFixed(2) : '')],
  ['Pas', 'Passes completed / attempted', (p) => (p.passes ? `${p.passesDone}/${p.passes}` : '')],
  ['Tck', 'Tackles won / attempted', (p) => (p.tackles ? `${p.tacklesWon}/${p.tackles}` : '')],
  [
    'Hdr',
    'Headers won / aerial challenges',
    (p) => (p.aerials ? `${p.headersWon}/${p.aerials}` : ''),
  ],
]

/** One side's matchday squad: starters, substitutes who came on, unused substitutes. */
function Lineup({
  title,
  players,
  squadId,
}: {
  title: string
  players: ReportPlayer[]
  squadId: Map<number | null, string>
}) {
  const groups: [string, ReportPlayer[]][] = [
    ['Starting XI', players.filter((p) => p.start)],
    [
      'Substitutes',
      players.filter((p) => !p.start && p.on).sort((a, b) => (a.on ?? 0) - (b.on ?? 0)),
    ],
    ['Unused substitutes', players.filter((p) => !p.start && !p.on)],
  ]
  return (
    <Card className="min-w-0">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-2 text-left font-normal">Player</th>
              {COLUMNS.map(([short, long]) => (
                <th key={short} className="px-1.5 py-1 text-center font-normal" title={long}>
                  {short}
                </th>
              ))}
              <th className="py-1 pl-1.5 text-right font-normal" title="Match rating">
                Rat
              </th>
            </tr>
          </thead>
          {groups.map(([label, list]) =>
            list.length ? (
              <tbody key={label}>
                <tr>
                  <td
                    colSpan={COLUMNS.length + 2}
                    className="pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase"
                  >
                    {label}
                  </td>
                </tr>
                {list.map((p, i) => {
                  const id = squadId.get(p.id)
                  return (
                    <tr key={`${p.id}-${i}`} className="border-t border-border/50">
                      <td className="py-1.5 pr-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {id ? (
                            <Link
                              to={`/squad/${id}`}
                              className="truncate whitespace-nowrap hover:text-accent"
                            >
                              {p.name ?? 'Unknown'}
                            </Link>
                          ) : (
                            <span className="truncate whitespace-nowrap">
                              {p.name ?? 'Unknown'}
                            </span>
                          )}
                          {p.on && (
                            <span className="shrink-0 text-xs text-emerald-400" title="Came on">
                              ↑{p.on}′
                            </span>
                          )}
                          {p.off && (
                            <span className="shrink-0 text-xs text-red-400" title="Went off">
                              ↓{p.off}′
                            </span>
                          )}
                          {p.yellow > 0 && (
                            <span
                              className="h-3 w-2 shrink-0 rounded-[2px] bg-yellow-400"
                              title={p.yellow > 1 ? 'Two yellow cards' : 'Yellow card'}
                            />
                          )}
                          {p.red > 0 && (
                            <span
                              className="h-3 w-2 shrink-0 rounded-[2px] bg-red-500"
                              title="Red card"
                            />
                          )}
                        </span>
                      </td>
                      {COLUMNS.map(([short, , value]) => (
                        <td key={short} className="px-1.5 py-1.5 text-center whitespace-nowrap">
                          {value(p)}
                        </td>
                      ))}
                      <td
                        className={clsx(
                          'py-1.5 pl-1.5 text-right font-semibold',
                          ratingColor(p.rating),
                        )}
                      >
                        {p.rating?.toFixed(1) ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ) : null,
          )}
        </table>
      </div>
    </Card>
  )
}

const minuteText = (m: number, added: number) => (added ? `${m}+${added}′` : `${m}′`)

/** Goals in order (home on the left, away on the right) and the shoot-out, as FM lists them. */
function MatchEvents({ f }: { f: Fixture }) {
  const events = f.events ?? []
  const goals = events.filter(([, t]) => t <= EVENT.penalty)
  const kicks = events.filter(([, t]) => t === EVENT.kickScored || t === EVENT.kickMissed)
  const home = kicks.filter(([side]) => side === 0)
  const away = kicks.filter(([side]) => side === 1)
  const tag = (t: number) => (t === EVENT.penalty ? ' (pen)' : t === EVENT.ownGoal ? ' (og)' : '')
  return (
    <Card>
      <h2 className="mb-2 font-semibold">Goals</h2>
      {goals.length === 0 && <p className="text-sm text-muted">No goals.</p>}
      <ul className="grid gap-1 text-sm">
        {goals.map(([side, type, minute, added, scorer, assist], i) => (
          <li
            key={i}
            className={clsx(
              'flex min-h-8 items-baseline gap-2',
              side === 1 && 'flex-row-reverse text-right',
            )}
          >
            <span className="w-14 shrink-0 text-muted tabular-nums">
              {minuteText(minute, added)}
            </span>
            <span className="min-w-0">
              <span className="font-medium">
                {scorer ?? 'Unknown'}
                {tag(type)}
              </span>
              {assist && <span className="text-muted"> · {assist}</span>}
            </span>
          </li>
        ))}
      </ul>
      {kicks.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-semibold">
            Penalty shoot-out{f.pens && ` ${f.pens[0]} – ${f.pens[1]}`}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Array.from({ length: Math.max(home.length, away.length) }, (_, i) =>
              [home[i], away[i]].map((k, side) =>
                k ? (
                  <span
                    key={`${i}-${side}`}
                    className={clsx(
                      'flex min-h-7 min-w-0 items-center gap-2',
                      side === 1 && 'flex-row-reverse text-right',
                    )}
                  >
                    <span
                      className={clsx(
                        'size-2.5 shrink-0 rounded-full',
                        k[1] === EVENT.kickScored ? 'bg-emerald-400' : 'bg-red-400',
                      )}
                      aria-label={k[1] === EVENT.kickScored ? 'Scored' : 'Missed'}
                    />
                    <span className="min-w-0 truncate">{k[4] ?? 'Unknown'}</span>
                  </span>
                ) : (
                  <span key={`${i}-${side}`} />
                ),
              ),
            )}
          </div>
        </>
      )}
    </Card>
  )
}
