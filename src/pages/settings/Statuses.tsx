import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { Card } from '../../components/ui'
import { usePlayers } from '../../data/hooks'
import { STATUS_TONES, TONE_CLASSES, type StatusTone } from '../../data/statusInfo'
import { useCurrentCareer } from '../../lib/career'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

interface Row {
  code: string
  label: string
  tone: StatusTone
}

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function StatusesSettings() {
  const { statuses } = useConfig()
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { save, reset } = useSaveConfig('statuses')

  const initial = useMemo(
    () => Object.entries(statuses).map(([code, s]) => ({ code, label: s.label, tone: s.tone })),
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
  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = (code = '') => setRows([...rows, { code, label: '', tone: 'gray' }])

  const onSave = () =>
    save.mutate(
      Object.fromEntries(
        rows
          .filter((r) => r.code.trim())
          .map((r) => [r.code.trim(), { label: r.label.trim(), tone: r.tone }]),
      ),
    )

  return (
    <SettingsShell
      title="Statuses"
      subtitle="Codes from FM's Inf column: what they mean and their colour."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
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

      <ul className="grid gap-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 rounded-xl border border-border bg-surface p-2 sm:grid-cols-[6rem_1fr_9rem_auto]"
          >
            <input
              aria-label="Code"
              placeholder="Code"
              value={r.code}
              onChange={(e) => update(i, { code: e.target.value })}
              className={input}
            />
            <input
              aria-label="Meaning"
              placeholder="Meaning"
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className={input}
            />
            <select
              aria-label="Colour"
              value={r.tone}
              onChange={(e) => update(i, { tone: e.target.value as StatusTone })}
              className={`${input} col-span-2 capitalize sm:col-span-1`}
            >
              {STATUS_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="col-start-3 row-start-1 flex items-center gap-1 sm:col-start-4">
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[r.tone]}`}
              >
                {r.code || '—'}
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.code || 'row'}`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
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
