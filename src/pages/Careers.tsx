import { clsx } from 'clsx'
import { PageHeader } from '../components/ui'
import { useCareer } from '../lib/career'

export function Careers() {
  const { careers, current, setCurrentId } = useCareer()

  return (
    <>
      <PageHeader title="Careers" subtitle="All your saves" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {careers.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setCurrentId(c.id)}
              className={clsx(
                'bg-surface w-full rounded-xl border p-4 text-left transition-colors',
                c.id === current.id ? 'border-accent' : 'border-border hover:border-muted',
              )}
            >
              <p className="font-semibold">{c.name}</p>
              <p className="text-accent text-sm">{c.club}</p>
              <p className="text-muted mt-1 text-xs">
                {c.nation} · {c.startSeason} → {c.currentSeason}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
