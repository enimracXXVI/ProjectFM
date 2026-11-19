import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import { ratingColor, scaleRanges } from '../../data/staffInfo'
import { knowledgeMins, knownKnowledge } from '../../lib/knowledge'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

/** Staff rating words with their 1–20 values, and scouting knowledge levels with the save's values. */
export function StaffRatingsSettings() {
  const config = useConfig()
  const scale = useSaveConfig('staffScale')
  const mins = useSaveConfig('staffScaleMin')
  const levels = useSaveConfig('knowledgeLevels')
  const kMinsSave = useSaveConfig('knowledgeMins')
  const known = knownKnowledge(config.learned.knowledge)
  const startMins = knowledgeMins(
    config.knowledgeLevels,
    config.knowledgeMins,
    config.learned.knowledge,
  )
  const stored = {
    words: config.staffScale,
    mins: config.staffScaleMin,
    know: config.knowledgeLevels,
    from: startMins.map((m) => (m === null ? '' : String(m))),
  }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const dirty = JSON.stringify(form) !== prev
  const pending = [scale, mins, levels, kMinsSave].some(
    (m) => m.save.isPending || m.reset.isPending,
  )

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
      saved={[scale, mins, levels, kMinsSave].some((m) => m.save.isSuccess)}
      error={scale.save.error ?? mins.save.error ?? levels.save.error ?? kMinsSave.save.error}
      onSave={() => {
        const clean = rows.filter((r) => r.w.trim())
        scale.save.mutate(clean.map((r) => r.w.trim()))
        mins.save.mutate(clean.map((r) => r.min))
        const keep = form.know
          .map((w, i) => ({ w: w.trim(), from: form.from[i] ?? '' }))
          .filter((x) => x.w)
        levels.save.mutate(keep.map((x) => x.w))
        kMinsSave.save.mutate(keep.map((x) => (x.from.trim() === '' ? null : Number(x.from))))
      }}
      onReset={() => {
        scale.reset.mutate()
        mins.reset.mutate()
        levels.reset.mutate()
        kMinsSave.reset.mutate()
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
          <p className="mb-2 text-xs text-muted">
            Levels, lowest at the top. The save stores knowledge as a number (0–100): each level
            starts at its &ldquo;From&rdquo; value and runs up to the next level. &ldquo;Seen&rdquo;
            are values checked in FM with that level; a level never seen has no start yet (?).
          </p>
          <ul className="grid gap-2">
            {form.know.map((w, i) => {
              const from = form.from[i] ?? ''
              const next = form.from.slice(i + 1).find((x) => x.trim() !== '')
              const seen = known.filter(([, l]) => l === w).map(([v]) => v)
              const fromN = from.trim() === '' ? null : Number(from)
              const nextN = next === undefined ? null : Number(next)
              const wrong = seen.filter(
                (v) => fromN === null || v < fromN || (nextN !== null && v >= nextN),
              )
              const move = (d: -1 | 1) => {
                const k = i + d
                const a = [...form.know]
                const b = [...form.from]
                ;[a[i], a[k]] = [a[k], a[i]]
                ;[b[i], b[k]] = [b[k], b[i]]
                setForm({ ...form, know: a, from: b })
              }
              return (
                <li key={i} className="grid gap-1 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1">
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
                    <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      From
                      <input
                        aria-label={`${w} from`}
                        inputMode="numeric"
                        placeholder="?"
                        value={from}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            from: form.know.map((_, j) =>
                              j === i
                                ? e.target.value.replace(/[^0-9]/g, '')
                                : (form.from[j] ?? ''),
                            ),
                          })
                        }
                        className="min-h-11 w-16 rounded-lg border border-border bg-surface-2 px-2 text-center text-base tabular-nums md:text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => move(-1)}
                    >
                      <ChevronUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label="Move down"
                      disabled={i === form.know.length - 1}
                      onClick={() => move(1)}
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label={`Remove ${w}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          know: form.know.filter((_, j) => j !== i),
                          from: form.from.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <p className="px-1 text-xs text-muted">
                    {fromN === null
                      ? 'No start yet (?): values only reach this level once it has one.'
                      : `Values ${fromN}–${nextN === null ? 100 : nextN - 1}`}
                    {seen.length > 0 && ` · seen in FM: ${seen.join(', ')}`}
                  </p>
                  {wrong.length > 0 && (
                    <p className="px-1 text-xs text-amber-300">
                      FM showed {w} for {wrong.join(', ')}, outside this range.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => setForm({ ...form, know: [...form.know, ''], from: [...form.from, ''] })}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add level
          </button>
        </SettingsSection>
      </div>
    </SettingsShell>
  )
}
