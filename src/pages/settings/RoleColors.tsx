import { clsx } from 'clsx'
import { useState } from 'react'
import { useConfig } from '../../lib/config'
import { DEFAULT_ROLE_COLORS, KEY_ROW, PREFERRED_ROW } from '../../lib/roleMarks'
import { useSaveConfig } from '../../lib/useSaveConfig'

/** The colours that mark a role's key and preferred attributes, with a preview. */
export function RoleColorsEditor() {
  const { roleColors } = useConfig()
  const { save, reset } = useSaveConfig('roleColors')
  const [form, setForm] = useState(roleColors)
  const [prev, setPrev] = useState(JSON.stringify(roleColors))
  if (prev !== JSON.stringify(roleColors)) {
    setPrev(JSON.stringify(roleColors))
    setForm(roleColors)
  }
  const dirty = JSON.stringify(form) !== prev
  const preview = { '--role-key': form.key, '--role-pref': form.preferred } as React.CSSProperties
  return (
    <section className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Role attribute highlight</h2>
      <p className="text-sm text-muted">
        The colours marking a role&apos;s key and preferred attributes on player pages, Compare,
        Tactics and Settings &gt; Roles. FM27 uses green and blue.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {(
          [
            ['key', 'Key'],
            ['preferred', 'Preferred'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="color"
              aria-label={`${label} colour`}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="size-10 cursor-pointer rounded border border-border bg-transparent"
            />
            {label} <span className="font-mono text-xs text-muted">{form[k].toUpperCase()}</span>
          </label>
        ))}
      </div>
      <ul className="grid max-w-sm gap-0.5 text-sm" style={preview}>
        <li className={clsx('flex justify-between rounded px-2 py-1', KEY_ROW)}>
          <span>Finishing</span>
          <span>16</span>
        </li>
        <li className={clsx('flex justify-between rounded px-2 py-1', PREFERRED_ROW)}>
          <span>Composure</span>
          <span>14</span>
        </li>
        <li className="flex justify-between rounded px-2 py-1 opacity-45">
          <span>Marking</span>
          <span>8</span>
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(form)}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(DEFAULT_ROLE_COLORS)
            reset.mutate()
          }}
          className="min-h-10 rounded-lg border border-border px-4 text-sm"
        >
          FM&apos;s colours
        </button>
        {save.isSuccess && !dirty && <span className="self-center text-sm text-accent">Saved</span>}
      </div>
    </section>
  )
}
