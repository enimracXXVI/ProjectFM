import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useCurrentCareer } from '../../lib/career'
import { usePlayers } from '../../data/hooks'
import { TRAINING_KEYS } from '../../training/individual'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { TrainingRoleCodes } from '../../training/individual'

const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-2 text-base md:text-sm'

/** The numbers the save uses for the roles players train, editable. */
export function TrainingRolesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('trainingRoleCodes')
  const stored = config.trainingRoleCodes
  const [form, setForm] = useState<TrainingRoleCodes>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [code, setCode] = useState('')
  // Role numbers your players train that have no name yet, with who trains them
  const career = useCurrentCareer()
  const { data: squad } = usePlayers(career.id)
  const unnamed = new Map<string, string[]>()
  for (const p of squad ?? []) {
    const raw = p.extra[TRAINING_KEYS.ip]
    if (!raw || !/^\d+$/.test(raw)) continue
    const n = String(Number(raw) >> 6)
    if (n in form.ip) continue
    unnamed.set(n, [...(unnamed.get(n) ?? []), `${p.name} (${p.positions ?? '?'})`])
  }
  const rolesOf = (phase: 'ip' | 'oop') => config.roles.filter((r) => r.phase === phase)
  const ipCodes = Object.keys(form.ip).sort((a, b) => Number(a) - Number(b))

  return (
    <SettingsShell
      title="Training roles"
      subtitle="How the save numbers each player's role training (Squad > Training). Found on your FM27 saves by changing one setting at a time in game."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <SettingsSection id="training-roles/ip" title="In possession" className="mb-4">
        <p className="mb-2 text-sm text-muted">
          The save keeps a role number (and the position). Only the roles seen in your saves are
          known; a player training another one shows its number on Squad &gt; Training, and you can
          name it here.
        </p>
        <ul className="grid gap-2">
          {ipCodes.map((c) => (
            <li key={c} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-right text-sm text-muted tabular-nums">{c}</span>
              <select
                aria-label={`Role number ${c}`}
                value={form.ip[c]}
                onChange={(e) => setForm({ ...form, ip: { ...form.ip, [c]: e.target.value } })}
                className={`${field} min-w-0 flex-1`}
              >
                {rolesOf('ip').map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const ip = { ...form.ip }
                  delete ip[c]
                  setForm({ ...form, ip })
                }}
                className="min-h-11 rounded-lg px-3 text-sm text-muted hover:text-text"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {unnamed.size > 0 && (
          <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
            <p className="mb-2 text-sm">
              Not named yet: look one of these players up on FM&apos;s training screen (IP Role) and
              add the number with that role.
            </p>
            <ul className="grid gap-1 text-sm">
              {[...unnamed]
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([n, who]) => (
                  <li key={n} className="flex flex-wrap items-center gap-x-2">
                    <button
                      type="button"
                      onClick={() => setCode(n)}
                      className="min-h-9 w-12 rounded-md border border-border text-right tabular-nums hover:bg-surface-2"
                    >
                      {n}
                    </button>
                    <span className="text-muted">{who.join(', ')}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <input
            inputMode="numeric"
            placeholder="Number"
            aria-label="New role number"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${field} w-28 tabular-nums`}
          />
          <button
            type="button"
            disabled={!code || code in form.ip}
            onClick={() => {
              setForm({ ...form, ip: { ...form.ip, [code]: rolesOf('ip')[0]?.id ?? '' } })
              setCode('')
            }}
            className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </SettingsSection>

      <SettingsSection id="training-roles/oop" title="Out of possession">
        <p className="mb-2 text-sm text-muted">
          FM&apos;s own list of out-of-possession roles, in its order: the save stores the place in
          this list minus 32 (and {form.oopNone} for None).
        </p>
        <ol className="grid gap-2">
          {form.oop.map((id, k) => (
            <li key={k} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-right text-sm text-muted tabular-nums">
                {k - 32}
              </span>
              <select
                aria-label={`Out-of-possession number ${k - 32}`}
                value={id ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    oop: form.oop.map((x, j) => (j === k ? e.target.value || null : x)),
                  })
                }
                className={`${field} min-w-0 flex-1`}
              >
                <option value="">None</option>
                {rolesOf('oop').map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ol>
      </SettingsSection>
    </SettingsShell>
  )
}
