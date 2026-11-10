import { PageHeader } from '../components/ui'
import { staff } from '../data/mock'
import { formatWage } from '../lib/format'

export function Staff() {
  const list = staff

  return (
    <>
      <PageHeader title="Staff" subtitle="Sample data · staff import coming soon" />
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-accent">{s.role}</p>
            <p className="mt-1 text-xs text-muted">
              {s.age} · {s.nationality} · {formatWage(s.wage)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
