import { clsx } from 'clsx'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Crest } from '../components/Crest'
import { Button } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { useCareer } from '../lib/career'
import { CareerEdit } from './CareerEdit'
import { CareerForm } from './CareerForm'

export function Careers() {
  const { careers, current, setCurrentId } = useCareer()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

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
        {careers.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="sm:col-span-2 xl:col-span-3">
              <Card>
                <h2 className="mb-4 font-semibold">Edit {c.name}</h2>
                <CareerEdit career={c} onDone={() => setEditing(null)} />
              </Card>
            </li>
          ) : (
            <li key={c.id} className="relative">
              <button
                type="button"
                onClick={() => setCurrentId(c.id)}
                aria-current={c.id === current?.id}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border bg-surface p-4 pr-14 text-left transition-colors',
                  c.id === current?.id ? 'border-accent' : 'border-border hover:border-muted',
                )}
              >
                <Crest url={c.crest_url} className="size-12" />
                <span className="min-w-0">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-sm text-accent">{c.club}</span>
                  <span className="block text-xs text-muted">
                    {[c.nation, [c.start_season, c.current_season].filter(Boolean).join(' → ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Edit ${c.name}`}
                onClick={() => setEditing(c.id)}
                className="absolute top-2 right-2 grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
    </>
  )
}
