import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Names of FM's player traits by the bit the save stores them under (0–63). */
export function TraitNamesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('traitNames')
  const stored = config.traitNames
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  return (
    <SettingsShell
      title="Player traits"
      subtitle="The name of each player trait by the number the save stores it under. 0–45 follow FM's own list; (?) marks a name not confirmed yet; an empty name shows as Trait #n. Players' traits come from the save import."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate(
          Object.fromEntries(
            Object.entries(form)
              .map(([k, v]) => [k, v.trim()])
              .filter(([, v]) => v),
          ),
        )
      }
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-1 sm:grid-cols-2">
        {Array.from({ length: 64 }, (_, bit) => String(bit)).map((bit) => (
          <li key={bit} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-right text-sm text-muted tabular-nums">{bit}</span>
            <input
              aria-label={`Name of trait ${bit}`}
              value={form[bit] ?? ''}
              placeholder={`Trait #${bit}`}
              onChange={(e) => setForm({ ...form, [bit]: e.target.value })}
              className={input}
            />
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
