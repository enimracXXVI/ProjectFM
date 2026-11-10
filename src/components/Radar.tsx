import { useState } from 'react'

export interface RadarSeries {
  name: string
  color: string
  /** One value per axis (1–20); null when unknown. */
  values: (number | null)[]
}

const SIZE = 320
const C = SIZE / 2
const R = 110
const MAX = 20
const RINGS = [5, 10, 15, 20]

const point = (i: number, n: number, v: number) => {
  const a = (Math.PI * 2 * i) / n - Math.PI / 2
  const r = (Math.max(0, Math.min(MAX, v)) / MAX) * R
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const
}

/**
 * Radar chart for 1–5 players on a 0–20 scale. Hovering (or tapping) an axis shows
 * every player's value for it.
 */
export function Radar({
  title,
  axes,
  series,
}: {
  title: string
  axes: string[]
  series: RadarSeries[]
}) {
  const [active, setActive] = useState<number | null>(null)
  const n = axes.length
  if (n < 3) return null

  const ring = (v: number) => axes.map((_, i) => point(i, n, v).join(',')).join(' ')

  return (
    <figure className="rounded-xl border border-border bg-surface p-3">
      <figcaption className="mb-1 text-sm font-semibold">{title}</figcaption>
      <div className="relative mx-auto max-w-[340px]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`${title}: ${series.map((s) => s.name).join(', ')}`}
          onPointerLeave={() => setActive(null)}
        >
          {/* Recessive grid */}
          {RINGS.map((v) => (
            <polygon
              key={v}
              points={ring(v)}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          ))}
          {axes.map((_, i) => {
            const [x, y] = point(i, n, MAX)
            return (
              <line
                key={i}
                x1={C}
                y1={C}
                x2={x}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={active === i ? 2 : 1}
              />
            )
          })}

          {series.map((s) => {
            const pts = s.values.map((v, i) => point(i, n, v ?? 0).join(',')).join(' ')
            return (
              <g key={s.name}>
                <polygon
                  points={pts}
                  fill={s.color}
                  fillOpacity={0.12}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {s.values.map((v, i) => {
                  if (v === null) return null
                  const [x, y] = point(i, n, v)
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={active === i ? 5 : 3.5}
                      fill={s.color}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Axis labels double as hit targets */}
          {axes.map((label, i) => {
            const [x, y] = point(i, n, MAX + 3.2)
            const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end'
            return (
              <g
                key={label}
                onPointerEnter={() => setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
                className="cursor-pointer"
              >
                <path
                  d={`M${C},${C} L${point(i - 0.5, n, MAX + 6).join(',')} L${point(i + 0.5, n, MAX + 6).join(',')} Z`}
                  fill="transparent"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill={active === i ? 'var(--color-text)' : 'var(--color-muted)'}
                  fontWeight={active === i ? 600 : 400}
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* Values for the hovered / tapped axis, under the chart so nothing is covered */}
      <div role="status" className="mt-1 min-h-14 rounded-lg bg-surface-2/60 px-3 py-2 text-xs">
        {active === null ? (
          <p className="text-muted">Hover or tap an axis label to see the values.</p>
        ) : (
          <>
            <p className="mb-1 font-semibold">{axes[active]}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {series.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted">{s.name}</span>
                  <span className="font-semibold tabular-nums">
                    {s.values[active] === null ? '–' : Math.round(s.values[active]! * 10) / 10}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </figure>
  )
}
