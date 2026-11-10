import { useMemo, useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import type { AttributeInfo } from '../../data/attributeInfo'
import { DEFAULT_CONFIG } from '../../data/config'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function AttributesSettings() {
  const { attributes } = useConfig()
  const { save, reset } = useSaveConfig('attributes')
  const [values, setValues] = useState(attributes)
  const [prev, setPrev] = useState(attributes)
  if (attributes !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(attributes)
    setValues(attributes)
  }
  const [filter, setFilter] = useState('')

  const names = useMemo(() => {
    const q = filter.toLowerCase()
    return Object.keys(DEFAULT_CONFIG.attributes).filter((n) => {
      const v = values[n]
      return (
        !q ||
        n.toLowerCase().includes(q) ||
        (v?.label ?? '').toLowerCase().includes(q) ||
        (v?.abbr ?? '').toLowerCase().includes(q)
      )
    })
  }, [filter, values])

  const dirty = JSON.stringify(values) !== JSON.stringify(attributes)
  const update = (name: string, patch: Partial<AttributeInfo>) =>
    setValues({ ...values, [name]: { ...values[name], ...patch } })

  return (
    <SettingsShell
      title="Attributes"
      subtitle="Display name, short column header and the description shown in tooltips."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(values)}
      onReset={() => reset.mutate()}
    >
      <input
        type="search"
        placeholder="Find attribute"
        aria-label="Find attribute"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={`${input} mb-3 bg-surface md:max-w-xs`}
      />
      <ul className="grid gap-2">
        {names.map((n) => (
          <li
            key={n}
            className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[12rem_6rem_1fr]"
          >
            <label className="grid gap-1 text-xs text-muted">
              Name
              <input
                value={values[n]?.label ?? ''}
                placeholder={n}
                onChange={(e) => update(n, { label: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Short
              <input
                value={values[n]?.abbr ?? ''}
                onChange={(e) => update(n, { abbr: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Description
              <textarea
                rows={2}
                value={values[n]?.description ?? ''}
                onChange={(e) => update(n, { description: e.target.value })}
                className={`${input} py-2`}
              />
            </label>
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
