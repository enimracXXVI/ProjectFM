import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { PLAYER_RULES, TEAM_RULES } from '../../tactics/builder'
import { SettingsSection } from '../../components/SettingsSection'

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
      subtitle="The assistant builds the shape, XI and roles from your squad and FM27's own data (positions, roles FM offers, FM's role warnings). These rules of thumb then set team and player instructions from your players' attributes. They are general tactical knowledge, not FM27 data: switch off any that does not play out in your games."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      {(
        [
          ['team', 'Team instructions', TEAM_RULES],
          ['player', 'Player instructions', PLAYER_RULES],
        ] as const
      ).map(([id, title, rules]) => (
        <SettingsSection
          key={id}
          id={`tactic-rules/${id}`}
          title={title}
          aside={rules.length}
          className="mb-4"
        >
          <ul className="grid gap-2">
            {rules.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={form[r.id] !== false}
                    onChange={(e) => setForm({ ...form, [r.id]: e.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold">
                      {r.instruction}: {r.name}
                    </span>
                    <span className="block text-sm text-muted">{r.about}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ))}
    </SettingsShell>
  )
}
