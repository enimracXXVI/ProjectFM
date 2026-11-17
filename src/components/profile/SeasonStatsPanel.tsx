import { useMemo, useState } from 'react'
import { useCurrentCareer } from '../../lib/career'
import { seasonText } from '../../data/seasons'
import { useSeasonStats, useStatsSeasons } from '../../world/hooks'
import {
  METRICS,
  STAT_GROUPS,
  STAT_INFO,
  STAT_KINDS,
  formatMetric,
  metricValue,
  statsIndex,
  type StatKind,
} from '../../world/stats'

const select = 'min-h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm'

/** A player's season stats from the save imports: every figure, in boxes, with per 90. */
export function SeasonStatsPanel({ uid }: { uid: number }) {
  const career = useCurrentCareer()
  const { data: seasons, isPending: listing } = useStatsSeasons(career.id)
  const [picked, setPicked] = useState<number | null>(null)
  const season = picked ?? seasons?.[0] ?? null
  const [kind, setKind] = useState<StatKind>('overall')
  const { data: file, isPending, error } = useSeasonStats(career.id, season)
  const s = useMemo(() => (file ? statsIndex(file, kind).get(uid) : undefined), [file, kind, uid])

  if (listing) return <p className="text-sm text-muted">Loading…</p>
  if (!seasons?.length)
    return (
      <p className="text-sm text-muted">
        No season stats yet: they are stored for every player from the next save import on.
      </p>
    )
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Season"
          value={season ?? ''}
          onChange={(e) => setPicked(Number(e.target.value))}
          className={select}
        >
          {seasons.map((y) => (
            <option key={y} value={y}>
              {seasonText(y)}
            </option>
          ))}
        </select>
        <select
          aria-label="Competitions"
          value={kind}
          onChange={(e) => setKind(e.target.value as StatKind)}
          className={select}
        >
          {STAT_KINDS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-red-400">{error.message}</p>
      ) : isPending ? (
        <p className="text-sm text-muted">Opening the season stats…</p>
      ) : !s ? (
        <p className="text-sm text-muted">No minutes in these competitions this season.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STAT_GROUPS.map((g) => {
            const rows = Object.entries(STAT_INFO).filter(([, i]) => i.group === g)
            const shares = METRICS.filter(
              (m) => m.group === g && !(m.key in STAT_INFO) && !m.key.endsWith('/90'),
            )
            if (rows.every(([k]) => !s[k]) && g === 'Goalkeeping') return null
            return (
              <section
                key={g}
                className="self-start rounded-xl border border-border bg-surface p-4"
              >
                <h2 className="mb-1.5 flex justify-between text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {g}
                  <span>Total · per 90</span>
                </h2>
                <dl className="grid text-sm">
                  {rows.map(([k, info]) => (
                    <div
                      key={k}
                      className="flex min-h-8 items-center justify-between gap-3 border-b border-border/40 last:border-0"
                    >
                      <dt className="text-muted">{info.label}</dt>
                      <dd className="flex gap-3 text-right tabular-nums">
                        <span className="font-medium">{formatMetric(k, metricValue(s, k))}</span>
                        {info.per90 && (
                          <span className="w-12 text-muted">
                            {formatMetric(`${k}/90`, metricValue(s, `${k}/90`))}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                  {shares.map((m) => (
                    <div
                      key={m.key}
                      className="flex min-h-8 items-center justify-between gap-3 border-b border-border/40 last:border-0"
                    >
                      <dt className="text-muted">{m.label}</dt>
                      <dd className="font-medium tabular-nums">
                        {formatMetric(m.key, metricValue(s, m.key))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
