import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, EyeOff, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import {
  DEFAULT_VIEWS,
  RESERVED_EXTRA_KEYS,
  type ExtraColumn,
  type ExtraViewKey,
} from '../../data/columns'
import { usePlayers } from '../../data/hooks'
import { useCurrentCareer } from '../../lib/career'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

export function ColumnsSettings() {
  const config = useConfig()
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { save, reset } = useSaveConfig('views')
  const [views, setViews] = useState(config.views)
  const [prev, setPrev] = useState(config.views)
  if (config.views !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(config.views)
    setViews(config.views)
  }
  const [tab, setTab] = useState<ExtraViewKey>('contract')
  const [custom, setCustom] = useState('')

  const columns = views[tab].columns
  const setColumns = (c: ExtraColumn[]) =>
    setViews({ ...views, [tab]: { ...views[tab], columns: c } })
  const update = (i: number, patch: Partial<ExtraColumn>) =>
    setColumns(columns.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, d: -1 | 1) => {
    const c = [...columns]
    ;[c[i], c[i + d]] = [c[i + d], c[i]]
    setColumns(c)
  }
  const add = (key: string) => {
    const k = key.trim()
    if (!k || columns.some((c) => c.key === k)) return
    const def = Object.values(DEFAULT_VIEWS)
      .flatMap((v) => v.columns)
      .find((c) => c.key === k)
    setColumns([...columns, def ?? { key: k, short: k }])
  }

  // Columns not shown in this tab: defaults you hid, plus anything found in your imports
  const available = useMemo(() => {
    const used = new Set(Object.values(views).flatMap((v) => v.columns.map((c) => c.key)))
    const fromDefaults = DEFAULT_VIEWS[tab].columns.map((c) => c.key)
    const fromData = [...new Set((players ?? []).flatMap((p) => Object.keys(p.extra)))].filter(
      (k) => !RESERVED_EXTRA_KEYS.has(k),
    )
    return [...new Set([...fromDefaults, ...fromData])].filter((k) => !used.has(k)).sort()
  }, [views, tab, players])

  const dirty = JSON.stringify(views) !== JSON.stringify(config.views)

  return (
    <SettingsShell
      title="Contract & Stats columns"
      subtitle="Which columns the Contract and Stats tabs show, their order, names and tooltips."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(views)}
      onReset={() => reset.mutate()}
    >
      <div className="mb-4 flex rounded-lg border border-border p-0.5 sm:w-fit" role="group">
        {(
          [
            ['contract', 'Contract'],
            ['stats', 'Stats'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={tab === v}
            onClick={() => setTab(v)}
            className={clsx(
              'min-h-10 flex-1 rounded-md px-4 text-sm',
              tab === v ? 'bg-surface-2 text-text' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="grid gap-2">
        {columns.map((c, i) => (
          <li
            key={c.key}
            className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[10rem_8rem_12rem_1fr_auto]"
          >
            <div className="grid gap-1 text-xs text-muted">
              FM column
              <span className="flex min-h-11 items-center text-sm font-medium text-text">
                {c.key}
              </span>
            </div>
            <label className="grid gap-1 text-xs text-muted">
              Header
              <input
                value={c.short}
                onChange={(e) => update(i, { short: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Tooltip title
              <input
                value={c.label ?? ''}
                placeholder={c.key}
                onChange={(e) => update(i, { label: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Description
              <textarea
                rows={1}
                value={c.description ?? ''}
                onChange={(e) => update(i, { description: e.target.value })}
                className={`${input} py-2`}
              />
            </label>
            <div className="flex items-end gap-1">
              <button
                type="button"
                className={iconBtn}
                aria-label={`Move ${c.key} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Move ${c.key} down`}
                disabled={i === columns.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Hide ${c.key}`}
                onClick={() => setColumns(columns.filter((_, j) => j !== i))}
              >
                <EyeOff className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <SettingsSection
        id="columns/not-shown"
        title={<>Not shown ({available.length})</>}
        variant="dashed"
        className="mt-6"
      >
        {available.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {available.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => add(k)}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
              >
                <Plus className="size-4" aria-hidden /> {k}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Nothing else found in your imports. Columns you hide appear here.
          </p>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add(custom)
            setCustom('')
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add by FM column header, e.g. Shots"
            aria-label="FM column header"
            className={`${input} bg-surface sm:max-w-xs`}
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface-2"
          >
            Add
          </button>
        </form>
      </SettingsSection>
    </SettingsShell>
  )
}
