import { clsx } from 'clsx'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'

/** Lower case without accents, so "dragusin" finds "Drăgușin". */
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Type part of a name and pick from the matches (tap or Enter). Matches any word of the name,
 * ignoring accents and case.
 */
export function PlayerSearch<T extends { id: string; name: string }>({
  players,
  onPick,
  placeholder = 'Add player: type a name',
  detail,
}: {
  players: T[]
  onPick: (p: T) => void
  placeholder?: string
  /** Small text after the name (e.g. positions). */
  detail?: (p: T) => string | null
}) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const list = useId()
  const query = fold(q.trim())
  const matches = query ? players.filter((p) => fold(p.name).includes(query)).slice(0, 8) : []
  const pick = (p: T) => {
    onPick(p)
    setQ('')
    setAt(0)
  }
  return (
    <div className="relative w-full sm:w-72">
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
        onChange={(e) => {
          setQ(e.target.value)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setAt((a) => Math.min(a + 1, matches.length - 1))
          else if (e.key === 'ArrowUp') setAt((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && matches[at]) {
            e.preventDefault()
            pick(matches[at])
          } else if (e.key === 'Escape') setQ('')
          else return
          e.preventDefault()
        }}
        className="min-h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-base md:text-sm"
      />
      {matches.length > 0 && (
        <ul
          id={list}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === at}>
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
                {detail?.(p) && <span className="text-xs text-muted">{detail(p)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
