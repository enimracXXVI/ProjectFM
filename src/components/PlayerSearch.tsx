import { clsx } from 'clsx'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { fold, type SearchItem } from '../lib/search'

/**
 * Type part of a name and pick from the matches (tap or Enter), ignoring accents and case.
 * With nothing typed, tapping the box lists `initial` (e.g. your whole squad).
 */
export function PlayerSearch<T extends SearchItem>({
  items,
  initial,
  onPick,
  placeholder = 'Add player: type a name',
  limit = 12,
}: {
  items: T[]
  initial?: T[]
  onPick: (p: T) => void
  placeholder?: string
  limit?: number
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const list = useId()
  const query = fold(q.trim())
  const matches = query
    ? items.filter((p) => (p.key ?? fold(p.name)).includes(query)).slice(0, limit)
    : open
      ? (initial ?? [])
      : []
  const pick = (p: T) => {
    onPick(p)
    setQ('')
    setAt(0)
    setOpen(false)
  }
  return (
    <div className="relative w-full sm:w-80">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={list}
        aria-label={placeholder}
        placeholder={placeholder}
        value={q}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQ(e.target.value)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setAt((a) => Math.min(a + 1, matches.length - 1))
          else if (e.key === 'ArrowUp') setAt((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && matches[at]) pick(matches[at])
          else if (e.key === 'Escape') {
            setQ('')
            setOpen(false)
          } else return
          e.preventDefault()
        }}
        className="min-h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-base md:text-sm"
      />
      {matches.length > 0 && (
        <ul
          id={list}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === at}>
              {p.group && p.group !== matches[i - 1]?.group && (
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {p.group}
                </p>
              )}
              <button
                type="button"
                // Picked before the input loses focus
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={clsx(
                  'flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm',
                  i === at ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.detail && (
                  <span className="max-w-[50%] truncate text-xs text-muted">{p.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
