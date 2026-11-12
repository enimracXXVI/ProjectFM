import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

const KEY = 'projectfm:settings-closed'

function readClosed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function writeClosed(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Storage blocked: the section still opens and closes, it just is not remembered
  }
}

/**
 * A settings section that opens and closes from its title, so long pages need less
 * scrolling. Closed sections are remembered on this device (by `id`).
 */
export function SettingsSection({
  id,
  title,
  hint,
  aside,
  defaultOpen = true,
  forceOpen = false,
  className,
  bodyClassName,
  variant = 'card',
  children,
}: {
  /** Stable key for remembering the open state, e.g. "staff-attributes/tabs". */
  id: string
  title: ReactNode
  hint?: ReactNode
  /** Shown on the right of the title row (e.g. a count). */
  aside?: ReactNode
  defaultOpen?: boolean
  /** Keep open regardless (e.g. while searching). */
  forceOpen?: boolean
  className?: string
  bodyClassName?: string
  variant?: 'card' | 'dashed' | 'plain'
  children: ReactNode
}) {
  const bodyId = useId()
  const [open, setOpen] = useState(() => {
    const closed = readClosed()
    if (closed.includes(id)) return false
    if (closed.includes(`open:${id}`)) return true
    return defaultOpen
  })
  const shown = open || forceOpen
  const toggle = () => {
    const next = !open
    setOpen(next)
    const rest = readClosed().filter((x) => x !== id && x !== `open:${id}`)
    // Remember only choices that differ from the default
    if (next !== defaultOpen) rest.push(next ? `open:${id}` : id)
    writeClosed(rest)
  }
  return (
    <section
      className={clsx(
        variant === 'card' && 'rounded-xl border border-border bg-surface',
        variant === 'dashed' && 'rounded-xl border border-dashed border-border',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={bodyId}
        onClick={toggle}
        className={clsx(
          'flex min-h-12 w-full items-center gap-2 text-left',
          variant === 'plain' ? 'px-0' : 'px-3',
        )}
      >
        <ChevronDown
          className={clsx(
            'size-4 shrink-0 text-muted transition-transform',
            !shown && '-rotate-90',
          )}
          aria-hidden
        />
        <h2 className="min-w-0 flex-1 font-semibold">{title}</h2>
        {aside && <span className="shrink-0 text-xs text-muted">{aside}</span>}
      </button>
      {shown && (
        <div
          id={bodyId}
          className={clsx(variant === 'plain' ? 'pb-2' : 'px-3 pb-3', bodyClassName)}
        >
          {hint && <div className="mb-2 text-xs text-muted">{hint}</div>}
          {children}
        </div>
      )}
    </section>
  )
}
