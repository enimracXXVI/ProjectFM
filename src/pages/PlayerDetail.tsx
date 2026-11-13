import { clsx } from 'clsx'
import { ArrowLeft, Scale } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PositionRatings } from '../components/PositionRatings'
import { RoleFitPanel } from '../components/RoleFitPanel'
import { StatusChip } from '../components/StatusChip'
import { TeamSelect } from '../components/TeamSelect'
import { Placeholder } from '../components/ui'
import { usePlayer, useSnapshots } from '../data/hooks'
import { Tooltip } from '../components/Tooltip'
import { isGoalkeeper } from '../data/attributeInfo'
import { HIDDEN_PLAYER_ATTRS, PERSONALITY_KEYS } from '../import/dump'
import { attributeLabel } from '../data/config'
import { compareUrlWith } from '../lib/compare'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import {
  attrColor,
  attrNumber,
  formatAttr,
  parsePositionRatings,
  valueColor,
} from '../lib/attributes'

const HIDDEN_LIST = [...HIDDEN_PLAYER_ATTRS, ...PERSONALITY_KEYS.map(([, label]) => label)]

export function PlayerDetail() {
  const { id = '' } = useParams()
  const config = useConfig()
  const career = useCurrentCareer()
  const navigate = useNavigate()
  const { data: p, isPending, error } = usePlayer(id)
  const { data: allSnapshots } = useSnapshots(id)
  const snapshots = allSnapshots?.filter((s) => Object.keys(s.attributes).length > 0)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error || !p) return <Placeholder>{error?.message ?? 'Player not found'}</Placeholder>

  // Compare with the previous import to show development
  const latest = snapshots?.at(-1) ?? null
  const previous = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  // FM layout: three columns, each with one or more sections; empty sections hidden
  const columns = config.layout[isGoalkeeper(p.positions) ? 'goalkeepers' : 'outfield']
    .map((col) =>
      col
        .map((s) => ({
          ...s,
          attributes: s.attributes.filter((n) => p.attributes[n] !== undefined),
        }))
        .filter((s) => s.attributes.length > 0),
    )
    .filter((col) => col.length > 0)

  return (
    <>
      <Link
        to="/squad"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Squad
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(compareUrlWith(p.id))}
          className="order-last ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-2"
        >
          <Scale className="size-4" aria-hidden /> Compare
        </button>
        {p.squad_number != null && (
          <span className="grid size-12 place-items-center rounded-xl bg-accent/15 text-lg font-bold text-accent">
            {p.squad_number}
          </span>
        )}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {p.name} <StatusChip code={p.extra.status} />
          </h1>
          <p className="text-sm text-muted">
            {p.positions} · {p.age} years · {p.nation}
            {p.second_nation ? ` / ${p.second_nation}` : ''}
            {!p.in_squad && ' · Left the club'}
          </p>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted">Team</span>
        <TeamSelect player={p} />
      </label>

      <dl className="mb-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Info label="Height" value={p.height_cm ? `${p.height_cm} cm` : null} />
        <Info label="Left foot" value={p.left_foot} />
        <Info label="Right foot" value={p.right_foot} />
        <Info label="Personality" value={p.personality} />
        {p.extra.status && (
          <Info label="Status" value={config.statuses[p.extra.status]?.label || p.extra.status} />
        )}
        {p.extra.selection && <Info label="Selection" value={p.extra.selection} />}
        {p.extra.Condition && <Info label="Condition" value={p.extra.Condition} />}
        {p.extra.Morale && <Info label="Morale" value={p.extra.Morale} />}
        {config.showHidden && p.extra.CA && <Info label="CA" value={p.extra.CA} />}
        {config.showHidden && p.extra.PA && <Info label="PA" value={p.extra.PA} />}
      </dl>

      {config.showHidden && HIDDEN_LIST.some((k) => p.extra[k]) && (
        <section className="mb-5">
          <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
            Hidden attributes and personality
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {HIDDEN_LIST.filter((k) => p.extra[k]).map((k) => (
              <Info
                key={k}
                label={k}
                value={p.extra[k]}
                valueClass={valueColor(k, Number(p.extra[k]))}
              />
            ))}
          </dl>
        </section>
      )}

      <PositionRatings ratings={parsePositionRatings(p.extra['Reader positions'])} />

      <RoleFitPanel attributes={p.attributes} positions={p.positions} />

      {[config.views.contract, config.views.stats].map((view) => {
        const items = view.columns.filter((c) => p.extra[c.key] !== undefined)
        if (items.length === 0) return null
        return (
          <section key={view.label} className="mb-5">
            <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
              {view.label}
              {view === config.views.stats && career.current_season
                ? ` · ${career.current_season}`
                : ''}
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {items.map((c) => (
                <Info
                  key={c.key}
                  label={c.label || c.key}
                  value={p.extra[c.key]}
                  description={c.description}
                />
              ))}
            </dl>
          </section>
        )
      })}

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col, ci) => (
          <div key={ci} className="grid content-start gap-4">
            {col.map((section, si) => (
              <section key={si}>
                <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
                  {section.label}
                </h2>
                <ul className="text-sm">
                  {section.attributes.map((n) => {
                    const now = attrNumber(p.attributes[n])
                    const before = previous ? attrNumber(previous.attributes[n]) : null
                    const diff = now !== null && before !== null ? now - before : 0
                    return (
                      <li
                        key={n}
                        className="flex min-h-9 items-center justify-between gap-2 px-3 odd:bg-surface even:bg-surface/40"
                      >
                        <Tooltip
                          title={attributeLabel(config, n)}
                          text={config.attributes[n]?.description || attributeLabel(config, n)}
                        >
                          <span tabIndex={0} className="cursor-help">
                            {attributeLabel(config, n)}
                          </span>
                        </Tooltip>
                        <span className="flex items-center gap-2 tabular-nums">
                          {diff !== 0 && (
                            <span
                              className={
                                diff > 0 ? 'text-xs text-emerald-400' : 'text-xs text-red-400'
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                          <span
                            className={`w-10 rounded bg-surface-2 py-0.5 text-center font-semibold ${attrColor(p.attributes[n])}`}
                          >
                            {formatAttr(p.attributes[n])}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>

      {latest && (
        <p className="mt-4 text-xs text-muted">
          Last updated {new Date(latest.created_at).toLocaleDateString()}
          {latest.season ? ` · season ${latest.season}` : ''}
          {previous &&
            ` · changes compared with ${new Date(previous.created_at).toLocaleDateString()}`}
        </p>
      )}
    </>
  )
}

function Info({
  label,
  value,
  description,
  valueClass,
}: {
  label: string
  value: string | null
  description?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted">
        {description ? (
          <Tooltip title={label} text={description}>
            <span tabIndex={0} className="cursor-help">
              {label}
            </span>
          </Tooltip>
        ) : (
          label
        )}
      </dt>
      <dd className={clsx('font-medium', valueClass)}>{value ?? '–'}</dd>
    </div>
  )
}
