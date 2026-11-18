import type { ReactNode } from 'react'

export type InfoRow = { label: string; value: ReactNode; hint?: string }

/** A box of label / value rows, laid out top to bottom (like sortitoutsi's profile boxes). */
export function InfoCard({ title, rows }: { title: ReactNode; rows: InfoRow[] }) {
  const shown = rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== '')
  if (!shown.length) return null
  return (
    <section className="min-w-0 self-start rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
        {title}
      </h2>
      <dl className="grid text-sm">
        {shown.map((r) => (
          <div
            key={r.label}
            className="flex min-h-8 min-w-0 items-center justify-between gap-3 border-b border-border/40 last:border-0"
            title={r.hint}
          >
            <dt className="shrink-0 text-muted">{r.label}</dt>
            <dd
              className="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium"
              title={typeof r.value === 'string' ? r.value : undefined}
            >
              {typeof r.value === 'string' || typeof r.value === 'number' ? (
                <span className="truncate">{r.value}</span>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
