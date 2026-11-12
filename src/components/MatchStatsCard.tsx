import { matchStats } from '../competitions/matchStats'
import type { RawTeamStats } from '../competitions/types'
import { Card } from './ui'

/** Team stats side by side, with bars like FM's match stats screen. */
export function MatchStatsCard({
  home,
  away,
  homeName,
  awayName,
}: {
  home: RawTeamStats
  away: RawTeamStats
  homeName: string
  awayName: string
}) {
  const rows = matchStats(home, away)
  const show = (v: number, f?: 'pct' | 'dec') =>
    f === 'pct' ? `${v}%` : f === 'dec' ? v.toFixed(2) : String(v)
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between font-semibold">
        <span>{homeName}</span>
        <span className="text-sm text-muted">Match stats</span>
        <span>{awayName}</span>
      </div>
      <ul className="grid gap-3">
        {rows.map((r) => {
          const total = r.home + r.away
          const hw = total > 0 ? (r.home / total) * 100 : 50
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                <span className="font-semibold">{r.homeText ?? show(r.home, r.format)}</span>
                <span className="text-muted">{r.label}</span>
                <span className="font-semibold">{r.awayText ?? show(r.away, r.format)}</span>
              </div>
              <div className="mt-1 flex h-1.5 gap-1">
                <span className="rounded-full bg-accent" style={{ width: `${hw}%` }} />
                <span className="flex-1 rounded-full bg-slate-500/60" />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Matched to FM’s match stats screen for two games. Shots on target, long shots, crosses,
        progressive passes, ball share, distance, red cards and average rating are not read yet.
      </p>
    </Card>
  )
}
