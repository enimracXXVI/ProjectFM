import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { TrainingSession } from '../../training/schedule'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** FM's training sessions: names, codes, categories, descriptions, whether FM schedules take them. */
export function TrainingSessionsSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('trainingSessions')
  const stored = config.trainingSessions
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [open, setOpen] = useState<number | null>(null)
  const update = (i: number, patch: Partial<TrainingSession>) =>
    setForm(form.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const categories = [...new Set(form.map((s) => s.category))]
  const codes = form.map((s) => s.code)
  const repeated = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))]

  return (
    <SettingsShell
      title="Training sessions"
      subtitle="FM's training sessions with the code FM's schedule files use, FM's description, and whether FM schedule files accept them. Change these after a game update or for a new FM."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form.filter((s) => s.name.trim()))}
      onReset={() => reset.mutate()}
    >
      {repeated.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-200">
          These codes are used more than once: {repeated.join(', ')}.
        </p>
      )}
      <div className="grid gap-4">
        {categories.map((c) => {
          const list = form.map((s, i) => [s, i] as const).filter(([s]) => s.category === c)
          return (
            <SettingsSection
              key={c}
              id={`training-sessions/${c}`}
              title={c || 'No category'}
              aside={`${list.length}`}
            >
              <ul className="grid gap-2">
                {list.map(([s, i]) => (
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
                        {s.name || 'New session'}
                      </span>
                      <span className="text-xs text-muted tabular-nums">{s.code}</span>
                    </button>
                    {open === i && (
                      <div className="grid gap-2 border-t border-border p-2">
                        <div className="grid grid-cols-[1fr_6rem_auto] items-end gap-1">
                          <label className="grid gap-1 text-xs text-muted">
                            Name
                            <input
                              value={s.name}
                              onChange={(e) => update(i, { name: e.target.value })}
                              className={input}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-muted">
                            Code
                            <input
                              type="number"
                              min={0}
                              value={s.code}
                              onChange={(e) =>
                                update(i, { code: Math.max(0, Number(e.target.value)) })
                              }
                              className={`${input} tabular-nums`}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${s.name}`}
                            onClick={() => {
                              setForm(form.filter((_, j) => j !== i))
                              setOpen(null)
                            }}
                            className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                        <label className="grid gap-1 text-xs text-muted">
                          Category
                          <input
                            value={s.category}
                            onChange={(e) => update(i, { category: e.target.value })}
                            className={input}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-muted">
                          FM&apos;s description
                          <textarea
                            value={s.about}
                            rows={2}
                            onChange={(e) => update(i, { about: e.target.value })}
                            className={`${input} py-2`}
                          />
                        </label>
                        <label className="flex min-h-9 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={s.fm}
                            onChange={(e) => update(i, { fm: e.target.checked })}
                          />
                          FM schedule files accept this session
                        </label>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setForm([...form, { code: 0, name: '', category: c, about: '', fm: true }])
                  setOpen(form.length)
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
              >
                <Plus className="size-4" aria-hidden /> Add session
              </button>
            </SettingsSection>
          )
        })}
      </div>
    </SettingsShell>
  )
}
