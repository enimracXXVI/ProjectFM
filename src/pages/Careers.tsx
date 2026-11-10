import { clsx } from 'clsx'
import { useState } from 'react'
import { Button } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { useCareer } from '../lib/career'
import { CareerForm } from './CareerForm'

export function Careers() {
  const { careers, current, setCurrentId } = useCareer()
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader
        title="Careers"
        subtitle="All your saves"
        actions={!adding && <Button onClick={() => setAdding(true)}>New career</Button>}
      />
      {adding && (
        <Card className="mb-4">
          <h2 className="mb-3 font-semibold">New career</h2>
          <CareerForm onDone={() => setAdding(false)} />
        </Card>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {careers.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setCurrentId(c.id)}
              aria-current={c.id === current?.id}
              className={clsx(
                'bg-surface w-full rounded-xl border p-4 text-left transition-colors',
                c.id === current?.id ? 'border-accent' : 'border-border hover:border-muted',
              )}
            >
              <p className="font-semibold">{c.name}</p>
              <p className="text-accent text-sm">{c.club}</p>
              <p className="text-muted mt-1 text-xs">
                {[c.nation, [c.start_season, c.current_season].filter(Boolean).join(' → ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
