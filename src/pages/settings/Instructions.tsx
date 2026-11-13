import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { FmInstruction, FmOption } from '../../tactics/fm'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

const PHASES = [
  ['ip', 'In possession'],
  ['oop', 'Out of possession'],
] as const

export function InstructionsSettings() {
  return (
    <InstructionList
      configKey="teamInstructions"
      title="Team instructions"
      subtitle="Every team instruction, its options and the code FM stores for each (0 = not set). The save and exported tactics use these codes; change them after a game update or for a new FM."
    />
  )
}

export function PlayerInstructionsSettings() {
  return (
    <InstructionList
      configKey="playerInstructions"
      title="Player instructions"
      subtitle="Every player instruction, its options and the code FM stores for each (0 = not set). Which options each role has at each position is set in Settings > Roles."
    />
  )
}

/** Editor for a list of FM instructions (team or player) and their option codes. */
function InstructionList({
  configKey,
  title,
  subtitle,
}: {
  configKey: 'teamInstructions' | 'playerInstructions'
  title: string
  subtitle: string
}) {
  const config = useConfig()
  const { save, reset } = useSaveConfig(configKey)
  const stored = config[configKey]
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [open, setOpen] = useState<number | null>(null)
  const team = configKey === 'teamInstructions'
  const update = (i: number, patch: Partial<FmInstruction>) =>
    setForm(form.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const setOption = (i: number, k: number, patch: Partial<FmOption>) =>
    update(i, { options: form[i].options.map((o, n) => (n === k ? { ...o, ...patch } : o)) })
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
  // The same code twice would make the save ambiguous
  const codes = form.flatMap((d) => d.options.map((o) => o.code).filter((c) => c !== 0))
  const repeated = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))]

  return (
    <SettingsShell
      title={title}
      subtitle={subtitle}
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
              options: d.options
                .map((o) => ({ ...o, label: o.label.trim() }))
                .filter((o) => o.label),
            })),
        )
      }
      onReset={() => reset.mutate()}
    >
      {repeated.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-200">
          These codes are used by more than one option: {repeated.join(', ')}.
        </p>
      )}
      <div className="grid gap-4">
        {PHASES.map(([phase, label]) => {
          const list = form.map((d, i) => [d, i] as const).filter(([d]) => d.phase === phase)
          return (
            <SettingsSection
              key={phase}
              id={`${configKey}/${phase}`}
              title={label}
              aside={`${list.length} instructions`}
            >
              <ul className="grid gap-2">
                {list.map(([d, i]) => (
                  <li key={i} className="rounded-lg border border-border">
                    <button
                      type="button"
                      aria-expanded={open === i}
                      onClick={() => setOpen(open === i ? null : i)}
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
                        {d.options.map((o) => o.label).join(' · ')}
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
                            Options in FM&apos;s order, each with its code
                            {team ? '. The ticked one is what a new tactic starts with.' : '.'}
                          </p>
                          <ul className="grid gap-1">
                            {d.options.map((o, k) => (
                              <li key={k} className="flex items-center gap-1">
                                {team && (
                                  <input
                                    type="radio"
                                    aria-label={`New tactics start with ${o.label}`}
                                    name={`default-${i}`}
                                    checked={(d.default ?? 0) === o.code}
                                    onChange={() => update(i, { default: o.code })}
                                    className="size-5 shrink-0"
                                  />
                                )}
                                <input
                                  aria-label="Option"
                                  value={o.label}
                                  onChange={(e) => setOption(i, k, { label: e.target.value })}
                                  className={input}
                                />
                                <input
                                  aria-label={`Code of ${o.label}`}
                                  type="number"
                                  min={0}
                                  max={team ? 95 : 63}
                                  value={o.code}
                                  onChange={(e) =>
                                    setOption(i, k, { code: Math.max(0, Number(e.target.value)) })
                                  }
                                  className={`${input} w-20 shrink-0 tabular-nums`}
                                />
                                {!team && (
                                  <select
                                    aria-label={`Target of ${o.label}`}
                                    value={o.target ?? ''}
                                    onChange={(e) =>
                                      setOption(i, k, {
                                        target: (e.target.value || undefined) as FmOption['target'],
                                      })
                                    }
                                    className={`${input} w-32 shrink-0`}
                                  >
                                    <option value="">No target</option>
                                    <option value="position">A position</option>
                                    <option value="player">A player</option>
                                  </select>
                                )}
                                <button
                                  type="button"
                                  className={iconBtn}
                                  aria-label={`Remove ${o.label}`}
                                  onClick={() =>
                                    update(i, { options: d.options.filter((_, n) => n !== k) })
                                  }
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={() =>
                              update(i, { options: [...d.options, { label: '', code: 0 }] })
                            }
                            className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-accent"
                          >
                            <Plus className="size-4" aria-hidden /> Add option
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setForm([...form, { phase, name: '', options: [{ label: 'Standard', code: 0 }] }])
                  setOpen(form.length)
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
