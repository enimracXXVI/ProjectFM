import { clsx } from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { navItems } from '../../components/nav'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const MAX = 5

/** Choose and order the sections in the phone bottom bar. */
export function BottomBarSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('mobileBar')
  const [bar, setBar] = useState(config.mobileBar)
  const [prev, setPrev] = useState(config.mobileBar)
  if (prev !== config.mobileBar) {
    setPrev(config.mobileBar)
    setBar(config.mobileBar)
  }
  const dirty = JSON.stringify(bar) !== JSON.stringify(config.mobileBar)
  const toggle = (to: string) =>
    setBar(bar.includes(to) ? bar.filter((x) => x !== to) : bar.length < MAX ? [...bar, to] : bar)
  const move = (i: number, d: -1 | 1) => {
    const next = [...bar]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setBar(next)
  }
  const item = (to: string) => navItems.find((n) => n.to === to)!

  return (
    <SettingsShell
      title="Phone bottom bar"
      subtitle={`Pick up to ${MAX} sections for the bar at the bottom of the screen on phones. Everything else stays on the Dashboard under More sections.`}
      dirty={dirty}
      saving={save.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(bar)}
      onReset={() => reset.mutate()}
    >
      {/* Preview */}
      <div
        className="mb-5 grid max-w-md rounded-xl border border-border bg-surface"
        style={{ gridTemplateColumns: `repeat(${Math.max(bar.length, 1)}, minmax(0, 1fr))` }}
      >
        {bar.map((to) => {
          const { icon: Icon, label } = item(to)
          return (
            <span
              key={to}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted"
            >
              <Icon className="size-5" aria-hidden />
              <span className="max-w-full truncate px-0.5">{label}</span>
            </span>
          )
        })}
      </div>

      <div className="grid max-w-md gap-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            In the bar ({bar.length}/{MAX}), left to right
          </h2>
          <ul className="grid gap-1">
            {bar.map((to, i) => {
              const { icon: Icon, label } = item(to)
              return (
                <li
                  key={to}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3"
                >
                  <Icon className="size-5 text-accent" aria-hidden />
                  <span className="flex-1 text-sm">{label}</span>
                  <button
                    type="button"
                    aria-label={`Move ${label} left`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} right`}
                    disabled={i === bar.length - 1}
                    onClick={() => move(i, 1)}
                    className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">All sections</h2>
          <ul className="grid gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const on = bar.includes(to)
              const full = !on && bar.length >= MAX
              return (
                <li key={to}>
                  <label
                    className={clsx(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm',
                      full ? 'text-muted' : 'hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={full || (on && bar.length === 1)}
                      onChange={() => toggle(to)}
                      className="size-5"
                    />
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </SettingsShell>
  )
}
