import { clsx } from 'clsx'
import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fold } from '../lib/search'

export interface PickOption {
  value: string
  label: string
  group?: string
  /** Shown in a second column (e.g. the positions that can play a role). */
  detail?: string
}

/**
 * A choice from a long list: a button that opens a panel with a search box and the
 * options in groups (instead of a native drop-down that scrolls forever).
 */
export function PickList({
  value,
  options,
  placeholder,
  onChange,
  className,
}: {
  value: string
  options: PickOption[]
  placeholder: string
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    search.current?.focus()
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

  const groups = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean)
    const hit = options.filter((o) => {
      const t = fold(`${o.label} ${o.group ?? ''} ${o.detail ?? ''}`)
      return words.every((w) => t.includes(w))
    })
    const out = new Map<string, PickOption[]>()
    for (const o of hit) out.set(o.group ?? '', [...(out.get(o.group ?? '') ?? []), o])
    return [...out]
  }, [options, q])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={box} className={clsx('relative', className)}>
      <div className="flex min-h-11 items-center rounded-lg border border-border bg-surface-2">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-base md:text-sm',
            !current && 'text-muted',
          )}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
        {current && (
          <button
            type="button"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            onClick={() => pick('')}
            className="grid size-11 shrink-0 place-items-center text-muted hover:text-text"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full min-w-80 rounded-xl border border-border bg-surface p-2 shadow-2xl shadow-black/50 sm:min-w-[28rem]">
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              ref={search}
              type="search"
              value={q}
              placeholder="Type to find…"
              aria-label={`Find in ${placeholder.toLowerCase()}`}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                const first = groups[0]?.[1][0]
                if (e.key === 'Enter' && first) pick(first.value)
              }}
              className="min-h-10 w-full rounded-lg border border-border bg-surface-2 pr-2 pl-8 text-base md:text-sm"
            />
          </div>
          <ul role="listbox" className="max-h-80 overflow-y-auto text-sm">
            {groups.length === 0 && <li className="px-2 py-2 text-muted">Nothing found.</li>}
            {groups.map(([group, list]) => (
              <li key={group}>
                {group && (
                  <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {group}
                  </p>
                )}
                <ul>
                  {list.map((o) => (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={o.value === value}
                        onClick={() => pick(o.value)}
                        className={clsx(
                          'grid min-h-9 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-2',
                          o.detail !== undefined && 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
                          o.value === value && 'bg-accent/15 text-accent',
                        )}
                      >
                        <span className="truncate">{o.label}</span>
                        {o.detail !== undefined && (
                          <span className="truncate text-xs text-muted" title={o.detail}>
                            {o.detail}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
