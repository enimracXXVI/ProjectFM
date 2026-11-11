import { ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useCompetitions } from '../competitions/hooks'
import { leagueTable } from '../competitions/league'
import { compInfo, compLabel, myFixtures, resultFor, scoreText } from '../competitions/view'
import { seasonLabel } from '../competitions/view'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { ResultBadge } from './competitionParts'

export function Competitions() {
  const career = useCurrentCareer()
  const config = useConfig()
  const [params, setParams] = useSearchParams()
  const wanted = params.get('season') ? Number(params.get('season')) : null
  const { data, seasons, season, isPending, error } = useCompetitions(career.id, wanted)

  return (
    <>
      <PageHeader title="Competitions" subtitle="Updated every time you import your save" />
      {seasons.length > 1 && (
        <select
          aria-label="Season"
          value={season ?? ''}
          onChange={(e) => setParams({ season: e.target.value })}
          className="mb-4 min-h-11 rounded-lg border border-border bg-surface px-3 text-base md:text-sm"
        >
          {seasons.map((s) => (
            <option key={s.season} value={s.season}>
              {seasonLabel(s.season)}
            </option>
          ))}
        </select>
      )}
      {isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <Placeholder>{error.message}</Placeholder>
      ) : !data ? (
        <Placeholder>
          Import your FM save to see your competitions.{' '}
          <Link to="/import" className="text-accent underline">
            Import
          </Link>
        </Placeholder>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.competitions
            .map((c) => ({ c, info: compInfo(config, c) }))
            .sort(
              (x, y) =>
                ['league', 'cup', 'friendlies'].indexOf(x.info?.kind ?? 'cup') -
                ['league', 'cup', 'friendlies'].indexOf(y.info?.kind ?? 'cup'),
            )
            .map(({ c, info }) => {
              const mine = myFixtures(data, c)
              const last = mine.filter((f) => f.played).at(-1)
              const next = mine.find((f) => !f.played)
              const position =
                info?.kind === 'league'
                  ? leagueTable(c.fixtures).find((r) => r.club === data.club)?.position
                  : null
              return (
                <Link key={c.id} to={`/competitions/${c.databaseId}?season=${data.season}`}>
                  <Card className="h-full transition-colors hover:border-muted">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold">{compLabel(config, c)}</h2>
                        <p className="text-xs text-muted">
                          {info
                            ? info.kind[0].toUpperCase() + info.kind.slice(1)
                            : 'Not named yet (Check in game)'}
                          {' · '}ID {c.databaseId}
                        </p>
                      </div>
                      {position && (
                        <span className="rounded-lg bg-accent/15 px-2 py-1 text-sm font-bold text-accent">
                          {position}
                          {position === 1
                            ? 'st'
                            : position === 2
                              ? 'nd'
                              : position === 3
                                ? 'rd'
                                : 'th'}
                        </span>
                      )}
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </div>
                    <dl className="mt-3 grid gap-1 text-sm">
                      {last && (
                        <div className="flex items-center gap-2">
                          <dt className="w-10 text-xs text-muted">Last</dt>
                          <ResultBadge r={resultFor(last, data.club)} />
                          <dd className="truncate">
                            {last.homeShort} {scoreText(last)} {last.awayShort}
                          </dd>
                        </div>
                      )}
                      {next && (
                        <div className="flex items-center gap-2">
                          <dt className="w-10 text-xs text-muted">Next</dt>
                          <dd className="truncate">
                            {next.date} · {next.homeShort} – {next.awayShort}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                </Link>
              )
            })}
        </div>
      )}
    </>
  )
}
