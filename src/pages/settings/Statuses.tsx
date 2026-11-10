import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { StatusBadge } from '../../components/StatusChip'
import { Card } from '../../components/ui'
import { usePlayers } from '../../data/hooks'
import { DEFAULT_BADGE, type StatusInfo } from '../../data/statusInfo'
import { useCurrentCareer } from '../../lib/career'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

type Row = StatusInfo & { code: string }

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

const HEX = /^#[0-9a-f]{6}$/i

export function StatusesSettings() {
  const { statuses } = useConfig()
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { save, reset } = useSaveConfig('statuses')

  const initial = useMemo(
    () => Object.entries(statuses).map(([code, s]) => ({ code, ...s })),
    [statuses],
  )
  const [rows, setRows] = useState<Row[]>(initial)
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    // Settings reloaded (after save/reset): show the stored version
    setPrevInitial(initial)
    setRows(initial)
  }

  // Codes seen in your squad that have no row yet
  const missing = useMemo(() => {
    const known = new Set(rows.map((r) => r.code))
    const seen = new Set((players ?? []).map((p) => p.extra.status).filter((c): c is string => !!c))
    return [...seen].filter((c) => !known.has(c)).sort()
  }, [players, rows])

  const dirty = JSON.stringify(rows) !== JSON.stringify(initial)
  const invalid = rows.some((r) => !HEX.test(r.bg) || !HEX.test(r.fg))
  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = (code = '') =>
    setRows([...rows, { code, label: '', description: '', ...DEFAULT_BADGE }])

  const onSave = () =>
    save.mutate(
      Object.fromEntries(
        rows
          .filter((r) => r.code.trim())
          .map(({ code, ...s }) => [
            code.trim(),
            { ...s, label: s.label.trim(), description: s.description.trim() },
          ]),
      ),
    )

  return (
    <SettingsShell
      title="Statuses"
      subtitle="Codes from FM's Inf column: meaning, description and badge colours."
      dirty={dirty && !invalid}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={
        invalid
          ? new Error('Colours must be hex values like #1a2b3c.')
          : (save.error ?? reset.error)
      }
      onSave={onSave}
      onReset={() => reset.mutate()}
    >
      {missing.length > 0 && (
        <Card className="mb-4">
          <p className="text-sm">Codes in your squad without a meaning yet:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => add(c)}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
              >
                <Plus className="size-4" aria-hidden /> {c}
              </button>
            ))}
          </div>
        </Card>
      )}

      <ul className="grid gap-3">
        {rows.map((r, i) => (
          <li
            key={i}
            className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[6rem_1fr_auto]"
          >
            <label className="grid gap-1 text-xs text-muted">
              Code
              <input
                value={r.code}
                onChange={(e) => update(i, { code: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Meaning (tooltip title)
              <input
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className={input}
              />
            </label>
            <div className="flex items-end gap-2 sm:row-span-2 sm:flex-col sm:items-end sm:justify-between">
              <div className="grid min-h-11 place-items-center px-2">
                <StatusBadge code={r.code || '—'} info={r} />
              </div>
              <button
                type="button"
                aria-label={`Remove ${r.code || 'row'}`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="ml-auto grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <label className="grid gap-1 text-xs text-muted sm:col-span-2">
              Description
              <textarea
                rows={2}
                value={r.description}
                onChange={(e) => update(i, { description: e.target.value })}
                className={`${input} py-2`}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <ColorField label="Badge colour" value={r.bg} onChange={(bg) => update(i, { bg })} />
              <ColorField label="Text colour" value={r.fg} onChange={(fg) => update(i, { fg })} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => add()}
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add code
      </button>
    </SettingsShell>
  )
}

/** Colour picker plus a hex text box that stay in sync. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const valid = HEX.test(value)
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-lg border border-border bg-surface-2 p-1"
        />
        <input
          value={value}
          spellCheck={false}
          aria-invalid={!valid}
          onChange={(e) => onChange(e.target.value.trim())}
          className={`${input} font-mono uppercase ${valid ? '' : 'border-red-500'}`}
        />
      </span>
    </label>
  )
}
