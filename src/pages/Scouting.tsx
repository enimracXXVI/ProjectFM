import { PageHeader } from '../components/ui'
import { scoutTargets } from '../data/mock'
import type { ScoutStatus } from '../data/types'
import { formatMoney } from '../lib/format'

const columns: { status: ScoutStatus; label: string }[] = [
  { status: 'watching', label: 'Watching' },
  { status: 'bid', label: 'Bid' },
  { status: 'signed', label: 'Signed' },
  { status: 'rejected', label: 'Rejected' },
]

export function Scouting() {
  const targets = scoutTargets

  return (
    <>
      <PageHeader title="Scouting" subtitle="Sample data · real scouting board coming soon" />
      {/* Horizontal swipe between columns on phones, grid on desktop */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {columns.map(({ status, label }) => {
          const items = targets.filter((t) => t.status === status)
          return (
            <section
              key={status}
              aria-label={label}
              className="border-border bg-surface w-[80vw] max-w-xs shrink-0 snap-start rounded-xl border p-3 md:w-auto md:max-w-none"
            >
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                {label}
                <span className="bg-surface-2 text-muted rounded-full px-2 text-xs">
                  {items.length}
                </span>
              </h2>
              <ul className="grid gap-2">
                {items.map((t) => (
                  <li key={t.id} className="bg-surface-2 rounded-lg p-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-muted text-xs">
                      {t.position} · {t.age} · {t.club}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="text-accent">{'★'.repeat(Math.floor(t.rating))}</span>{' '}
                      {formatMoney(t.value)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
