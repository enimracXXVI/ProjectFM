import { clsx } from 'clsx'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useChecks } from '../lib/useChecks'
import { navItems } from './nav'
import { TopBar } from './TopBar'

const COLLAPSED_KEY = 'projectfm.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const checks = useChecks()

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })

  // Desktop shortcut: "[" toggles the sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '[' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="flex h-full">
      {/* Desktop / tablet sidebar */}
      <aside
        className={clsx(
          'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={clsx(
            'flex h-16 items-center pt-safe text-lg font-bold tracking-tight',
            collapsed ? 'justify-center' : 'px-5',
          )}
        >
          {collapsed ? (
            <span className="text-accent">FM</span>
          ) : (
            <>
              Project<span className="text-accent">FM</span>
            </>
          )}
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  collapsed && 'justify-center',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              <span className="relative">
                <Icon className="size-5 shrink-0" aria-hidden />
                {to === '/check' && checks.total > 0 && collapsed && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400" />
                )}
              </span>
              {!collapsed && label}
              {!collapsed && to === '/check' && checks.total > 0 && (
                <span
                  className="ml-auto rounded-full bg-amber-400 px-2 text-xs font-bold text-black"
                  aria-label={`${checks.total} to check`}
                >
                  {checks.total}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar ( [ )`}
          className={clsx(
            'm-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-text',
            collapsed && 'justify-center',
          )}
        >
          <ToggleIcon className="size-5 shrink-0" aria-hidden />
          {!collapsed && 'Collapse'}
        </button>
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
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-safe backdrop-blur md:hidden"
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
