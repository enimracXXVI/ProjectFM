import { PageHeader } from '../components/ui'
import { staff } from '../data/mock'
import { useCareer } from '../lib/career'
import { formatWage } from '../lib/format'

export function Staff() {
  const { current } = useCareer()
  const list = staff.filter((s) => s.careerId === current.id)

  return (
    <>
      <PageHeader title="Staff" subtitle={`${list.length} members`} />
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
