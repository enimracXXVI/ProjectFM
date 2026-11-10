import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Placeholder } from '../components/ui'
import { useStaff } from '../data/hooks'
import { SCOUT_KEY_ATTRIBUTES, ratingColor } from '../data/staffInfo'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'

export function Staff() {
  const career = useCurrentCareer()
  const { staffScale } = useConfig()
  const { data, isPending, error } = useStaff(career.id)

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={data ? `${data.length} members` : 'Loading…'}
        actions={
          <Link
            to="/staff/new"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-strong"
          >
            <Plus className="size-4" aria-hidden /> Add staff
          </Link>
        }
      />
      {error && <Placeholder>{error.message}</Placeholder>}
      {data?.length === 0 && (
        <Placeholder>No staff yet. Add your scouts to build the scouting network.</Placeholder>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((s) => (
          <li key={s.id}>
            <Link
              to={`/staff/${s.id}`}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-muted"
            >
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-accent">{s.role ?? 'Staff'}</p>
              <p className="mt-1 text-xs text-muted">
                {[s.age, s.nation, s.reputation, s.personality].filter(Boolean).join(' · ')}
              </p>
              {isPending ? null : (
                <dl className="mt-2 grid gap-0.5 text-xs">
                  {SCOUT_KEY_ATTRIBUTES.filter((a) => s.attributes[a]).map((a) => (
                    <div key={a} className="flex justify-between gap-2">
                      <dt className="text-muted">{a}</dt>
                      <dd className={`font-semibold ${ratingColor(s.attributes[a], staffScale)}`}>
                        {s.attributes[a]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.knowledge.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Knows: {s.knowledge.map((k) => k.nation).join(', ')}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
