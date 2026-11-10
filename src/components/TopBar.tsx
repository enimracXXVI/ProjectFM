import { Search, Settings, Upload } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCareer } from '../lib/career'

export function TopBar() {
  const { careers, current, setCurrentId } = useCareer()
  const currentId = current?.id ?? ''
  const searchRef = useRef<HTMLInputElement>(null)

  // Desktop shortcut: "/" focuses global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="pt-safe border-border bg-bg/95 sticky top-0 z-10 border-b backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <span className="text-lg font-bold tracking-tight md:hidden">
          P<span className="text-accent">FM</span>
        </span>

        <label className="sr-only" htmlFor="career-select">
          Current career
        </label>
        <select
          id="career-select"
          value={currentId}
          onChange={(e) => setCurrentId(e.target.value)}
          className="border-border bg-surface min-h-11 max-w-[45vw] truncate rounded-lg border px-3 text-sm md:max-w-xs"
        >
          {careers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.club}
            </option>
          ))}
        </select>

        <div className="relative ml-auto hidden flex-1 md:block md:max-w-sm">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search players, staff…"
            aria-label="Search"
            className="border-border bg-surface placeholder:text-muted min-h-11 w-full rounded-lg border pr-10 pl-9 text-sm"
          />
          <kbd className="border-border text-muted absolute top-1/2 right-3 -translate-y-1/2 rounded border px-1.5 text-xs">
            /
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            to="/import"
            aria-label="Import"
            className="text-muted hover:bg-surface hover:text-text grid size-11 place-items-center rounded-lg md:hidden"
          >
            <Upload className="size-5" aria-hidden />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="text-muted hover:bg-surface hover:text-text grid size-11 place-items-center rounded-lg md:hidden"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  )
}
