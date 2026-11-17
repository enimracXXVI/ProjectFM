import { clsx } from 'clsx'
import { HIDDEN_NAMES } from '../../data/attributeInfo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { attributeLabel } from '../../data/config'
import type { SnapshotRow } from '../../data/db'
import { attrNumber } from '../../lib/attributes'
import { useConfig } from '../../lib/config'
import { computeDevelopment } from '../../lib/development'

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })

/**
 * A player's development: one dot per stored copy of his attributes (every import that
 * changed something), as a total, a group, one attribute, or CA when hidden values are shown.
 */
export function DevChart({
  snapshots,
  goalkeeper,
}: {
  snapshots: SnapshotRow[]
  goalkeeper: boolean
}) {
  const config = useConfig()
  // Draw at the real width so text keeps its size on any screen
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [snapshots.length])
  const list = useMemo(
    () =>
      snapshots
        .filter((s) => Object.keys(s.attributes).length > 0)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [snapshots],
  )
  // Hidden values are not stored with each import, so their sections are left out
  const sections = config.layout[goalkeeper ? 'goalkeepers' : 'outfield']
    .flat()
    .filter((s) => !s.attributes.every((a) => HIDDEN_NAMES.has(a)))
  const hasCA = config.showHidden && list.some((s) => s.extra?.CA)
  const [metric, setMetric] = useState('total')

  const last = list.at(-1)
  const names = last ? Object.keys(last.attributes) : []
  const valueAt = (s: SnapshotRow): number | null => {
    if (metric === 'CA') return s.extra?.CA ? Number(s.extra.CA) || null : null
    const group =
      metric === 'total'
        ? names
        : (sections.find((x) => x.label === metric)?.attributes ?? [metric])
    let sum = 0
    let any = false
    for (const n of group) {
      const v = attrNumber(s.attributes[n])
      if (v === null) continue
      sum += v
      any = true
    }
    return any ? sum : null
  }
  const points = list.map((s) => ({ s, v: valueAt(s) })).filter((p) => p.v !== null) as {
    s: SnapshotRow
    v: number
  }[]
  const dev = computeDevelopment(list, null)[0]

  if (list.length === 0)
    return <p className="text-sm text-muted">No attributes stored for this player yet.</p>

  const H = 200
  const pad = { l: 36, r: 16, t: 14, b: 26 }
  const vs = points.map((p) => p.v)
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const span = hi - lo || 1
  const x = (i: number) =>
    points.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => H - pad.b - ((v - lo) / span) * (H - pad.t - pad.b)
  // Up to six date labels, evenly picked
  // Date labels about 90px apart, and never crowding the last one
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 90))))
  const lastIdx = points.length - 1

  const chip = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={metric === key}
      onClick={() => setMetric(key)}
      className={clsx(
        'min-h-8 rounded-full border px-3 text-xs',
        metric === key ? 'border-accent text-accent' : 'border-border text-muted hover:text-text',
      )}
    >
      {label}
    </button>
  )
  const picked = metric !== 'total' && metric !== 'CA' && !sections.some((s) => s.label === metric)

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chip('total', 'Attributes total')}
        {sections.map((s) => chip(s.label, s.label))}
        {hasCA && chip('CA', 'CA')}
        <select
          aria-label="One attribute"
          value={picked ? metric : ''}
          onChange={(e) => e.target.value && setMetric(e.target.value)}
          className={clsx(
            'min-h-8 rounded-full border bg-surface-2 px-2 text-xs',
            picked ? 'border-accent text-accent' : 'border-border text-muted',
          )}
        >
          <option value="">One attribute…</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {attributeLabel(config, n)}
            </option>
          ))}
        </select>
      </div>

      <div ref={box}>
        {points.length === 0 ? (
          <p className="text-sm text-muted">Nothing stored for this choice.</p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="Development chart"
          >
            {[lo, (lo + hi) / 2, hi].map((v, i) => (
              <g key={i}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-border"
                  strokeDasharray="3 4"
                />
                <text
                  x={pad.l - 6}
                  y={y(v) + 4}
                  textAnchor="end"
                  className="fill-muted"
                  fontSize="11"
                >
                  {Math.round(v * 10) / 10}
                </text>
              </g>
            ))}
            <polyline
              fill="none"
              className="stroke-accent"
              strokeWidth="2.5"
              points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}
            />
            {points.map((p, i) => (
              <g key={p.s.id}>
                <circle cx={x(i)} cy={y(p.v)} r="4" className="fill-accent">
                  <title>
                    {`${date(p.s.created_at)}${p.s.season ? ` · ${p.s.season}` : ''}${p.s.age ? ` · age ${p.s.age}` : ''}: ${Math.round(p.v * 10) / 10}`}
                  </title>
                </circle>
                {(i === lastIdx || (i % step === 0 && lastIdx - i >= step)) && (
                  <text
                    x={x(i)}
                    y={H - 6}
                    textAnchor={i === 0 ? 'start' : i === lastIdx ? 'end' : 'middle'}
                    className="fill-muted"
                    fontSize="11"
                  >
                    {date(p.s.created_at)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>

      {dev ? (
        <p className="mt-2 text-sm">
          Since {date(dev.from)}:{' '}
          <span
            className={clsx('font-semibold', dev.gain >= 0 ? 'text-emerald-400' : 'text-red-400')}
          >
            {dev.gain > 0 ? `+${dev.gain}` : dev.gain}
          </span>
          {dev.changes.length > 0 &&
            ` · ${dev.changes
              .slice(0, 8)
              .map(
                (c) =>
                  `${attributeLabel(config, c.name)} ${c.diff > 0 ? '+' : '−'}${Math.abs(c.diff)}`,
              )
              .join(', ')}`}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          One stored copy so far: changes show after the next import.
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        Each save or view import keeps a copy of the player&apos;s attributes when something
        changed; each dot is one copy (hover or long-press a dot for its date, season and age).
      </p>
    </div>
  )
}
