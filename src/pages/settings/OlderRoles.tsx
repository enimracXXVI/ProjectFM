import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Roles from older FMs that FM27 still defines: shown in the app or not. */
export function OlderRolesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('olderRoles')
  const stored = config.olderRoles
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const update = (i: number, patch: Partial<(typeof form)[number]>) =>
    setForm(form.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <SettingsShell
      title="Older roles"
      subtitle="Roles from older FMs that FM27 still defines (in its own role list) but no longer offers in its tactics screens. They stay out of the app unless shown here; with no FM27 positions or key attributes, a shown role only names itself in tactics read from files."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {form.map((r, i) => (
          <li
            key={r.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_9rem] items-center gap-2 rounded-lg border border-border p-2"
          >
            <input
              type="checkbox"
              aria-label={`Show ${r.name} in the app`}
              checked={r.show}
              onChange={(e) => update(i, { show: e.target.checked })}
              className="size-5"
            />
            <input
              aria-label="Name"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className={input}
            />
            <input
              aria-label={`FM number of ${r.name}`}
              title="The number FM stores for the role"
              inputMode="numeric"
              value={r.fm?.code ?? ''}
              onChange={(e) =>
                update(i, { fm: { ...r.fm, code: e.target.value.replace(/\D/g, '') } })
              }
              className={`${input} tabular-nums`}
            />
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
