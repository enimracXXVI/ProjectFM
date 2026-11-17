import { clsx } from 'clsx'
import { useMemo, useState, type ReactNode } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import { ATTRIBUTE_GROUPS } from '../../import/fields'
import { HIDDEN_NAMES, type AttributeInfo } from '../../data/attributeInfo'
import { TEXT, useUrlState } from '../../lib/urlState'
import { LayoutSettings } from './Layout'
import { DEFAULT_CONFIG } from '../../data/config'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Settings → Attributes: names and descriptions, and the layout, on two tabs. */
export function AttributesHub() {
  const [tab, setTab] = useUrlState<'names' | 'layout'>('tab', 'names', TEXT as never)
  const tabs = (
    <div className="mb-4 flex rounded-lg border border-border p-0.5 sm:w-fit" role="tablist">
      {(
        [
          ['names', 'Names and descriptions'],
          ['layout', 'Layout'],
        ] as const
      ).map(([t, label]) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={clsx(
            'min-h-10 flex-1 rounded-md px-4 text-sm',
            tab === t ? 'bg-surface-2 text-text' : 'text-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
  return tab === 'layout' ? <LayoutSettings tabs={tabs} /> : <AttributesSettings tabs={tabs} />
}

function AttributesSettings({ tabs }: { tabs: ReactNode }) {
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

  // FM's profile groups, then the hidden values; anything else under Other
  const grouped = new Set([
    ...(Object.values(ATTRIBUTE_GROUPS).flat() as string[]),
    ...HIDDEN_NAMES,
  ])
  const groups: [string, string[]][] = [
    ...Object.entries(ATTRIBUTE_GROUPS).map(
      ([g, list]) =>
        [g, (list as readonly string[]).filter((n) => names.includes(n))] as [string, string[]],
    ),
    ['Hidden', names.filter((n) => HIDDEN_NAMES.has(n))],
    ['Other', names.filter((n) => !grouped.has(n))],
  ]

  const dirty = JSON.stringify(values) !== JSON.stringify(attributes)
  const update = (name: string, patch: Partial<AttributeInfo>) =>
    setValues({ ...values, [name]: { ...values[name], ...patch } })

  return (
    <SettingsShell
      title="Attributes"
      subtitle="Display name, short column header and the description shown in tooltips, for every attribute and hidden value."
      tabs={tabs}
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
      <div className="grid gap-3">
        {groups.map(([group, list]) =>
          list.length ? (
            <SettingsSection
              key={group}
              id={`attributes/${group}`}
              title={group}
              aside={list.length}
              forceOpen={!!filter}
              defaultOpen={false}
            >
              <ul className="grid gap-2">
                {list.map((n) => (
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
            </SettingsSection>
          ) : null,
        )}
      </div>
    </SettingsShell>
  )
}
