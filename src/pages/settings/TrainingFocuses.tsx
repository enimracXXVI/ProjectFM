import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { TrainingFocus } from '../../training/focus'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** FM's individual training focuses: names, groups and the attributes each works on. */
export function TrainingFocusesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('trainingFocuses')
  const stored = config.trainingFocuses
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [open, setOpen] = useState<number | null>(null)
  const update = (i: number, patch: Partial<TrainingFocus>) =>
    setForm(form.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const categories = [...new Set(form.map((f) => f.category))]
  const attributes = Object.keys(config.attributes)

  return (
    <SettingsShell
      title="Training focuses"
      subtitle="FM's individual training focuses and the attributes each one works on (from FM's own data). Change them after a game update or for a new FM."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate(
          form
            .filter((f) => f.name.trim())
            .map((f) => ({ ...f, name: f.name.trim(), category: f.category.trim() })),
        )
      }
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-4">
        {categories.map((c) => {
          const list = form.map((f, i) => [f, i] as const).filter(([f]) => f.category === c)
          return (
            <SettingsSection
              key={c}
              id={`training-focuses/${c}`}
              title={c || 'No group'}
              aside={`${list.length}`}
            >
              <ul className="grid gap-2">
                {list.map(([f, i]) => (
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
                      <span className="shrink-0 text-sm font-semibold">
                        {f.name || 'New focus'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">
                        {f.attributes.join(', ') || 'no attributes set'}
                      </span>
                    </button>
                    {open === i && (
                      <div className="grid gap-2 border-t border-border p-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-1">
                          <label className="grid gap-1 text-xs text-muted">
                            Name
                            <input
                              value={f.name}
                              onChange={(e) => update(i, { name: e.target.value })}
                              className={input}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
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
                          Group
                          <input
                            value={f.category}
                            onChange={(e) => update(i, { category: e.target.value })}
                            className={input}
                          />
                        </label>
                        <fieldset className="grid gap-1">
                          <legend className="mb-1 text-xs text-muted">Attributes it trains</legend>
                          <div className="flex flex-wrap gap-1">
                            {[...new Set([...attributes, ...f.attributes])].map((a) => {
                              const on = f.attributes.includes(a)
                              return (
                                <button
                                  key={a}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() =>
                                    update(i, {
                                      attributes: on
                                        ? f.attributes.filter((x) => x !== a)
                                        : [...f.attributes, a],
                                    })
                                  }
                                  className={clsx(
                                    'min-h-9 rounded-full border px-3 text-xs',
                                    on
                                      ? 'border-accent bg-accent/15 font-semibold text-accent'
                                      : 'border-border text-muted hover:bg-surface-2',
                                  )}
                                >
                                  {config.attributes[a]?.label ?? a}
                                </button>
                              )
                            })}
                          </div>
                        </fieldset>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setForm([...form, { code: 0, name: '', category: c, attributes: [] }])
                  setOpen(form.length)
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
              >
                <Plus className="size-4" aria-hidden /> Add focus
              </button>
            </SettingsSection>
          )
        })}
      </div>
    </SettingsShell>
  )
}
