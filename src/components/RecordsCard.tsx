import { useAllCompetitions } from '../competitions/hooks'
import { matchFormations } from '../competitions/formation'
import { allGames, recordBy, type PlayedGame, type Record3 } from '../competitions/records'
import { useMatchLog } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { Card } from './ui'

/** Your record by formation: yours and the opponent's, from the save (or your match log). */
export function RecordsCard() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data } = useAllCompetitions(career.id)
  const log = useMatchLog(career.id)
  const games = allGames(data, config)
  const formations = (g: PlayedGame) => {
    const both = matchFormations(g.file, g.compId, g.f)
    const home = g.f.home === g.file.club
    return { mine: home ? both.home : both.away, theirs: home ? both.away : both.home }
  }
  const rows = log.data ?? []
  const tables: [string, [string, Record3][]][] = [
    [
      'Against opponent formations',
      recordBy(games, rows, (r, g) => r?.opponent_formation ?? formations(g).theirs),
    ],
    ['With your formations', recordBy(games, rows, (_, g) => formations(g).mine)],
  ]
  if (tables.every(([, t]) => t.length === 0)) return null
  return (
    <Card className="mt-6">
      <h2 className="mb-1 font-semibold">Your records</h2>
      <p className="mb-3 text-xs text-muted">
        Formations from the positions the save records for each match (or what you wrote in the
        match log).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {tables.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {title}
            </h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">Nothing logged yet.</p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {rows.map(([k, r]) => (
                    <tr key={k} className="border-t border-border">
                      <td className="max-w-40 truncate py-1.5 pr-2">{k}</td>
                      <td className="py-1.5 text-right text-muted">{r.played}</td>
                      <td className="py-1.5 text-right text-emerald-400">{r.won}W</td>
                      <td className="py-1.5 text-right">{r.drawn}D</td>
                      <td className="py-1.5 text-right text-red-400">{r.lost}L</td>
                      <td className="py-1.5 text-right text-muted">
                        {r.gf}–{r.ga}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </Card>
  )
}
