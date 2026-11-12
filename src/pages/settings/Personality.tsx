import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { scaleRanges } from '../../data/staffInfo'
import { useConfig } from '../../lib/config'
import { PERSONALITY_COLUMNS, type PersonalityRule } from '../../lib/personality'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const small =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-1 text-center text-base tabular-nums md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400'

const COLUMN_LABELS: Record<(typeof PERSONALITY_COLUMNS)[number], string> = {
  professionalism: 'Professionalism',
  pressure: 'Pressure',
  ambition: 'Ambition',
  temperament: 'Temperament',
  loyalty: 'Loyalty',
  sportsmanship: 'Sportsmanship',
  determination: 'Determination',
  leadership: 'Leadership',
}

type Mode = 'allExcept' | 'only'

/** A personality as the form edits it: ranges as "15-20" text, names as a comma list. */
interface RuleForm {
  name: string
  ranges: string[]
  mode: Mode
  list: string
}

const toForm = (r: PersonalityRule): RuleForm => ({
  name: r.name,
  ranges: r.ranges.map((x) => (x ? (x[0] === x[1] ? String(x[0]) : `${x[0]}-${x[1]}`) : '')),
  mode: r.overridesAllExcept ? 'allExcept' : 'only',
  list: (r.overridesAllExcept ?? r.overrides ?? []).join(', '),
})

/** "15-20", "15–20" or "18" → [min, max]; blank or unreadable = any value. */
function parseRange(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return [Math.min(a, b), Math.max(a, b)]
}

const fromForm = (f: RuleForm): PersonalityRule => {
  const list = f.list
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return {
    name: f.name.trim(),
    ranges: f.ranges.map(parseRange),
    ...(f.mode === 'allExcept' ? { overridesAllExcept: list } : { overrides: list }),
  }
}

/** Personality ranges and overlap rules, and the foot strength words. */
export function PersonalitySettings() {
  const config = useConfig()
  const rules = useSaveConfig('personalityRules')
  const words = useSaveConfig('footWords')
  const mins = useSaveConfig('footMins')
  const stored = {
    feet: config.footWords.map((w, i) => ({ w, min: config.footMins[i] ?? 1 })),
    rules: config.personalityRules.map(toForm),
  }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const all = [rules, words, mins]
  const footRanges = scaleRanges(form.feet.map((r) => r.min))
  const setRule = (i: number, patch: Partial<RuleForm>) =>
    setForm({ ...form, rules: form.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  return (
    <SettingsShell
      title="Personality and feet"
      subtitle="How the app names personalities from the hidden values, and the foot strength words. Changes apply from your next import."
      dirty={JSON.stringify(form) !== prev}
      saving={all.some((m) => m.save.isPending || m.reset.isPending)}
      saved={all.some((m) => m.save.isSuccess)}
      error={rules.save.error ?? words.save.error ?? mins.save.error}
      onSave={() => {
        const feet = form.feet.filter((r) => r.w.trim())
        words.save.mutate(feet.map((r) => r.w.trim()))
        mins.save.mutate(feet.map((r) => r.min))
        rules.save.mutate(form.rules.filter((r) => r.name.trim()).map(fromForm))
      }}
      onReset={() => all.forEach((m) => m.reset.mutate())}
    >
      <section className="mb-6 rounded-xl border border-border bg-surface p-3">
        <h2 className="font-semibold">Foot strength (1–20)</h2>
        <p className="mb-2 text-xs text-muted">
          Weakest at the top. Each word starts at the value on its right.
        </p>
        <ul className="grid max-w-xl gap-1">
          {form.feet.map((r, i) => (
            <li key={i} className="flex items-center gap-1">
              <input
                aria-label={`Foot word ${i + 1}`}
                value={r.w}
                onChange={(e) =>
                  setForm({
                    ...form,
                    feet: form.feet.map((x, j) => (j === i ? { ...x, w: e.target.value } : x)),
                  })
                }
                className={`${input} font-semibold`}
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                from
                <input
                  aria-label={`${r.w} starts at`}
                  inputMode="numeric"
                  value={r.min}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      feet: form.feet.map((x, j) =>
                        j === i ? { ...x, min: Number(e.target.value) || 0 } : x,
                      ),
                    })
                  }
                  className="min-h-11 w-14 shrink-0 rounded-lg border border-border bg-surface-2 px-1 text-center text-base tabular-nums md:text-sm"
                />
              </label>
              <span className="w-12 shrink-0 text-right text-xs text-muted tabular-nums">
                {footRanges[i]}
              </span>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Remove ${r.w}`}
                onClick={() => setForm({ ...form, feet: form.feet.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setForm({ ...form, feet: [...form.feet, { w: '', min: 20 }] })}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
        >
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-3">
        <h2 className="font-semibold">Personalities</h2>
        <p className="mb-3 text-xs text-muted">
          The values (1–20) each personality needs: "15-20" for a range, one number for an exact
          value, blank for any. When a player fits more than one, the one that beats the most of the
          others wins; ties go to the one higher in this list. Staff have no Leadership, so only
          rows starting Leadership at 1 can match them.
        </p>
        <ul className="grid gap-3">
          {form.rules.map((r, i) => (
            <li key={i} className="rounded-lg border border-border p-2">
              <div className="mb-2 flex items-center gap-1">
                <input
                  aria-label={`Personality ${i + 1}`}
                  value={r.name}
                  onChange={(e) => setRule(i, { name: e.target.value })}
                  className={`${input} font-semibold`}
                />
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${r.name}`}
                  onClick={() => setForm({ ...form, rules: form.rules.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 lg:grid-cols-8">
                {PERSONALITY_COLUMNS.map((c, k) => (
                  <label key={c} className="grid gap-0.5 text-[11px] text-muted">
                    <span className="truncate">{COLUMN_LABELS[c]}</span>
                    <input
                      aria-label={`${r.name} ${COLUMN_LABELS[c]}`}
                      value={r.ranges[k] ?? ''}
                      placeholder="any"
                      onChange={(e) =>
                        setRule(i, {
                          ranges: PERSONALITY_COLUMNS.map((_, n) =>
                            n === k ? e.target.value : (r.ranges[n] ?? ''),
                          ),
                        })
                      }
                      className={small}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
                <select
                  aria-label={`${r.name} overlap rule`}
                  value={r.mode}
                  onChange={(e) => setRule(i, { mode: e.target.value as Mode })}
                  className={`${input} sm:w-56`}
                >
                  <option value="allExcept">Beats all except</option>
                  <option value="only">Beats only</option>
                </select>
                <input
                  aria-label={`${r.name} overlap names`}
                  value={r.list}
                  placeholder={r.mode === 'allExcept' ? 'none (beats every other)' : 'none'}
                  onChange={(e) => setRule(i, { list: e.target.value })}
                  className={`${input} min-w-0 flex-1`}
                />
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setForm({
              ...form,
              rules: [
                ...form.rules,
                { name: '', ranges: PERSONALITY_COLUMNS.map(() => ''), mode: 'only', list: '' },
              ],
            })
          }
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
        >
          <Plus className="size-4" aria-hidden /> Add personality
        </button>
      </section>
    </SettingsShell>
  )
}
