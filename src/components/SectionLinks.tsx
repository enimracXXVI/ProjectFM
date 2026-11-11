import { Link } from 'react-router-dom'
import { useChecks } from '../lib/useChecks'
import { navItems } from './nav'

/** On phones: every section that is not in the bottom bar, as big tiles. */
export function SectionLinks() {
  const checks = useChecks()
  const items = navItems.filter((i) => !i.mobile)
  return (
    <section className="mb-5 md:hidden" aria-label="More sections">
      <h2 className="mb-2 text-sm font-semibold text-muted">More sections</h2>
      <ul className="grid grid-cols-3 gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-1 text-center text-xs font-medium active:bg-surface-2"
            >
              <Icon className="size-5 text-accent" aria-hidden />
              {label}
              {to === '/check' && checks.total > 0 && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-black">
                  {checks.total}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
