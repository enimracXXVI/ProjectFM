import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { WARNING_RULES, type RoleWarning } from '../../tactics/warnings'

const input =
  'min-h-11 w-28 rounded-lg border border-border bg-surface-2 px-3 text-base tabular-nums md:text-sm'

/** Settings for the Tactics page: the briefing's low-fit threshold. */
export function TacticsSettings() {
  const { briefingLowFit } = useConfig()
  const { save, reset } = useSaveConfig('briefingLowFit')
  const [value, setValue] = useState(String(briefingLowFit))
  const [prev, setPrev] = useState(briefingLowFit)
  if (prev !== briefingLowFit) {
    setPrev(briefingLowFit)
    setValue(String(briefingLowFit))
  }
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100
  return (
    <SettingsShell
      title="Tactics"
      subtitle="How the Tactics page judges your tactic."
      dirty={valid && n !== briefingLowFit}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => valid && save.mutate(n)}
      onReset={() => reset.mutate()}
    >
      <SettingsSection id="tactics/briefing" title="Briefing">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">
            Flag a player in the briefing&apos;s Watch list when his fit for the roles is below
            (0–100, the same score as Squad fit)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={input}
          />
        </label>
      </SettingsSection>
    </SettingsShell>
  )
}

/** FM's role-combination warnings: on/off, limits and texts. */
export function RoleWarningsSettings() {
  const { roleWarnings } = useConfig()
  const { save, reset } = useSaveConfig('roleWarnings')
  const [form, setForm] = useState(roleWarnings)
  const [prev, setPrev] = useState(JSON.stringify(roleWarnings))
  if (prev !== JSON.stringify(roleWarnings)) {
    setPrev(JSON.stringify(roleWarnings))
    setForm(roleWarnings)
  }
  const update = (id: string, patch: Partial<RoleWarning>) =>
    setForm(form.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  return (
    <SettingsShell
      title="Role warnings"
      subtitle="FM's own warnings about role combinations, shown in the briefing's Watch list. The texts are FM's; FM's files do not include the rules behind them, so each rule follows the warning's wording, and the limits are the app's."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-3">
        {form.map((w) => (
          <li key={w.id} className="grid gap-2 rounded-lg border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={w.on}
                onChange={(e) => update(w.id, { on: e.target.checked })}
                className="mt-1 size-4"
              />
              <span className="text-muted">{WARNING_RULES[w.id] ?? 'Rule'}</span>
            </label>
            {w.limit !== undefined && (
              <label className="flex items-center gap-2 text-sm text-muted">
                How many
                <input
                  type="number"
                  min={1}
                  value={w.limit}
                  onChange={(e) => update(w.id, { limit: Math.max(1, Number(e.target.value)) })}
                  className={input}
                />
              </label>
            )}
            <textarea
              aria-label="Warning text"
              value={w.text}
              rows={2}
              onChange={(e) => update(w.id, { text: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm"
            />
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
