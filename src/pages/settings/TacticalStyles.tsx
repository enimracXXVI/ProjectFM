import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { choose, chosen, defaultTeamCodes } from '../../tactics/fm'
import { preferredRoles, type TacticalStyle } from '../../tactics/styles'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const lines = (list: string[]) => list.join('\n')
const unlines = (text: string) => text.split('\n')

/** FM's tactical styles: name, code, mentality, the team instructions each sets, FM's texts. */
export function TacticalStylesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('tacticalStyles')
  const stored = config.tacticalStyles
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [open, setOpen] = useState<number | null>(null)
  const update = (i: number, patch: Partial<TacticalStyle>) =>
    setForm(form.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const defs = config.teamInstructions
  // Codes no instruction in Settings has (FM sets them; kept as they are)
  const unknown = (team: number[]) =>
    team.filter((c) => !defs.some((d) => d.options.some((o) => o.code === c)))

  return (
    <SettingsShell
      title="Tactical styles"
      subtitle="FM's tactical styles: the mentality and team instructions each one sets, and the code FM stores with a tactic. Read from FM27's match data; change them after a game update or for a new FM."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate(
          form
            .filter((s) => s.name.trim())
            .map((s) => ({
              ...s,
              name: s.name.trim(),
              code: s.code.trim().toUpperCase() || 'NULL',
              summary: s.summary.map((x) => x.trim()).filter(Boolean),
              features: s.features.map((x) => x.trim()).filter(Boolean),
              favoured: s.favoured.map((x) => x.trim()).filter(Boolean),
              roles: (s.roles ?? []).map((x) => x.trim()).filter(Boolean),
            })),
        )
      }
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {form.map((s, i) => (
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
              <span className="shrink-0 text-sm font-semibold">{s.name || 'New style'}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                {s.mentality} · {s.team ? `${s.team.length} instructions` : 'standard instructions'}
              </span>
              <span className="font-mono text-xs text-muted">{s.code}</span>
            </button>
            {open === i && (
              <div className="grid gap-2 border-t border-border p-2">
                <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-1">
                  <label className="grid gap-1 text-xs text-muted">
                    Name
                    <input
                      value={s.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className={input}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    FM code
                    <input
                      value={s.code}
                      maxLength={4}
                      onChange={(e) => update(i, { code: e.target.value.toUpperCase() })}
                      className={`${input} font-mono`}
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
                  Mentality
                  <select
                    value={s.mentality}
                    onChange={(e) => update(i, { mentality: e.target.value })}
                    className={input}
                  >
                    {!config.fmCodes.mentalities.includes(s.mentality) && (
                      <option>{s.mentality}</option>
                    )}
                    {config.fmCodes.mentalities.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  FM&apos;s description
                  <textarea
                    value={s.about}
                    rows={3}
                    onChange={(e) => update(i, { about: e.target.value })}
                    className={`${input} py-2`}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Short points (one per line)
                  <textarea
                    value={lines(s.summary)}
                    rows={2}
                    onChange={(e) => update(i, { summary: unlines(e.target.value) })}
                    className={`${input} py-2`}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Features of play (one per line)
                  <textarea
                    value={lines(s.features)}
                    rows={3}
                    onChange={(e) => update(i, { features: unlines(e.target.value) })}
                    className={`${input} py-2`}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Favoured attributes (one per line)
                  <textarea
                    value={lines(s.favoured)}
                    rows={3}
                    onChange={(e) => update(i, { favoured: unlines(e.target.value) })}
                    className={`${input} py-2`}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Preferred roles (one per line, FM&apos;s names)
                  <textarea
                    value={lines(preferredRoles(s))}
                    rows={3}
                    onChange={(e) => update(i, { roles: unlines(e.target.value) })}
                    className={`${input} py-2`}
                  />
                </label>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.team === null}
                    onChange={(e) =>
                      update(i, { team: e.target.checked ? null : defaultTeamCodes(defs) })
                    }
                  />
                  Uses FM&apos;s standard team instructions
                </label>
                {s.team && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-xs text-muted">Team instructions it sets</legend>
                    {(['ip', 'oop'] as const).map((phase) => (
                      <div key={phase} className="grid gap-1 sm:grid-cols-2">
                        {defs
                          .filter((d) => d.phase === phase)
                          .map((d) => (
                            <label
                              key={d.name}
                              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 text-xs"
                            >
                              <span className="truncate text-muted">{d.name}</span>
                              <select
                                value={chosen(d, s.team!)?.code ?? 0}
                                onChange={(e) =>
                                  update(i, { team: choose(d, s.team!, Number(e.target.value)) })
                                }
                                className="min-h-9 min-w-0 rounded-lg border border-border bg-surface-2 px-2"
                              >
                                {d.options.map((o) => (
                                  <option key={o.code + o.label} value={o.code}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                      </div>
                    ))}
                    {unknown(s.team).length > 0 && (
                      <p className="text-xs text-muted">
                        Also sets codes no instruction in Settings has (kept as FM sets them):{' '}
                        {unknown(s.team).join(', ')}.
                      </p>
                    )}
                  </fieldset>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setForm([
            ...form,
            {
              code: 'NULL',
              name: '',
              mentality: 'Balanced',
              team: defaultTeamCodes(defs),
              about: '',
              summary: [],
              features: [],
              favoured: [],
              roles: [],
            },
          ])
          setOpen(form.length)
        }}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add style
      </button>
    </SettingsShell>
  )
}
