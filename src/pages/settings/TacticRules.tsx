import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { PLAYER_RULES, TEAM_RULES } from '../../tactics/builder'
import { ROLE_LINKS, TEAM_CONFLICTS } from '../../tactics/ideas'
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
      title="Tactic assistant rules"
      subtitle="Rules of thumb the tactic assistant uses on top of its game ideas (Settings > Game ideas): roles that need a partner, team instructions that work against each other (also checked in the Tactics page briefing), and instructions worked out from your players' attributes. General football knowledge, not FM27 data: switch off any that does not play out in your games."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      {(
        [
          [
            'links',
            'Role pairings',
            ROLE_LINKS.map((r) => ({ id: r.id, title: r.name, about: r.about })),
          ],
          [
            'conflicts',
            'Team instructions that do not fit together',
            TEAM_CONFLICTS.map((r) => ({
              id: r.id,
              title: `${r.a.instruction} (${r.a.options.join(', ')}) with ${r.b.instruction} (${r.b.options.join(', ')})`,
              about: r.why,
            })),
          ],
          [
            'team',
            'Team instructions from attributes',
            TEAM_RULES.map((r) => ({
              id: r.id,
              title: `${r.instruction}: ${r.name}`,
              about: r.about,
            })),
          ],
          [
            'player',
            'Player instructions from attributes',
            PLAYER_RULES.map((r) => ({
              id: r.id,
              title: `${r.instruction}: ${r.name}`,
              about: r.about,
            })),
          ],
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
                    <span className="block font-semibold">{r.title}</span>
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
