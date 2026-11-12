import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import { JOB_TITLES, STAFF_GROUPS, groupOf, type StaffGroup } from '../../data/staffJobs'
import {
  ATTRIBUTE_GROUPS,
  STAFF_TABS,
  type StaffSection,
  type StaffTab,
} from '../../data/staffInfo'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const ALL_ATTRS = ATTRIBUTE_GROUPS.flatMap((g) => g.attributes)
const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

/** FM's staff profile tabs (attribute sections) and each job's Key Attributes. */
export function StaffAttributesSettings() {
  const config = useConfig()
  const tabs = useSaveConfig('staffTabs')
  const keys = useSaveConfig('staffKeyAttrs')
  const groups = useSaveConfig('staffGroups')
  const shorts = useSaveConfig('staffShort')
  const stored = {
    tabs: config.staffTabs,
    keys: config.staffKeyAttrs,
    groups: config.staffGroups,
    short: config.staffShort,
  }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [tab, setTab] = useState<StaffTab>('managerial')
  const [job, setJob] = useState('Manager')
  const sections = form.tabs[tab] ?? []
  const setSections = (next: StaffSection[]) =>
    setForm({ ...form, tabs: { ...form.tabs, [tab]: next } })
  const setSection = (i: number, patch: Partial<StaffSection>) =>
    setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const jobKeys = form.keys[job] ?? []

  return (
    <SettingsShell
      title="Staff attributes"
      subtitle="Staff categories, how FM's staff profile groups attributes on each tab, and the Key Attributes FM highlights for each job."
      dirty={JSON.stringify(form) !== prev}
      saving={[tabs, keys, groups, shorts].some((m) => m.save.isPending || m.reset.isPending)}
      saved={[tabs, keys, groups, shorts].some((m) => m.save.isSuccess)}
      error={
        tabs.save.error ??
        keys.save.error ??
        groups.save.error ??
        tabs.reset.error ??
        keys.reset.error
      }
      onSave={() => {
        tabs.save.mutate(form.tabs)
        keys.save.mutate(form.keys)
        groups.save.mutate(form.groups)
        shorts.save.mutate(form.short)
      }}
      onReset={() => {
        tabs.reset.mutate()
        keys.reset.mutate()
        groups.reset.mutate()
        shorts.reset.mutate()
      }}
    >
      <SettingsSection
        id="staff-attributes/column-headers"
        title="Column headers"
        hint="The short header each attribute gets on the Staff page (full name on hover)."
        className="mb-6"
      >
        {ATTRIBUTE_GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold text-muted uppercase">{g.label}</h3>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {g.attributes.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{a}</span>
                  <input
                    aria-label={`Header for ${a}`}
                    value={form.short[a] ?? ''}
                    maxLength={4}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        short: { ...form.short, [a]: e.target.value.toUpperCase() },
                      })
                    }
                    className={`${field} w-20 shrink-0 text-center font-semibold`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </SettingsSection>
      <SettingsSection
        id="staff-attributes/staff-categories"
        title="Staff categories"
        className="mb-6"
      >
        <p className="mb-2 text-xs text-muted">
          Where each job is listed on the Staff page and in job pickers.
        </p>
        <ul className="grid gap-x-6 gap-y-2 lg:grid-cols-2">
          {JOB_TITLES.map(([t]) => (
            <li key={t} className="grid gap-1 sm:flex sm:items-center sm:gap-2">
              <span className="min-w-0 text-sm sm:flex-1 sm:truncate">{t}</span>
              <select
                aria-label={`Category of ${t}`}
                value={groupOf(t, form.groups)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    groups: { ...form.groups, [t]: e.target.value as StaffGroup },
                  })
                }
                className={`${field} w-full sm:w-64 sm:shrink-0`}
              >
                {STAFF_GROUPS.map(([g, label]) => (
                  <option key={g} value={g}>
                    {label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSection id="staff-attributes/tabs" title="Tabs">
          <div className="my-2 flex flex-wrap gap-1" role="tablist">
            {STAFF_TABS.map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  'min-h-10 rounded-lg border px-3 text-sm',
                  tab === t
                    ? 'border-accent bg-accent/15 font-semibold text-accent'
                    : 'border-border',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            {sections.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-2">
                <div className="flex items-center gap-1">
                  <input
                    aria-label="Section name"
                    value={s.label}
                    onChange={(e) => setSection(i, { label: e.target.value })}
                    className={`${field} min-w-0 flex-1 font-semibold`}
                  />
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section up"
                    disabled={i === 0}
                    onClick={() => {
                      const n = [...sections]
                      ;[n[i - 1], n[i]] = [n[i], n[i - 1]]
                      setSections(n)
                    }}
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section down"
                    disabled={i === sections.length - 1}
                    onClick={() => {
                      const n = [...sections]
                      ;[n[i + 1], n[i]] = [n[i], n[i + 1]]
                      setSections(n)
                    }}
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={`Remove ${s.label}`}
                    onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <ul className="mt-2 grid gap-1">
                  {s.attributes.map((a, k) => (
                    <li
                      key={a}
                      className="flex min-h-9 items-center gap-1 rounded bg-surface-2 pl-3 text-sm"
                    >
                      <span className="flex-1">{a}</span>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`Move ${a} up`}
                        disabled={k === 0}
                        onClick={() => {
                          const n = [...s.attributes]
                          ;[n[k - 1], n[k]] = [n[k], n[k - 1]]
                          setSection(i, { attributes: n })
                        }}
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`Move ${a} down`}
                        disabled={k === s.attributes.length - 1}
                        onClick={() => {
                          const n = [...s.attributes]
                          ;[n[k + 1], n[k]] = [n[k], n[k + 1]]
                          setSection(i, { attributes: n })
                        }}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`Remove ${a}`}
                        onClick={() =>
                          setSection(i, { attributes: s.attributes.filter((x) => x !== a) })
                        }
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <select
                  aria-label={`Add an attribute to ${s.label}`}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    setSection(i, { attributes: [...s.attributes, e.target.value] })
                  }
                  className={`${field} mt-2 w-full`}
                >
                  <option value="">Add an attribute…</option>
                  {ALL_ATTRS.filter((a) => !s.attributes.includes(a)).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSections([...sections, { label: 'New section', attributes: [] }])}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add section
          </button>
        </SettingsSection>

        <SettingsSection id="staff-attributes/key-attributes-by-job" title="Key Attributes by job">
          <p className="mb-2 text-xs text-muted">
            Marked with a green bar on the staff profile, as FM does.
          </p>
          <select
            aria-label="Job"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            className={`${field} w-full`}
          >
            {STAFF_GROUPS.map(([g, label]) => (
              <optgroup key={g} label={label}>
                {JOB_TITLES.filter(([t]) => groupOf(t, form.groups) === g).map(([t]) => (
                  <option key={t} value={t}>
                    {t}
                    {form.keys[t]?.length ? ` (${form.keys[t].length})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {ATTRIBUTE_GROUPS.map((group) => (
            <div key={group.label} className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-muted uppercase">{group.label}</h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {group.attributes.map((a) => {
                  const on = jobKeys.includes(a)
                  return (
                    <li key={a}>
                      <label
                        className={clsx(
                          'flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm',
                          on ? 'border-l-2 border-accent bg-accent/10' : 'hover:bg-surface-2',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setForm({
                              ...form,
                              keys: {
                                ...form.keys,
                                [job]: on ? jobKeys.filter((x) => x !== a) : [...jobKeys, a],
                              },
                            })
                          }
                          className="size-5"
                        />
                        {a}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </SettingsSection>
      </div>
    </SettingsShell>
  )
}
