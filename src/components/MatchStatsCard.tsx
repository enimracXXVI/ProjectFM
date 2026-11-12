import { clsx } from 'clsx'
import { useState } from 'react'
import { matchStats, teamMatchStats, type StatRow } from '../competitions/matchStats'
import type { RawTeamStats, TeamStats } from '../competitions/types'
import { Card } from './ui'

/** Team stats side by side, with bars and FM's two tabs (Key Stats, Advanced Stats). */
export function MatchStatsCard({
  home,
  away,
  homeTeam,
  awayTeam,
  rating,
  homeName,
  awayName,
}: {
  home?: RawTeamStats | null
  away?: RawTeamStats | null
  homeTeam?: TeamStats | null
  awayTeam?: TeamStats | null
  /** Average match rating of each side, from the players' own ratings. */
  rating?: [number | null, number | null]
  homeName: string
  awayName: string
}) {
  const [tab, setTab] = useState<'key' | 'advanced'>('key')
  const named = homeTeam && awayTeam ? teamMatchStats(homeTeam, awayTeam, rating) : null
  const rows: StatRow[] = named ? named[tab] : home && away ? matchStats(home, away) : []
  if (!rows.length) return null
  const show = (v: number, f?: 'pct' | 'dec') =>
    f === 'pct' ? `${v}%` : f === 'dec' ? v.toFixed(2) : String(v)
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2 font-semibold">
        <span className="min-w-0 truncate">{homeName}</span>
        {named ? (
          <span className="flex shrink-0 gap-1 text-sm" role="tablist">
            {(
              [
                ['key', 'Key stats'],
                ['advanced', 'Advanced'],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  'min-h-9 rounded-lg px-2',
                  tab === t ? 'bg-surface-2 text-text' : 'font-normal text-muted hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-sm text-muted">Match stats</span>
        )}
        <span className="min-w-0 truncate text-right">{awayName}</span>
      </div>
      <ul className="grid gap-3">
        {rows.map((r) => {
          const total = r.home + r.away
          const hw = total > 0 ? (r.home / total) * 100 : 50
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                <span className="font-semibold">{r.homeText ?? show(r.home, r.format)}</span>
                <span className="text-center text-muted">{r.label}</span>
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
      {!named && (
        <p className="mt-3 text-xs text-muted">
          Import your save again to see every stat of FM’s match stats screen.
        </p>
      )}
    </Card>
  )
}
