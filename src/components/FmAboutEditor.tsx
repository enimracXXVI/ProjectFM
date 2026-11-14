import type { FmAbout } from '../tactics/fm'

const area =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm'

// Kept as typed (empty lines included) so a new line can be started; empty ones are not shown
const lines = (t: string) => t.split('\n')

/** Edits FM's explanation of a choice: short lines, description, pros and cons. */
export function FmAboutEditor({
  about,
  onChange,
}: {
  about: FmAbout | undefined
  onChange: (about: FmAbout) => void
}) {
  const a = about ?? {}
  const field = (label: string, value: string, rows: number, set: (t: string) => FmAbout) => (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(set(e.target.value))}
        className={area}
      />
    </label>
  )
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {field('Short lines (one per line)', (a.short ?? []).join('\n'), 2, (t) => ({
        ...a,
        short: lines(t),
      }))}
      {field('Description', a.text ?? '', 2, (t) => ({ ...a, text: t }))}
      {field('Pros (one per line)', (a.pros ?? []).join('\n'), 2, (t) => ({
        ...a,
        pros: lines(t),
      }))}
      {field('Cons (one per line)', (a.cons ?? []).join('\n'), 2, (t) => ({
        ...a,
        cons: lines(t),
      }))}
    </div>
  )
}
