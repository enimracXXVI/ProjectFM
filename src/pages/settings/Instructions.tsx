import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import {
  PHASE_LABELS,
  type InstructionDef,
  type InstructionPhase,
} from '../../tactics/instructionList'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

/** FM's team instructions and the options each one offers, by phase. */
export function InstructionsSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('teamInstructions')
  const stored = config.teamInstructions
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [open, setOpen] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const update = (i: number, patch: Partial<InstructionDef>) =>
    setForm(form.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const move = (i: number, by: number) => {
    // Swap with the next instruction of the same phase
    const phase = form[i].phase
    let k = i + by
    while (k >= 0 && k < form.length && form[k].phase !== phase) k += by
    if (k < 0 || k >= form.length) return
    const n = [...form]
    ;[n[i], n[k]] = [n[k], n[i]]
    setForm(n)
    setOpen(k)
  }

  return (
    <SettingsShell
      title="Team instructions"
      subtitle="Every team instruction and the options FM offers for it. The tactic screen lets you pick from these."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate(
          form
            .filter((d) => d.name.trim())
            .map((d) => ({
              ...d,
              name: d.name.trim(),
              options: d.options.map((o) => o.trim()).filter(Boolean),
            })),
        )
      }
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-4">
        {(Object.keys(PHASE_LABELS) as InstructionPhase[]).map((phase) => {
          const list = form.map((d, i) => [d, i] as const).filter(([d]) => d.phase === phase)
          return (
            <SettingsSection
              key={phase}
              id={`instructions/${phase}`}
              title={PHASE_LABELS[phase]}
              aside={`${list.length} instructions`}
            >
              <ul className="grid gap-2">
                {list.map(([d, i]) => (
                  <li key={i} className="rounded-lg border border-border">
                    <button
                      type="button"
                      aria-expanded={open === i}
                      onClick={() => {
                        setOpen(open === i ? null : i)
                        setDraft('')
                      }}
                      className="flex min-h-11 w-full items-center gap-2 px-2 text-left"
                    >
                      <ChevronDown
                        className={clsx(
                          'size-4 shrink-0 text-muted transition-transform',
                          open !== i && '-rotate-90',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {d.name || 'New instruction'}
                      </span>
                      <span className="hidden truncate text-xs text-muted sm:block">
                        {d.options.join(' · ')}
                      </span>
                    </button>
                    {open === i && (
                      <div className="grid gap-3 border-t border-border p-2">
                        <div className="flex items-center gap-1">
                          <input
                            aria-label="Instruction name"
                            value={d.name}
                            onChange={(e) => update(i, { name: e.target.value })}
                            className={`${input} font-semibold`}
                          />
                          <button
                            type="button"
                            className={iconBtn}
                            aria-label="Move up"
                            onClick={() => move(i, -1)}
                          >
                            <ChevronUp className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            aria-label="Move down"
                            onClick={() => move(i, 1)}
                          >
                            <ChevronDown className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            aria-label={`Remove ${d.name}`}
                            onClick={() => {
                              setForm(form.filter((_, j) => j !== i))
                              setOpen(null)
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-muted">
                            Options, in FM's order (left to right as FM lists them)
                          </p>
                          <ul className="flex flex-wrap gap-1">
                            {d.options.map((o, k) => (
                              <li
                                key={k}
                                className="flex min-h-9 items-center gap-1 rounded-lg bg-surface-2 pl-3 text-sm"
                              >
                                {o}
                                <button
                                  type="button"
                                  className="grid size-8 place-items-center rounded-lg text-muted hover:text-red-400"
                                  aria-label={`Remove ${o}`}
                                  onClick={() =>
                                    update(i, { options: d.options.filter((_, n) => n !== k) })
                                  }
                                >
                                  <X className="size-3.5" aria-hidden />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <form
                            className="mt-2 flex gap-1"
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (!draft.trim()) return
                              update(i, { options: [...d.options, draft.trim()] })
                              setDraft('')
                            }}
                          >
                            <input
                              aria-label="New option"
                              placeholder="Add an option, e.g. Much Higher"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              className={input}
                            />
                            <button
                              type="submit"
                              className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-semibold text-accent"
                            >
                              Add
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setForm([...form, { phase, name: '', options: [] }])
                  setOpen(form.length)
                  setDraft('')
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
              >
                <Plus className="size-4" aria-hidden /> Add instruction
              </button>
            </SettingsSection>
          )
        })}
      </div>
    </SettingsShell>
  )
}
