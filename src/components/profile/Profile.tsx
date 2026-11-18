import { clsx } from 'clsx'
import { ChevronRight, Dumbbell } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { HIDDEN_NAMES } from '../../data/attributeInfo'
import { attributeLabel } from '../../data/config'
import { guideFor } from '../../data/traitGuide'
import { traitNames } from '../../data/traits'
import type { AttributeValue } from '../../import/types'
import { attrColor, attrNumber, formatAttr, scoreTextColor, valueColor } from '../../lib/attributes'
import { useConfig } from '../../lib/config'
import {
  footColor,
  footLevel,
  footTextColor,
  PITCH_SPOTS,
  bestSpot,
  pitchSpots,
  SPOT_POSITION,
} from '../../lib/profile'
import { allRoleFits, scoreColor } from '../../lib/roleFit'
import { Tooltip } from '../Tooltip'

/** Everything the Profile tab shows, the same for squad and world players. */
export interface ProfileData {
  positions: string | null
  /** Position ratings 1–20 by spot (DC, AMR…), when known. */
  ratings?: Record<string, number>
  attributes: Record<string, AttributeValue>
  /** Attributes at the import before, for the +1 / −1 marks. */
  previous?: Record<string, AttributeValue> | null
  /** Attributes the player's training focus works on. */
  trained?: string[]
  trainedBy?: string
  feet: [string | number | null, string | number | null]
  info: { label: string; value: ReactNode }[]
  /** A few short facts for the mobile summary strip. */
  summary: string[]
  /** Trait numbers as stored, "2,8,10". */
  traits: string | null
  /** Hidden column (only when hidden values are shown); `strong` rows (CA, PA) come first. */
  hidden: { label: string; value: number | string | null; strong?: boolean }[] | null
  /** Sections after Traits (Training for your players). */
  sections: { title: string; body: ReactNode }[]
  goalkeeper: boolean
}

const heading = 'mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase'

/** Closes a popover on an outside tap or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return { open, setOpen, ref }
}

const popoverBox =
  'absolute z-30 rounded-xl border border-accent/60 bg-surface p-3 shadow-2xl shadow-black/50'

/** The player's positions on a small pitch; listed positions are big dots. */
function Pitch({
  positions,
  ratings,
  small,
}: {
  positions: string | null
  ratings?: Record<string, number>
  small?: boolean
}) {
  const listed = new Set(pitchSpots(positions))
  const spots = Object.keys(PITCH_SPOTS).filter((s) => listed.has(s) || (ratings?.[s] ?? 0) >= 10)
  return (
    <span
      className={clsx(
        'relative block aspect-[3/4] rounded-lg border border-emerald-800/70 bg-emerald-950/60',
        small ? 'w-14' : 'w-36',
      )}
    >
      {/* Halfway line and centre circle */}
      <span className="absolute inset-x-0 top-1/2 h-px bg-emerald-800/50" />
      {!small && (
        <span className="absolute top-1/2 left-1/2 size-8 -translate-1/2 rounded-full border border-emerald-800/50" />
      )}
      {spots.map((s) => {
        const [x, y] = PITCH_SPOTS[s]
        const r = ratings?.[s]
        const natural = listed.has(s)
        return (
          <span
            key={s}
            title={r !== undefined ? `${s}: ${r}` : s}
            className={clsx(
              'absolute -translate-1/2 rounded-full',
              natural
                ? 'bg-emerald-400'
                : r !== undefined && r >= 15
                  ? 'bg-lime-300'
                  : 'bg-amber-400',
              small ? (natural ? 'size-1.5' : 'size-1') : natural ? 'size-2.5' : 'size-2',
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        )
      })}
    </span>
  )
}

/** Top roles for the player (or for one position), in or out of possession. */
function BestRoles({ data, spot }: { data: ProfileData; spot?: string }) {
  const { roles, roleWeights } = useConfig()
  const [phase, setPhase] = useState<'ip' | 'oop'>('ip')
  // A position, or "natural" for all the positions he plays
  const [selected, setSelected] = useState(spot ?? 'natural')
  const fits = useMemo(
    () => allRoleFits(data.attributes, data.positions, roles, roleWeights),
    [data.attributes, data.positions, roles, roleWeights],
  )
  const listed = new Set(pitchSpots(data.positions))
  const position = selected !== 'natural' ? SPOT_POSITION[selected] : null
  const shown = fits
    .filter(
      (f) => f.role.phase === phase && (position ? f.role.positions.includes(position) : f.natural),
    )
    .slice(0, 5)
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Position"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mr-auto min-h-8 min-w-0 rounded-md border border-border bg-surface-2 px-2 text-sm font-semibold"
        >
          <option value="natural">Best roles · his positions</option>
          {Object.keys(PITCH_SPOTS)
            .filter((s) => s !== 'SW' || listed.has('SW'))
            .map((s) => {
              const r = data.ratings?.[s]
              return (
                <option key={s} value={s}>
                  {SPOT_POSITION[s]}
                  {r !== undefined ? ` · ${r}` : ''}
                  {listed.has(s) ? ' ✓' : ''}
                </option>
              )
            })}
        </select>
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group">
          {(
            [
              ['ip', 'In possession'],
              ['oop', 'Out of possession'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
              className={clsx(
                'min-h-7 rounded px-1.5',
                phase === p ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted">
          {position
            ? 'FM27 has no roles for this position in this phase.'
            : "No roles for the player's positions in this phase."}
        </p>
      ) : (
        <ul className="grid gap-1">
          {shown.map((f) => (
            <li key={f.role.id} className="grid grid-cols-[1fr_5rem_2rem] items-center gap-2">
              <span className="truncate">{f.role.name}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={clsx('block h-full rounded-full', scoreColor(f.score))}
                  style={{ width: `${f.score}%` }}
                />
              </span>
              <span
                className={clsx('text-right font-semibold tabular-nums', scoreTextColor(f.score))}
              >
                {f.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function useBestRole(data: ProfileData) {
  const { roles, roleWeights } = useConfig()
  return useMemo(
    () =>
      allRoleFits(data.attributes, data.positions, roles, roleWeights).find(
        (f) => f.natural && f.role.phase === 'ip',
      ) ?? null,
    [data.attributes, data.positions, roles, roleWeights],
  )
}

/** Colour of a position spot: green where he plays, then by his rating there. */
function spotClass(natural: boolean, r: number | undefined) {
  if (natural) return 'bg-emerald-400 text-emerald-950'
  if (r === undefined) return 'bg-emerald-900/70 text-emerald-200/70'
  if (r >= 15) return 'bg-lime-300 text-lime-950'
  if (r >= 10) return 'bg-amber-400 text-amber-950'
  return 'bg-emerald-900/70 text-emerald-200/70'
}

/**
 * Every position on a pitch with his rating there (1–20, when the import has them).
 * A tap on a position shows the best roles there; the button below, his best roles overall.
 */
function PositionsPitch({ data }: { data: ProfileData }) {
  const { open, setOpen, ref } = usePopover()
  const [spot, setSpot] = useState<string | null>(null)
  const listed = new Set(pitchSpots(data.positions))
  const show = (s: string | null) => {
    if (open && spot === s) setOpen(false)
    else {
      setSpot(s)
      setOpen(true)
    }
  }
  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <div className="relative aspect-[3/4] w-48 rounded-lg border border-emerald-800/70 bg-emerald-950/60">
        <span className="absolute inset-x-0 top-1/2 h-px bg-emerald-800/50" />
        <span className="absolute top-1/2 left-1/2 size-10 -translate-1/2 rounded-full border border-emerald-800/50" />
        <span className="absolute top-0 left-1/2 h-[9%] w-2/5 -translate-x-1/2 border-x border-b border-emerald-800/50" />
        <span className="absolute bottom-0 left-1/2 h-[9%] w-2/5 -translate-x-1/2 border-x border-t border-emerald-800/50" />
        {Object.entries(PITCH_SPOTS)
          // FM27 has no sweeper role: the spot only shows for a listed sweeper
          .filter(([s]) => s !== 'SW' || listed.has('SW'))
          .map(([s, [x, y]]) => {
            const r = data.ratings?.[s]
            const natural = listed.has(s)
            return (
              <button
                key={s}
                type="button"
                aria-label={`Best roles at ${SPOT_POSITION[s]}${r !== undefined ? `, rating ${r}` : ''}`}
                aria-pressed={open && spot === s}
                onClick={() => show(s)}
                className="absolute flex -translate-1/2 flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="text-[8px] leading-none font-semibold text-emerald-200/80">
                  {s}
                </span>
                <span
                  className={clsx(
                    'mt-0.5 grid size-5 place-items-center rounded-full text-[10px] font-bold tabular-nums',
                    spotClass(natural, r),
                    open && spot === s && 'ring-2 ring-white',
                  )}
                >
                  {r ?? ''}
                </span>
              </button>
            )
          })}
      </div>
      <button
        type="button"
        aria-pressed={open && spot === null}
        onClick={() => show(null)}
        className="mt-1 text-xs text-muted hover:text-text"
      >
        {data.positions ?? '–'} · <span className="text-accent">best roles</span>
      </button>
      {open && (
        <div
          className={clsx(popoverBox, 'top-full left-0 mt-1 w-[23rem] max-w-[calc(100vw-2rem)]')}
        >
          <BestRoles key={spot ?? 'all'} data={data} spot={spot ?? undefined} />
        </div>
      )}
    </div>
  )
}

/** One foot: letter and a meter, one step per foot word (FM's "Weak" to "Very Strong"). */
function Foot({ side, value }: { side: 'L' | 'R'; value: string | number | null }) {
  const { footWords, footMins } = useConfig()
  const f = footLevel(value, footWords, footMins)
  const label = `${side === 'L' ? 'Left' : 'Right'} foot: ${f?.word ?? 'unknown'}`
  return (
    <Tooltip title={label}>
      <span
        tabIndex={0}
        aria-label={label}
        className="flex w-full cursor-help items-center gap-1.5"
      >
        <span
          className={clsx(
            'w-3 text-sm font-extrabold',
            f ? footTextColor(f.level, f.of) : 'text-muted',
          )}
        >
          {side}
        </span>
        <span className="flex flex-1 gap-0.5">
          {Array.from({ length: f?.of ?? 6 }, (_, i) => (
            <span
              key={i}
              className={clsx(
                'h-2 flex-1 rounded-sm',
                f && i < f.level ? footColor(f.level, f.of) : 'bg-surface-2',
              )}
            />
          ))}
        </span>
      </span>
    </Tooltip>
  )
}

function Feet({ feet }: { feet: ProfileData['feet'] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Foot side="L" value={feet[0]} />
      <Foot side="R" value={feet[1]} />
    </div>
  )
}

/** Trait names; the (i) opens what the trait does and what it suits. */
function Traits({ traits }: { traits: string }) {
  const config = useConfig()
  const names = traitNames(traits, config.traitNames)
  if (!names.length) return <p className="text-sm text-muted">No traits.</p>
  return (
    <ul className="text-sm">
      {names.map((t) => (
        <TraitRow key={t} name={t} />
      ))}
    </ul>
  )
}

function TraitRow({ name }: { name: string }) {
  const config = useConfig()
  const g = guideFor(name, config.traitGuide)
  const { open, setOpen, ref } = usePopover()
  return (
    <li ref={ref as never} className="relative border-b border-border/40 last:border-0">
      {g && (g.about || g.suits.length > 0) ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-8 w-full cursor-help items-center text-left hover:text-accent"
        >
          {name}
        </button>
      ) : (
        <div className="flex min-h-8 items-center">{name}</div>
      )}
      {open && g && (
        <div className={clsx(popoverBox, 'top-full right-0 left-0 z-30 lg:right-auto lg:w-80')}>
          <p className="font-semibold">{name}</p>
          {g.about && <p className="mt-1">{g.about}</p>}
          {g.suits.length > 0 && (
            <p className="mt-1 text-xs text-muted">Suits {g.suits.join(', ')}</p>
          )}
        </div>
      )}
    </li>
  )
}

function InfoRows({ info }: { info: ProfileData['info'] }) {
  return (
    <dl className="grid text-sm">
      {info.map((r) => (
        <div key={r.label} className="flex min-h-7 min-w-0 items-center justify-between gap-3">
          <dt className="shrink-0 text-muted">{r.label}</dt>
          <dd
            className="flex min-w-0 items-center justify-end gap-1.5 text-right"
            title={typeof r.value === 'string' ? r.value : undefined}
          >
            {typeof r.value === 'string' || typeof r.value === 'number' ? (
              <span className="truncate">{r.value}</span>
            ) : (
              (r.value ?? '–')
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Info, traits and the extra sections (desktop left card, mobile bottom card). */
function Details({ data, withFeet }: { data: ProfileData; withFeet: boolean }) {
  return (
    <div className="grid gap-4">
      {withFeet && (
        <section>
          <h2 className={heading}>Feet</h2>
          <Feet feet={data.feet} />
        </section>
      )}
      <section>
        <h2 className={heading}>Info</h2>
        <InfoRows info={data.info} />
      </section>
      {data.traits !== null && (
        <section>
          <h2 className={heading}>Traits</h2>
          <Traits traits={data.traits} />
        </section>
      )}
      {data.sections.map((s) => (
        <section key={s.title}>
          <h2 className={heading}>{s.title}</h2>
          {s.body}
        </section>
      ))}
    </div>
  )
}

interface Section {
  label: string
  /** CA / PA rows shown first (in the section that holds the hidden values). */
  pinned: { label: string; value: number | string | null }[]
  attributes: string[]
}

/**
 * The attribute columns from Settings → Attributes → Layout. Hidden values (only when shown)
 * sit wherever the layout puts them, with CA and PA leading their section.
 */
function useColumns(data: ProfileData): { sections: Section[] }[] {
  const config = useConfig()
  const hidden = new Map((data.hidden ?? []).map((h) => [h.label, h.value]))
  const layout = config.layout[data.goalkeeper ? 'goalkeepers' : 'outfield']
  // CA and PA lead the first section holding hidden values
  const first = layout
    .flat()
    .find((s) => data.hidden !== null && s.attributes.some((n) => HIDDEN_NAMES.has(n)))
  const pins = (data.hidden ?? []).filter((h) => h.strong && h.value !== null)
  return layout
    .map((col) => ({
      sections: col
        .map((s) => ({
          label: s.label,
          attributes: s.attributes.filter(
            (n) => data.attributes[n] !== undefined || (hidden.get(n) ?? null) !== null,
          ),
          pinned: s === first ? pins : [],
        }))
        .filter((s) => s.attributes.length > 0 || s.pinned.length > 0),
    }))
    .filter((c) => c.sections.length > 0)
}

/** A value from the attributes, or a hidden value. */
function valueOf(data: ProfileData, n: string): AttributeValue | undefined {
  if (data.attributes[n] !== undefined) return data.attributes[n]
  const h = data.hidden?.find((x) => x.label === n)?.value
  return h === null || h === undefined ? undefined : Number(h)
}
const colorOf = (n: string, v: AttributeValue | undefined) =>
  HIDDEN_NAMES.has(n) ? valueColor(n, v) : attrColor(v)

const diffOf = (data: ProfileData, n: string) => {
  const now = attrNumber(data.attributes[n])
  const before = data.previous ? attrNumber(data.previous[n]) : null
  return now !== null && before !== null ? now - before : 0
}

function Diff({ d }: { d: number }) {
  if (!d) return null
  return (
    <span className={clsx('text-[10px]', d > 0 ? 'text-emerald-400' : 'text-red-400')}>
      {d > 0 ? `+${d}` : d}
    </span>
  )
}

/** Desktop: full names, one column per layout column. */
function AttributesWide({ data }: { data: ProfileData }) {
  const config = useConfig()
  const columns = useColumns(data)
  const cols = columns.length
  return (
    <div
      className={clsx(
        'grid gap-x-4 gap-y-4',
        cols >= 4
          ? 'grid-cols-2 xl:grid-cols-4'
          : cols === 3
            ? 'grid-cols-2 xl:grid-cols-3'
            : 'grid-cols-2',
      )}
    >
      {columns.map((col, ci) => (
        <div key={ci} className="grid content-start gap-3">
          {col.sections.map((section) => (
            <section key={section.label}>
              <h2 className={heading}>{section.label}</h2>
              <ul className="text-sm">
                {section.pinned.map((h) => (
                  <li
                    key={h.label}
                    className="flex min-h-7 items-center justify-between gap-2 rounded px-2 font-semibold odd:bg-surface-2/40"
                  >
                    <span>{h.label}</span>
                    <span className="tabular-nums">{h.value}</span>
                  </li>
                ))}
                {section.attributes.map((n) => {
                  const trained = data.trained?.includes(n)
                  const v = valueOf(data, n)
                  return (
                    <li
                      key={n}
                      className={clsx(
                        'flex min-h-7 items-center justify-between gap-2 rounded px-2',
                        trained
                          ? 'bg-accent/15 shadow-[inset_3px_0_0_var(--color-accent)]'
                          : 'odd:bg-surface-2/40',
                      )}
                    >
                      <Tooltip
                        title={attributeLabel(config, n)}
                        text={config.attributes[n]?.description || attributeLabel(config, n)}
                      >
                        <span
                          tabIndex={0}
                          className="flex min-w-0 cursor-help items-center gap-1 truncate"
                        >
                          {attributeLabel(config, n)}
                          {trained && (
                            <Dumbbell
                              className="size-3 shrink-0 text-accent"
                              aria-label={`Trained by ${data.trainedBy}`}
                            />
                          )}
                        </span>
                      </Tooltip>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Diff d={diffOf(data, n)} />
                        <span className={clsx('w-6 text-right font-semibold', colorOf(n, v))}>
                          {formatAttr(v)}
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
  )
}

/** Mobile: the same columns with FM's three-letter names, so all fit on one screen. */
function AttributesCompact({ data }: { data: ProfileData }) {
  const config = useConfig()
  const columns = useColumns(data)
  const abbr = (n: string) => config.attributes[n]?.abbr || n.slice(0, 3)
  const label = (t: string) => (
    <h2 className="mt-1 mb-1 truncate text-[9.5px] font-semibold tracking-wide text-muted uppercase first:mt-0">
      {t}
    </h2>
  )
  const cell = (
    key: string,
    name: string,
    short: string,
    value: ReactNode,
    cls: string,
    extra?: ReactNode,
    trained?: boolean,
  ) => (
    <Tooltip key={key} title={name}>
      <span
        tabIndex={0}
        className={clsx(
          'mb-0.5 flex w-full items-center justify-between gap-0.5 rounded px-1 py-0.5 text-xs',
          trained ? 'bg-accent/15 shadow-[inset_2px_0_0_var(--color-accent)]' : 'bg-surface-2/40',
        )}
      >
        <span className="min-w-0 truncate">
          {short}
          {extra}
        </span>
        <span className={clsx('font-semibold tabular-nums', cls)}>{value}</span>
      </span>
    </Tooltip>
  )
  return (
    <div
      className="grid items-start gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((col, ci) => (
        <div key={ci} className="grid min-w-0">
          {col.sections.map((s) => (
            <div key={s.label} className="grid">
              {label(s.label)}
              {s.pinned.map((h) => cell(h.label, h.label, h.label, h.value, 'text-text'))}
              {s.attributes.map((n) => {
                const d = diffOf(data, n)
                const v = valueOf(data, n)
                return cell(
                  n,
                  attributeLabel(config, n),
                  abbr(n),
                  formatAttr(v),
                  colorOf(n, v),
                  d ? (
                    <span
                      className={clsx(
                        'ml-0.5 text-[9px]',
                        d > 0 ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {d > 0 ? `+${d}` : d}
                    </span>
                  ) : undefined,
                  data.trained?.includes(n),
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Mobile summary strip: small pitch, feet, a few facts and the best role. */
export function ProfileStrip({ data }: { data: ProfileData }) {
  const best = useBestRole(data)
  const { open, setOpen, ref } = usePopover()
  return (
    <div
      ref={ref}
      className="relative mb-3 grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-surface p-2 lg:hidden"
    >
      <button type="button" aria-label="Show best roles" onClick={() => setOpen((o) => !o)}>
        <Pitch positions={data.positions} ratings={data.ratings} small />
      </button>
      <div className="min-w-0">
        <Feet feet={data.feet} />
        <p className="mt-1 truncate text-xs text-muted">
          {data.summary.filter(Boolean).join(' · ')}
        </p>
        {best && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-0.5 flex items-center text-xs text-lime-300"
          >
            Best: {best.role.name} {best.score}
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className={clsx(popoverBox, 'top-full right-0 left-0 mt-1')}>
          <BestRoles data={data} spot={bestSpot(data.positions, data.ratings)} />
        </div>
      )}
    </div>
  )
}

/** The Profile tab: desktop side card + attribute columns; mobile compact grid + details. */
export function ProfileTab({ data, footer }: { data: ProfileData; footer?: ReactNode }) {
  return (
    <>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 self-start overflow-hidden rounded-xl border border-border bg-surface p-4">
          <PositionsPitch data={data} />
          <Details data={data} withFeet />
        </div>
        <div className="self-start rounded-xl border border-border bg-surface p-4">
          <AttributesWide data={data} />
          {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
        </div>
      </div>
      <div className="grid gap-3 lg:hidden">
        <div className="rounded-xl border border-border bg-surface p-2">
          <AttributesCompact data={data} />
          {footer && <div className="mt-2 text-xs text-muted">{footer}</div>}
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface p-4">
          <Details data={data} withFeet={false} />
        </div>
      </div>
    </>
  )
}

/** Tabs under the player header. */
export function ProfileTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: [T, string][]
  value: T
  onChange: (t: T) => void
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {tabs.map(([t, label]) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={clsx(
            'min-h-11 shrink-0 border-b-2 px-2 text-[13px] sm:px-3 sm:text-sm',
            value === t
              ? 'border-accent font-semibold text-text'
              : 'border-transparent text-muted hover:text-text',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
