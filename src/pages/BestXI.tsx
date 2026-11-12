import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { bestXi, playerTotals, type PlayerSeason } from '../competitions/bestXi'
import { useAllCompetitions } from '../competitions/hooks'
import { seasonLabel } from '../competitions/view'
import { usePlayers, useTactics } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { shortName } from '../lib/names'
import { TEXT, useUrlState } from '../lib/urlState'
import { useSaveConfig } from '../lib/useSaveConfig'
import { formationLabel, pitchPlaces } from '../tactics/positions'
import type { PositionCode } from '../tactics/types'

const ratingColor = (r: number) =>
  r >= 7.5
    ? 'text-emerald-400'
    : r >= 7
      ? 'text-lime-300'
      : r >= 6.5
        ? 'text-text'
        : 'text-amber-400'

/** The club's Best XI for one season, or over every season, in the main tactic's shape. */
export function BestXI() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data: files, isPending } = useAllCompetitions(career.id)
  const { data: players } = usePlayers(career.id)
  const { data: tactics } = useTactics(career.id)
  const [season, setSeason] = useUrlState('season', 'all', TEXT)

  // Main tactic: the save's first tactic, else the first one made in the app
  const main = [...(tactics ?? [])].sort(
    (a, b) =>
      (a.save_index ?? 99) - (b.save_index ?? 99) || a.created_at.localeCompare(b.created_at),
  )[0]
  const formation = (main?.slots ?? []).map((s) => s.position).filter((p): p is PositionCode => !!p)

  const chosen = season === 'all' ? files : files.filter((f) => String(f.season) === season)
  const kindOf = (db: number | null) =>
    db === null ? null : (config.competitions[db]?.kind ?? null)
  const totals = playerTotals(chosen, kindOf, config.bestXiBaseline)
  const byUid = new Map((players ?? []).map((p) => [p.fm_uid, p]))
  const xi =
    formation.length === 11
      ? bestXi(formation, totals, (id) => byUid.get(id)?.positions ?? null)
      : []
  const places = pitchPlaces(formation)
  const inXi = new Set(xi.map((s) => s.player?.id))
  const rest = totals
    .filter((p) => !inXi.has(p.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)

  return (
    <>
      <Link
        to="/squad"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Squad
      </Link>
      <PageHeader
        title="Best XI"
        subtitle={`${season === 'all' ? 'All seasons' : seasonLabel(Number(season))} · league and cups · ${formationLabel(formation)}`}
        actions={
          <select
            aria-label="Season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            <option value="all">All seasons</option>
            {[...files].reverse().map((f) =>
              f.season !== null ? (
                <option key={f.season} value={String(f.season)}>
                  {seasonLabel(f.season)}
                </option>
              ) : null,
            )}
          </select>
        }
      />
      {isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : formation.length !== 11 ? (
        <Placeholder>
          The Best XI takes the shape of your main tactic. Import your save (or make a tactic)
          first.
        </Placeholder>
      ) : !totals.length ? (
        <Placeholder>No official matches with player ratings yet.</Placeholder>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/60 bg-emerald-950/40">
            <div className="absolute inset-x-[20%] top-0 h-[12%] border-x border-b border-emerald-800/50" />
            <div className="absolute inset-x-[20%] bottom-0 h-[12%] border-x border-t border-emerald-800/50" />
            <div className="absolute inset-x-0 top-1/2 border-t border-emerald-800/50" />
            {xi.map((s) => {
              const { x, y } = places[s.slot]
              const row = s.player ? byUid.get(s.player.id) : undefined
              const inner = (
                <>
                  <span className="block text-[10px] text-muted">{s.position}</span>
                  <span className="block truncate text-[11px] font-semibold">
                    {s.player ? (row ? shortName(row) : s.player.name) : '–'}
                  </span>
                  {s.player && (
                    <span
                      className={clsx(
                        'block text-[10px] font-semibold',
                        ratingColor(s.player.rating),
                      )}
                    >
                      {s.player.rating.toFixed(2)} · {s.player.matches}
                    </span>
                  )}
                </>
              )
              const cls =
                'absolute w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface/95 px-1 py-1 text-center leading-tight shadow'
              const style = { left: `${x * 100}%`, top: `${(1 - y) * 100}%` }
              return row ? (
                <Link key={s.slot} to={`/squad/${row.id}`} className={cls} style={style}>
                  {inner}
                </Link>
              ) : (
                <div key={s.slot} className={cls} style={style}>
                  {inner}
                </div>
              )
            })}
          </div>
          <Card>
            <h2 className="mb-2 font-semibold">Ranking</h2>
            <p className="mb-2 text-xs text-muted">
              Score: average rating above the baseline × matches played (by minutes). Playing often
              counts, so regulars beat short bursts. Players who left the club count too.
            </p>
            <BaselineField />
            <RankTable
              rows={[...xi.flatMap((s) => (s.player ? [s.player] : [])), ...rest]}
              xi={inXi}
              rowOf={(id) => byUid.get(id)}
            />
          </Card>
        </div>
      )}
    </>
  )
}

function RankTable({
  rows,
  xi,
  rowOf,
}: {
  rows: PlayerSeason[]
  xi: Set<number | undefined>
  rowOf: (id: number) => { id: string; in_squad: boolean } | undefined
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 text-left font-normal">Player</th>
            <th className="px-2 py-1 text-right font-normal">Apps</th>
            <th className="px-2 py-1 text-right font-normal">Min</th>
            <th className="px-2 py-1 text-right font-normal">Avg</th>
            <th className="py-1 pl-2 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => b.score - a.score)
            .map((p) => {
              const row = rowOf(p.id)
              return (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      {row ? (
                        <Link to={`/squad/${row.id}`} className="hover:text-accent">
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                      {xi.has(p.id) && (
                        <span className="rounded bg-accent/15 px-1 text-[10px] font-semibold text-accent">
                          XI
                        </span>
                      )}
                      {row && !row.in_squad && <span className="text-xs text-muted">left</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{p.matches}</td>
                  <td className="px-2 py-1.5 text-right">{p.minutes}</td>
                  <td className={clsx('px-2 py-1.5 text-right', ratingColor(p.rating))}>
                    {p.rating.toFixed(2)}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold">{p.score.toFixed(1)}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

/** The rating a player must beat to add to his score (saved in Settings). */
function BaselineField() {
  const { bestXiBaseline } = useConfig()
  const { save } = useSaveConfig('bestXiBaseline')
  return (
    <label className="mb-3 flex items-center gap-2 text-sm text-muted">
      Baseline rating
      <input
        type="number"
        step="0.1"
        min="0"
        max="10"
        defaultValue={bestXiBaseline}
        key={bestXiBaseline}
        onBlur={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v !== bestXiBaseline) save.mutate(v)
        }}
        className="min-h-10 w-20 rounded-lg border border-border bg-surface-2 px-2 text-center text-text"
      />
    </label>
  )
}
