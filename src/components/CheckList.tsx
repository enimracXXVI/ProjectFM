import { clsx } from 'clsx'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fold } from '../lib/search'
import type { PickOption } from './PickList'

/**
 * Several choices from a long list: like PickList, but each option has a tick box and the
 * panel stays open while you tick.
 */
export function CheckList({
  value,
  options,
  placeholder,
  onChange,
  className,
}: {
  value: string[]
  options: PickOption[]
  placeholder: string
  onChange: (value: string[]) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const chosen = new Set(value)
  const picked = options.filter((o) => chosen.has(o.value))

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

  const toggle = (v: string) =>
    onChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v])

  const summary =
    picked.length === 0
      ? placeholder
      : picked.length === 1
        ? picked[0].label
        : `${picked.length} chosen: ${picked.map((p) => p.label).join(', ')}`

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
            !picked.length && 'text-muted',
          )}
        >
          <span className="truncate" title={picked.length > 1 ? summary : undefined}>
            {summary}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
        {picked.length > 0 && (
          <button
            type="button"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            onClick={() => onChange([])}
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
              className="min-h-10 w-full rounded-lg border border-border bg-surface-2 pr-2 pl-8 text-base md:text-sm"
            />
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-80 overflow-y-auto text-sm">
            {groups.length === 0 && <li className="px-2 py-2 text-muted">Nothing found.</li>}
            {groups.map(([group, list]) => (
              <li key={group}>
                {group && (
                  <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {group}
                  </p>
                )}
                <ul>
                  {list.map((o) => {
                    const on = chosen.has(o.value)
                    return (
                      <li key={o.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          onClick={() => toggle(o.value)}
                          className={clsx(
                            'flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-surface-2',
                            on && 'text-accent',
                          )}
                        >
                          <span
                            className={clsx(
                              'grid size-4 shrink-0 place-items-center rounded border',
                              on ? 'border-accent bg-accent text-black' : 'border-border',
                            )}
                          >
                            {on && <Check className="size-3" aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          {o.detail !== undefined && (
                            <span className="shrink-0 text-xs text-muted">{o.detail}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
