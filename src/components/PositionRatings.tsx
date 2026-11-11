import { clsx } from 'clsx'
import { attrColor } from '../lib/attributes'

/** FM's 15 positions laid out like a pitch (attack at the top). */
const PITCH: (string | null)[][] = [
  [null, null, 'ST', null, null],
  ['AML', null, 'AMC', null, 'AMR'],
  ['ML', null, 'MC', null, 'MR'],
  ['WBL', null, 'DM', null, 'WBR'],
  ['DL', null, 'DC', null, 'DR'],
  [null, null, 'SW', null, null],
  [null, null, 'GK', null, null],
]

/** Position ratings (1–20) on a small pitch, coloured like attributes. */
export function PositionRatings({ ratings }: { ratings: Record<string, number> }) {
  if (Object.keys(ratings).length === 0) return null
  return (
    <section className="mb-5">
      <h2 className="mb-2 border-b border-border pb-1 text-xs font-semibold text-muted">
        Position ratings (1–20)
      </h2>
      <div className="mx-auto grid max-w-xs grid-cols-5 gap-1 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-2">
        {PITCH.flat().map((pos, i) => {
          const v = pos ? ratings[pos] : undefined
          return pos && v !== undefined ? (
            <div
              key={pos}
              className={clsx(
                'grid h-10 place-items-center rounded-md bg-surface text-center leading-tight',
                v >= 15 ? 'ring-1 ring-emerald-500/60' : '',
              )}
              title={`${pos}: ${v}`}
            >
              <span className="text-[10px] text-muted">{pos}</span>
              <span className={clsx('text-sm font-semibold tabular-nums', attrColor(v))}>{v}</span>
            </div>
          ) : (
            <div key={`gap-${i}`} />
          )
        })}
      </div>
    </section>
  )
}
