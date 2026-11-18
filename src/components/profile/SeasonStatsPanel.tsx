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
const slug = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, '-')

/** A player's season stats from the save imports: every figure, in boxes, with per 90. */
export function SeasonStatsPanel({ uid }: { uid: number }) {
  const career = useCurrentCareer()
  const { data: seasons, isPending: listing } = useStatsSeasons(career.id)
  const [picked, setPicked] = useState<number | null>(null)
  const season = picked ?? seasons?.[0] ?? null
  const [kind, setKind] = useState<StatKind>('overall')
  const { data: file, isPending, error } = useSeasonStats(career.id, season)
  const s = useMemo(() => (file ? statsIndex(file, kind).get(uid) : undefined), [file, kind, uid])
  // Boxes of rows: totals (with per 90 where it means something), then shares
  const groups = useMemo(() => {
    if (!s) return []
    return STAT_GROUPS.map((name) => {
      const totals = Object.entries(STAT_INFO).filter(([, i]) => i.group === name)
      const shares = METRICS.filter(
        (m) => m.group === name && !(m.key in STAT_INFO) && !m.key.endsWith('/90'),
      )
      return {
        name,
        per90: totals.some(([, i]) => i.per90),
        rows: [
          ...totals.map(([key, i]) => ({
            key,
            label: i.label,
            total: formatMetric(key, metricValue(s, key)),
            per90: i.per90 ? formatMetric(`${key}/90`, metricValue(s, `${key}/90`)) : '',
          })),
          ...shares.map((m) => ({
            key: m.key,
            label: m.label,
            total: formatMetric(m.key, metricValue(s, m.key)),
            per90: '',
          })),
        ],
        // Goalkeeping only for players with goalkeeping figures
        empty: totals.every(([key]) => !s[key]),
      }
    }).filter((g) => !(g.name === 'Goalkeeping' && g.empty))
  }, [s])

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
        <>
          {/* Jump to a box */}
          <nav className="flex flex-wrap gap-1.5" aria-label="Stat boxes">
            {groups.map((g) => (
              <a
                key={g.name}
                href={`#stats-${slug(g.name)}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(`stats-${slug(g.name)}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="min-h-8 rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-text"
              >
                {g.name}
              </a>
            ))}
          </nav>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <section
                key={g.name}
                id={`stats-${slug(g.name)}`}
                className="min-w-0 scroll-mt-24 self-start rounded-xl border border-border bg-surface p-4"
              >
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-[11px] tracking-wide text-muted uppercase">
                      <th className="pb-1.5 text-left font-semibold">{g.name}</th>
                      <th className="w-16 pb-1.5 text-right font-semibold">Total</th>
                      {g.per90 && <th className="w-16 pb-1.5 text-right font-semibold">Per 90</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.key} className="border-t border-border/40">
                        <td className="py-1.5 pr-2 text-muted">{r.label}</td>
                        <td className="py-1.5 text-right font-medium">{r.total}</td>
                        {g.per90 && <td className="py-1.5 text-right text-muted">{r.per90}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
