import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayers, useStaff } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { searchKey } from '../world/world'

/** Top bar search: your players and staff by name, or the World database. "/" focuses it. */
export function GlobalSearch() {
  const career = useCurrentCareer()
  const navigate = useNavigate()
  const { data: players } = usePlayers(career.id)
  const { data: staff } = useStaff(career.id)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [])

  const key = searchKey(q.trim())
  const hits = useMemo(() => {
    if (key.length < 2) return []
    return [
      ...(players ?? [])
        .filter((p) => p.in_squad && searchKey(p.name).includes(key))
        .map((p) => ({ to: `/squad/${p.id}`, label: p.name, kind: 'Squad' })),
      ...(staff ?? [])
        .filter((s) => searchKey(s.name).includes(key))
        .map((s) => ({ to: `/staff/${s.id}`, label: s.name, kind: 'Staff' })),
    ].slice(0, 8)
  }, [players, staff, key])
  const world = `/world?q=${encodeURIComponent(q.trim())}`
  const go = (to: string) => {
    setOpen(false)
    setQ('')
    navigate(to)
  }

  return (
    <div ref={box} className="relative ml-auto hidden flex-1 md:block md:max-w-sm">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        placeholder="Search players, staff…"
        aria-label="Search"
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(hits[0]?.to ?? world)
          if (e.key === 'Escape') setOpen(false)
        }}
        className="min-h-11 w-full rounded-lg border border-border bg-surface pr-10 pl-9 text-sm placeholder:text-muted"
      />
      <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted">
        /
      </kbd>
      {open && key.length >= 2 && (
        <ul className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface py-1 text-sm shadow-2xl shadow-black/50">
          {hits.map((h) => (
            <li key={h.to}>
              <Link
                to={h.to}
                onClick={() => (setOpen(false), setQ(''))}
                className="flex min-h-10 items-center justify-between gap-2 px-3 hover:bg-surface-2"
              >
                <span className="truncate">{h.label}</span>
                <span className="text-xs text-muted">{h.kind}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              to={world}
              onClick={() => (setOpen(false), setQ(''))}
              className="flex min-h-10 items-center px-3 text-accent hover:bg-surface-2"
            >
              Search the World database for “{q.trim()}”
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}
