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
          <li key={s.id} className="border-border bg-surface rounded-xl border p-4">
            <p className="font-semibold">{s.name}</p>
            <p className="text-accent text-sm">{s.role}</p>
            <p className="text-muted mt-1 text-xs">
              {s.age} · {s.nationality} · {formatWage(s.wage)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
