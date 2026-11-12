import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import { saveConfig } from '../../data/config'
import { ratingColor, scaleRanges } from '../../data/staffInfo'
import { KNOWLEDGE_WORDS } from '../../import/save'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

type Pair = [number, string]

/** Staff rating words with their 1–20 values, and scouting knowledge levels with the save's values. */
export function StaffRatingsSettings() {
  const config = useConfig()
  const scale = useSaveConfig('staffScale')
  const mins = useSaveConfig('staffScaleMin')
  const levels = useSaveConfig('knowledgeLevels')
  const learned = useSaveConfig('learned')
  const storedValues: Pair[] = Object.entries({ ...KNOWLEDGE_WORDS, ...config.learned.knowledge })
    .map(([v, w]) => [Number(v), w] as Pair)
    .sort((a, b) => a[0] - b[0])
  const stored = {
    words: config.staffScale,
    mins: config.staffScaleMin,
    know: config.knowledgeLevels,
    values: storedValues,
  }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const dirty = JSON.stringify(form) !== prev
  const pending = [scale, mins, levels, learned].some((m) => m.save.isPending || m.reset.isPending)

  const rows = form.words.map((w, i) => ({ w, min: form.mins[i] ?? 0 }))
  const setRows = (next: { w: string; min: number }[]) =>
    setForm({ ...form, words: next.map((r) => r.w), mins: next.map((r) => r.min) })
  const ranges = scaleRanges(form.mins)

  return (
    <SettingsShell
      title="Staff ratings"
      subtitle="The words FM uses for staff attributes and scouting knowledge, with the numbers behind them."
      dirty={dirty}
      saving={pending}
      saved={[scale, mins, levels, learned].some((m) => m.save.isSuccess)}
      error={scale.save.error ?? mins.save.error ?? levels.save.error ?? learned.save.error}
      onSave={() => {
        const clean = rows.filter((r) => r.w.trim())
        scale.save.mutate(clean.map((r) => r.w.trim()))
        mins.save.mutate(clean.map((r) => r.min))
        levels.save.mutate(form.know.map((w) => w.trim()).filter(Boolean))
        learned.save.mutate({
          ...config.learned,
          knowledge: Object.fromEntries(
            form.values.filter(([, w]) => w).map(([v, w]) => [String(v), w]),
          ),
        })
      }}
      onReset={async () => {
        scale.reset.mutate()
        mins.reset.mutate()
        levels.reset.mutate()
        await saveConfig('learned', { ...config.learned, knowledge: {} })
        learned.save.reset()
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSection id="staff-ratings/attribute-ratings-1-20" title="Attribute ratings (1–20)">
          <p className="mb-2 text-xs text-muted">
            Worst at the top. Each word starts at the value on its right; colours follow this order.
          </p>
          <ul className="grid gap-1">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-1">
                <input
                  aria-label={`Rating ${i + 1}`}
                  value={r.w}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, w: e.target.value } : x)))
                  }
                  className={`${input} font-semibold ${ratingColor(r.w.trim(), form.words)}`}
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                  from
                  <input
                    aria-label={`${r.w} starts at`}
                    inputMode="numeric"
                    value={r.min}
                    onChange={(e) =>
                      setRows(
                        rows.map((x, j) =>
                          j === i ? { ...x, min: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                    className="min-h-11 w-14 rounded-lg border border-border bg-surface-2 px-2 text-center text-base tabular-nums md:text-sm"
                  />
                </label>
                <span className="w-12 shrink-0 text-right text-xs text-muted tabular-nums">
                  {ranges[i]}
                </span>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${r.w}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRows([...rows, { w: '', min: 20 }])}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </SettingsSection>

        <SettingsSection id="staff-ratings/scouting-knowledge" title="Scouting knowledge">
          <p className="mb-2 text-xs text-muted">Levels, lowest at the top.</p>
          <ul className="grid gap-1">
            {form.know.map((w, i) => (
              <li key={i} className="flex items-center gap-1">
                <input
                  aria-label={`Level ${i + 1}`}
                  value={w}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      know: form.know.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  className={`${input} font-semibold`}
                />
                {(['up', 'down'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={iconBtn}
                    aria-label={`Move ${d}`}
                    disabled={d === 'up' ? i === 0 : i === form.know.length - 1}
                    onClick={() => {
                      const n = [...form.know]
                      const k = d === 'up' ? i - 1 : i + 1
                      ;[n[i], n[k]] = [n[k], n[i]]
                      setForm({ ...form, know: n })
                    }}
                  >
                    {d === 'up' ? (
                      <ChevronUp className="size-4" aria-hidden />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden />
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${w}`}
                  onClick={() => setForm({ ...form, know: form.know.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setForm({ ...form, know: [...form.know, ''] })}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add level
          </button>

          <h3 className="mt-4 text-sm font-semibold">Values in the save (0–100)</h3>
          <p className="mb-2 text-xs text-muted">
            The save stores knowledge as a number; this is the level each number shows in FM.
          </p>
          <ul className="grid gap-1">
            {form.values.map(([v, w], i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label="Value"
                  inputMode="numeric"
                  value={v}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      values: form.values.map((x, j) =>
                        j === i ? [Number(e.target.value) || 0, x[1]] : x,
                      ),
                    })
                  }
                  className="min-h-11 w-20 rounded-lg border border-border bg-surface-2 px-2 text-center text-base tabular-nums md:text-sm"
                />
                <select
                  aria-label={`Level for ${v}`}
                  value={w}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      values: form.values.map((x, j) => (j === i ? [x[0], e.target.value] : x)),
                    })
                  }
                  className={input}
                >
                  {!form.know.includes(w) && <option value={w}>{w || '–'}</option>}
                  {form.know.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${v}`}
                  onClick={() =>
                    setForm({ ...form, values: form.values.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setForm({ ...form, values: [...form.values, [0, form.know[0] ?? '']] })}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add value
          </button>
        </SettingsSection>
      </div>
    </SettingsShell>
  )
}
