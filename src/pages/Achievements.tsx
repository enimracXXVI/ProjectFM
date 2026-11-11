import { Trophy } from 'lucide-react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useAllCompetitions } from '../competitions/hooks'
import { achievements } from '../competitions/records'
import { seasonLabel } from '../competitions/view'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'

/** Trophies and final standings, worked out from the results of every saved season. */
export function Achievements() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data, isPending, error } = useAllCompetitions(career.id)
  const list = achievements(data, config)
  const trophies = list.filter((a) => a.trophy)
  const seasons = [...new Set(list.map((a) => a.season))].sort((a, b) => (b ?? 0) - (a ?? 0))

  return (
    <>
      <PageHeader title="Achievements" subtitle="Trophies and final standings, from your results" />
      {isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <Placeholder>{error.message}</Placeholder>
      ) : list.length === 0 ? (
        <Placeholder>
          Import your save to see your standings.{' '}
          <Link to="/import" className="text-accent underline">
            Import
          </Link>
        </Placeholder>
      ) : (
        <>
          <Card className="mb-5">
            <h2 className="mb-3 font-semibold">Trophy cabinet</h2>
            {trophies.length === 0 ? (
              <p className="text-sm text-muted">
                No trophies yet. They appear here when you win one.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {trophies.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3"
                  >
                    <Trophy className="size-6 text-amber-300" aria-hidden />
                    <span>
                      <span className="block font-semibold">{t.competition}</span>
                      <span className="text-xs text-muted">
                        {t.season ? seasonLabel(t.season) : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {seasons.map((season) => (
            <section key={season} className="mb-4">
              <h2 className="mb-2 text-sm font-semibold">
                {season ? seasonLabel(season) : 'Season'}
              </h2>
              <Card className="grid gap-1 p-2">
                {list
                  .filter((a) => a.season === season)
                  .map((a, i) => (
                    <Link
                      key={i}
                      to={`/competitions/${a.compDbId}?season=${season ?? ''}`}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate">{a.competition}</span>
                      <span
                        className={clsx(
                          'font-semibold',
                          a.trophy ? 'text-amber-300' : a.finished ? '' : 'text-muted',
                        )}
                      >
                        {a.trophy && <Trophy className="mr-1 inline size-4" aria-hidden />}
                        {a.result}
                      </span>
                    </Link>
                  ))}
              </Card>
            </section>
          ))}
          <p className="text-xs text-muted">
            Worked out from the results in your saves: a league counts as finished when every game
            is played; a cup when its final is played. Cup ties decided on penalties are not read
            from the save yet.
          </p>
        </>
      )}
    </>
  )
}
