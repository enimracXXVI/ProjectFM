import { clsx } from 'clsx'
import { NavLink, Outlet } from 'react-router-dom'
import { navItems } from './nav'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="flex h-full">
      {/* Desktop / tablet sidebar */}
      <aside className="border-border bg-surface hidden w-60 shrink-0 flex-col border-r md:flex">
        <div className="pt-safe flex h-16 items-center px-5 text-lg font-bold tracking-tight">
          Project<span className="text-accent">FM</span>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 md:px-8 md:py-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Main"
        className="pb-safe border-border bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {navItems
            .filter((item) => item.mobile)
            .map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium select-none',
                      isActive ? 'text-accent' : 'text-muted active:text-text',
                    )
                  }
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  )
}
