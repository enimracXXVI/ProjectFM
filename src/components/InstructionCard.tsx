import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FmAbout, FmInstruction, FmOption } from '../tactics/fm'
import { Tooltip } from './Tooltip'

/** FM's explanation of an option: its short lines, then its pros and cons. */
function About({ about, long }: { about?: FmAbout; long?: boolean }) {
  if (!about) return null
  const lines =
    long && about.text ? [about.text] : (about.short ?? (about.text ? [about.text] : []))
  const hasList = !!(about.pros?.length || about.cons?.length)
  return (
    <span className="grid gap-1">
      {lines.map((l) => (
        <span key={l} className="block">
          {l}
        </span>
      ))}
      {hasList && <span className="my-0.5 block border-t border-border" />}
      {about.pros?.map((x) => (
        <span key={x} className="flex gap-1.5">
          <span className="text-emerald-400">+</span>
          {x}
        </span>
      ))}
      {about.cons?.map((x) => (
        <span key={x} className="flex gap-1.5">
          <span className="text-red-400">−</span>
          {x}
        </span>
      ))}
    </span>
  )
}

/**
 * One instruction as a card (as on FM Scout's tactic creator): its name, a bar with one segment
 * per option (the current one filled, FM's default marked with a dot) and the current option.
 * Hovering a segment explains that option, hovering the name explains the current one; a
 * segment sets its option; the current option opens a list of all of them with FM's short
 * description.
 */
export function InstructionCard({
  def,
  value,
  options,
  defaultCode = 0,
  disabled,
  note,
  onChange,
}: {
  def: FmInstruction
  /** Code of the current option (0: nothing set). */
  value: number
  /** Options to show (default: all of the instruction's). */
  options?: FmOption[]
  defaultCode?: number
  /** Locked: the role always does it, or FM does not let the role change it. */
  disabled?: boolean
  /** Why it is locked, shown under the value. */
  note?: string
  onChange: (code: number) => void
}) {
  const list = options ?? def.options
  const current = list.find((o) => o.code === value) ?? list.find((o) => o.code === 0) ?? list[0]
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  const pick = (o: FmOption) => {
    if (disabled || o.target === 'player') return
    onChange(o.code)
    setOpen(false)
  }

  return (
    <div
      ref={box}
      className={clsx(
        'relative grid content-start gap-2 rounded-lg border bg-surface p-2.5',
        open ? 'border-accent' : 'border-border',
        disabled && 'opacity-70',
      )}
    >
      <Tooltip
        title={`${def.name}: ${current?.label ?? ''}`}
        content={<About about={current?.about} long />}
      >
        <span tabIndex={0} className="cursor-help truncate text-sm font-semibold">
          {def.name}
        </span>
      </Tooltip>
      <div className="flex gap-1" role="radiogroup" aria-label={def.name}>
        {list.map((o) => (
          <Tooltip
            key={o.code}
            title={o.label}
            content={<About about={o.about} />}
            className="flex-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={o.code === current?.code}
              aria-label={o.label}
              disabled={disabled || o.target === 'player'}
              onClick={() => pick(o)}
              className="relative flex h-5 w-full min-w-3 items-center disabled:cursor-not-allowed"
            >
              <span
                className={clsx(
                  'block h-2 w-full rounded-full',
                  o.code === current?.code ? 'bg-accent' : 'bg-surface-2 hover:bg-border',
                )}
              />
              {o.code === defaultCode && (
                <span className="absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-muted" />
              )}
            </button>
          </Tooltip>
        ))}
      </div>
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex min-h-7 items-center justify-between gap-1 text-left text-sm disabled:cursor-not-allowed"
      >
        <span className="truncate">{current?.label}</span>
        {!disabled && <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />}
      </button>
      {note && <p className="-mt-1 text-[11px] text-muted">{note}</p>}
      {open && (
        <ul
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 grid max-h-80 min-w-60 gap-0.5 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-2xl shadow-black/50"
        >
          {list.map((o) => (
            <li key={o.code}>
              <button
                type="button"
                role="option"
                aria-selected={o.code === current?.code}
                disabled={o.target === 'player'}
                onClick={() => pick(o)}
                className={clsx(
                  'grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 disabled:opacity-50',
                  o.code === current?.code && 'bg-accent/15',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {o.label}
                  {o.code === defaultCode && (
                    <span className="text-[10px] font-normal tracking-wide text-muted uppercase">
                      default
                    </span>
                  )}
                </span>
                {(o.about?.short?.length || o.about?.text) && (
                  <span className="text-xs text-muted">
                    {o.about?.short?.join(' ') ?? o.about?.text}
                  </span>
                )}
                {o.target === 'player' && (
                  <span className="text-xs text-muted">Set in FM for a match.</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
