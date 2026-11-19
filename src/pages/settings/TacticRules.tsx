import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { TEAM_RULES } from '../../tactics/assistant'

/** The tactic assistant's rules of thumb: each on or off. */
export function TacticRulesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('tacticRules')
  const stored = config.tacticRules
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  return (
    <SettingsShell
      title="Tactic assistant"
      subtitle="The assistant starts from FM27's own data (styles and FM's template tactics) and your squad. These rules of thumb then adjust the team instructions to your players. They are general tactical knowledge, not FM27 data: switch off any that does not play out in your games."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {TEAM_RULES.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface p-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={form[r.id] !== false}
                onChange={(e) => setForm({ ...form, [r.id]: e.target.checked })}
              />
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-sm text-muted">{r.about}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
