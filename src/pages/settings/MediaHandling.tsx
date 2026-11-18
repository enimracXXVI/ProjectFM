import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import {
  MEDIA_FALLBACK,
  MEDIA_KEYS,
  MEDIA_KEY_LABELS,
  type MediaKey,
  type MediaRule,
} from '../../lib/mediaHandling'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const small =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-1 text-center text-base tabular-nums md:text-sm'

const rangeText = (r?: [number, number]) =>
  !r ? '' : r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`
function parseRange(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return [Math.min(a, b), Math.max(a, b)]
}

type Form = { name: string; confirmed: boolean; ranges: Record<MediaKey, string> }
const toForm = (r: MediaRule): Form => ({
  name: r.name,
  confirmed: r.confirmed,
  ranges: Object.fromEntries(MEDIA_KEYS.map((k) => [k, rangeText(r.ranges[k])])) as Record<
    MediaKey,
    string
  >,
})
const fromForm = (f: Form): MediaRule => ({
  name: f.name.trim(),
  confirmed: f.confirmed,
  ranges: Object.fromEntries(
    MEDIA_KEYS.map((k) => [k, parseRange(f.ranges[k])]).filter(([, r]) => r),
  ) as MediaRule['ranges'],
})

/** Rules that give FM's media handling style from the hidden personality values. */
export function MediaHandlingSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('mediaHandling')
  const stored = config.mediaHandling
  const [form, setForm] = useState(() => stored.map(toForm))
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored.map(toForm))
  }
  const update = (i: number, patch: Partial<Form>) =>
    setForm(form.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const rules = form.map(fromForm).filter((r) => r.name)
  return (
    <SettingsShell
      title="Media handling"
      subtitle={`FM's media handling style, worked out from the hidden personality values (1–20). A player gets every style whose ranges he meets (FM can show two). Blank = any value; "15-20" or "18". Players meeting no rule are Media-friendly with Loyalty 10 or less (Level-headed needs 11+), otherwise "${MEDIA_FALLBACK}": the save cannot tell those two apart. Unconfirmed rules show with (?).`}
      dirty={JSON.stringify(rules) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(rules)}
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {form.map((f, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Style"
                value={f.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className={`${input} font-semibold sm:max-w-xs`}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.confirmed}
                  onChange={(e) => update(i, { confirmed: e.target.checked })}
                  className="size-5"
                />
                Confirmed
              </label>
              <button
                type="button"
                aria-label={`Delete ${f.name}`}
                onClick={() => setForm(form.filter((_, j) => j !== i))}
                className="ml-auto grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {MEDIA_KEYS.map((k) => (
                <label key={k} className="grid gap-1 text-xs text-muted">
                  <span className="truncate">{MEDIA_KEY_LABELS[k]}</span>
                  <input
                    value={f.ranges[k]}
                    placeholder="any"
                    onChange={(e) => update(i, { ranges: { ...f.ranges, [k]: e.target.value } })}
                    className={small}
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          setForm([
            ...form,
            toForm({ name: 'New style', confirmed: false, ranges: {} as MediaRule['ranges'] }),
          ])
        }
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add style
      </button>
    </SettingsShell>
  )
}
