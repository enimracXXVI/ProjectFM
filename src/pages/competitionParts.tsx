import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { Fixture } from '../competitions/types'
import { fixtureKey, resultFor, scoreText } from '../competitions/view'

const RESULT_COLOR = {
  W: 'bg-emerald-500 text-black',
  D: 'bg-slate-400 text-black',
  L: 'bg-red-500 text-white',
}

export function ResultBadge({ r }: { r: 'W' | 'D' | 'L' | null }) {
  if (!r) return null
  return (
    <span
      className={clsx(
        'inline-grid size-5 shrink-0 place-items-center rounded text-[11px] font-bold',
        RESULT_COLOR[r],
      )}
    >
      {r}
    </span>
  )
}

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : ''

/** One fixture as a row: date, home, score, away. The club's own games link to the match page. */
export function FixtureRow({
  f,
  club,
  compDbId,
  label,
  showDate = true,
}: {
  f: Fixture
  club: number
  compDbId: number | null
  /** Shown above the date, e.g. "MD1" or a cup round. */
  label?: string | null
  showDate?: boolean
}) {
  const mine = f.home === club || f.away === club
  const content = (
    <>
      {showDate && (
        <span className="grid w-14 shrink-0 leading-tight">
          {label && <span className="truncate text-[11px] font-semibold text-accent">{label}</span>}
          <span className="text-xs text-muted">{fmtDate(f.date)}</span>
        </span>
      )}
      <span
        className={clsx('min-w-0 flex-1 truncate text-right', f.home === club && 'font-semibold')}
      >
        {f.homeShort ?? f.homeName}
      </span>
      <span
        className={clsx(
          'w-16 shrink-0 rounded px-1 py-0.5 text-center text-sm tabular-nums',
          f.played ? 'bg-surface-2 font-semibold' : 'text-muted',
        )}
      >
        {scoreText(f)}
      </span>
      <span className={clsx('min-w-0 flex-1 truncate', f.away === club && 'font-semibold')}>
        {f.awayShort ?? f.awayName}
      </span>
      <span className="w-5 shrink-0">
        <ResultBadge r={mine ? resultFor(f, club) : null} />
      </span>
    </>
  )
  const cls = clsx(
    'flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm',
    mine && 'bg-accent/5',
  )
  return mine && f.played ? (
    <Link
      to={`/competitions/${compDbId}/match/${fixtureKey(f)}?season=${f.season ?? ''}`}
      className={clsx(cls, 'hover:bg-surface-2')}
    >
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  )
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div
      className="mb-3 flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-lg border border-border p-1 [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            'min-h-9 flex-1 shrink-0 rounded-md px-3 text-sm whitespace-nowrap',
            value === v ? 'bg-surface-2 font-semibold text-text' : 'text-muted hover:text-text',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
