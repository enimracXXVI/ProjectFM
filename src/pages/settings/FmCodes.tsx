import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FmAboutEditor } from '../../components/FmAboutEditor'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { FmCodes, FmPosition, Side } from '../../tactics/fm'
import { POSITION_CODES, POSITION_TEXT } from '../../tactics/positions'
import type { PositionCode } from '../../tactics/types'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

/** FM's game-wide tactic codes: mentalities, positions, role code bits, instruction clashes. */
export function FmCodesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('fmCodes')
  const stored = config.fmCodes
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const set = (patch: Partial<FmCodes>) => setForm({ ...form, ...patch })
  const setPosition = (i: number, patch: Partial<FmPosition>) =>
    set({ positions: form.positions.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const moveMentality = (i: number, by: number) => {
    const k = i + by
    if (k < 0 || k >= form.mentalities.length) return
    const n = [...form.mentalities]
    ;[n[i], n[k]] = [n[k], n[i]]
    set({ mentalities: n })
  }
  const [pair, setPair] = useState(['', ''])
  const [newTag, setNewTag] = useState('')

  return (
    <SettingsShell
      title="FM codes"
      subtitle="How FM stores mentality, positions and roles in the save and in tactic files. Change these after a game update or for a new FM."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate({
          ...form,
          mentalities: form.mentalities.map((m) => m.trim()).filter(Boolean),
        })
      }
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-4">
        <SettingsSection id="fm-codes/game" title="Game">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Which FM these codes are for</span>
            <input
              value={form.game}
              onChange={(e) => set({ game: e.target.value })}
              className={input}
            />
          </label>
        </SettingsSection>

        <SettingsSection
          id="fm-codes/mentalities"
          title="Mentalities"
          aside={`${form.mentalities.length}`}
        >
          <p className="mb-2 text-xs text-muted">
            In FM&apos;s order: the first is stored as 1, the next as 2, and so on.
          </p>
          <ul className="grid gap-1">
            {form.mentalities.map((m, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-6 shrink-0 text-right text-xs text-muted tabular-nums">
                  {i + 1}
                </span>
                <input
                  aria-label={`Mentality ${i + 1}`}
                  value={m}
                  onChange={(e) =>
                    set({
                      mentalities: form.mentalities.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  className={input}
                />
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Move up"
                  onClick={() => moveMentality(i, -1)}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Move down"
                  onClick={() => moveMentality(i, 1)}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${m}`}
                  onClick={() => set({ mentalities: form.mentalities.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => set({ mentalities: [...form.mentalities, ''] })}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add mentality
          </button>
        </SettingsSection>

        <SettingsSection id="fm-codes/mentality-texts" title="Mentality texts">
          <p className="mb-2 text-xs text-muted">
            FM&apos;s explanation of each mentality, shown on the Tactics page.
          </p>
          <div className="grid gap-3">
            {form.mentalities.filter(Boolean).map((m) => (
              <div key={m} className="grid gap-1">
                <p className="text-sm font-semibold">{m}</p>
                <FmAboutEditor
                  about={form.mentalityTexts[m]}
                  onChange={(about) =>
                    set({ mentalityTexts: { ...form.mentalityTexts, [m]: about } })
                  }
                />
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          id="fm-codes/role-tags"
          title="Role tags"
          aside={`${Object.keys(form.roleTags).length}`}
        >
          <p className="mb-2 text-xs text-muted">
            What each role tag means (shown when you tap a tag on the Tactics page). Which tags a
            role has is set in Settings &gt; Roles.
          </p>
          <ul className="grid gap-2">
            {Object.entries(form.roleTags).map(([tag, text]) => (
              <li key={tag} className="grid gap-1">
                <span className="text-sm font-semibold">{tag}</span>
                <textarea
                  aria-label={`What ${tag} means`}
                  value={text}
                  rows={2}
                  onChange={(e) => set({ roleTags: { ...form.roleTags, [tag]: e.target.value } })}
                  className={`${input} py-2`}
                />
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              const tag = newTag.trim()
              if (!tag || form.roleTags[tag] !== undefined) return
              set({ roleTags: { ...form.roleTags, [tag]: '' } })
              setNewTag('')
            }}
          >
            <input
              aria-label="New tag"
              placeholder="Add a tag, e.g. Holds Position"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className={input}
            />
            <button
              type="submit"
              className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-semibold text-accent"
            >
              Add
            </button>
          </form>
        </SettingsSection>

        <SettingsSection
          id="fm-codes/positions"
          title="Positions"
          aside={`${form.positions.length}`}
        >
          <p className="mb-2 text-xs text-muted">
            Each FM tactic position: its name, the app position it is, its side when FM uses two or
            three of the same (left, centre, right), and the number FM stores for it.
          </p>
          <ul className="grid gap-1">
            {form.positions.map((p, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-1">
                <input
                  aria-label="Name"
                  value={p.id}
                  onChange={(e) => setPosition(i, { id: e.target.value.trim() })}
                  className={input}
                />
                <select
                  aria-label={`App position of ${p.id}`}
                  value={p.position}
                  onChange={(e) => setPosition(i, { position: e.target.value as PositionCode })}
                  className={input}
                >
                  {POSITION_CODES.map((c) => (
                    <option key={c} value={c}>
                      {POSITION_TEXT[c]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Side of ${p.id}`}
                  value={p.side ?? ''}
                  onChange={(e) =>
                    setPosition(i, { side: (e.target.value || null) as Side | null })
                  }
                  className={input}
                >
                  <option value="">No side</option>
                  <option value="L">Left</option>
                  <option value="C">Centre</option>
                  <option value="R">Right</option>
                </select>
                <input
                  aria-label={`Code of ${p.id}`}
                  type="number"
                  min={0}
                  value={p.mask}
                  onChange={(e) => setPosition(i, { mask: Math.max(0, Number(e.target.value)) })}
                  className={`${input} tabular-nums`}
                />
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove ${p.id}`}
                  onClick={() => set({ positions: form.positions.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              set({
                positions: [...form.positions, { id: '', position: 'GK', side: null, mask: 0 }],
              })
            }
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add position
          </button>
        </SettingsSection>

        <SettingsSection id="fm-codes/roles" title="Role numbers">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">
              Bits of a stored role number that name the role (the rest are FM&apos;s own flags).
              Each role&apos;s number is in Settings &gt; Roles.
            </span>
            <input
              value={form.roleCodeMask}
              inputMode="numeric"
              onChange={(e) => set({ roleCodeMask: e.target.value.replace(/\D/g, '') })}
              className={`${input} tabular-nums`}
            />
          </label>
        </SettingsSection>

        <SettingsSection
          id="fm-codes/conflicts"
          title="Team instructions FM does not allow together"
          aside={`${form.conflicts.length}`}
        >
          <ul className="grid gap-1">
            {form.conflicts.map(([a, b], i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {label(config.teamInstructions, a)} + {label(config.teamInstructions, b)}
                </span>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Remove"
                  onClick={() => set({ conflicts: form.conflicts.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex flex-wrap items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              const [a, b] = pair.map(Number)
              if (!a || !b || a === b) return
              set({ conflicts: [...form.conflicts, [a, b]] })
              setPair(['', ''])
            }}
          >
            {[0, 1].map((k) => (
              <select
                key={k}
                aria-label={k ? 'Second option' : 'First option'}
                value={pair[k]}
                onChange={(e) => setPair(pair.map((x, j) => (j === k ? e.target.value : x)))}
                className={`${input} sm:w-auto sm:flex-1`}
              >
                <option value="">Pick an option…</option>
                {config.teamInstructions.flatMap((d) =>
                  d.options
                    .filter((o) => o.code)
                    .map((o) => (
                      <option key={`${d.name}-${o.code}`} value={o.code}>
                        {d.name}: {o.label}
                      </option>
                    )),
                )}
              </select>
            ))}
            <button
              type="submit"
              className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-semibold text-accent"
            >
              Add
            </button>
          </form>
        </SettingsSection>
      </div>
    </SettingsShell>
  )
}

function label(defs: { name: string; options: { label: string; code: number }[] }[], code: number) {
  for (const d of defs) {
    const o = d.options.find((x) => x.code === code)
    if (o) return `${d.name}: ${o.label}`
  }
  return `Code ${code}`
}
