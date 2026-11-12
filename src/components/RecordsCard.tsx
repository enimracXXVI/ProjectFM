import { useAllCompetitions } from '../competitions/hooks'
import { allGames, recordBy, type Record3 } from '../competitions/records'
import { useMatchLog } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { Card } from './ui'

/** Your record by opponent formation, from the match log. */
export function RecordsCard() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data } = useAllCompetitions(career.id)
  const log = useMatchLog(career.id)
  if (!log.data?.length) return null
  const games = allGames(data, config)
  const tables: [string, [string, Record3][]][] = [
    ['Against opponent formations', recordBy(games, log.data, (r) => r.opponent_formation)],
  ]
  return (
    <Card className="mt-6">
      <h2 className="mb-1 font-semibold">Your records</h2>
      <p className="mb-3 text-xs text-muted">From the games you filled in on the match log.</p>
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
