import { clsx } from 'clsx'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { SettingsSection } from '../../components/SettingsSection'
import type { Role } from '../../data/attributeInfo'
import { DEFAULT_CONFIG, attributeLabel, type Layout } from '../../data/config'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import {
  addColumn,
  addSection,
  hiddenAttributes,
  moveAttribute,
  moveSection,
  placeAttribute,
  removeColumn,
  removeSection,
  renameSection,
  type Columns,
} from './layoutOps'

const ALL = Object.keys(DEFAULT_CONFIG.attributes)

const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

export function LayoutSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('layout')
  const [layout, setLayout] = useState<Layout>(config.layout)
  const [prev, setPrev] = useState(config.layout)
  if (config.layout !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(config.layout)
    setLayout(config.layout)
  }
  const [role, setRole] = useState<Role>('outfield')

  const columns = layout[role]
  const set = (c: Columns) => setLayout({ ...layout, [role]: c })
  const hidden = hiddenAttributes(columns, ALL)
  const dirty = JSON.stringify(layout) !== JSON.stringify(config.layout)

  // "Move to" choices: every section, plus hidden
  const targets = columns.flatMap((column, col) =>
    column.map((s, sec) => ({ value: `${col}:${sec}`, label: s.label || 'Untitled' })),
  )
  const parseTarget = (v: string) =>
    v === 'hidden'
      ? ('hidden' as const)
      : { col: Number(v.split(':')[0]), sec: Number(v.split(':')[1]) }

  return (
    <SettingsShell
      title="Layout"
      subtitle="Sections, order and grouping of attributes on the squad table and player screen."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(layout)}
      onReset={() => reset.mutate()}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Players"
        >
          {(
            [
              ['outfield', 'Outfield'],
              ['goalkeepers', 'Goalkeepers'],
            ] as const
          ).map(([r, label]) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={clsx(
                'min-h-10 rounded-md px-3 text-sm',
                role === r ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set(addColumn(columns))}
          className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-accent"
        >
          <Plus className="size-4" aria-hidden /> Add column
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">
        The squad table shows these sections left to right, column by column. Empty sections and
        attributes without data are hidden automatically.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4">
        {columns.map((column, col) => (
          <div key={col} className="grid content-start gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Column {col + 1}
              </h2>
              {column.length === 0 && columns.length > 1 && (
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove column ${col + 1}`}
                  onClick={() => set(removeColumn(columns, col))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>

            {column.map((section, sec) => (
              <section key={sec} className="rounded-xl border border-border bg-surface p-2">
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    aria-label="Section name"
                    value={section.label}
                    onChange={(e) => set(renameSection(columns, col, sec, e.target.value))}
                    className="min-h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold hover:border-border focus:border-border sm:w-auto sm:min-w-0 sm:flex-1"
                  />
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section up"
                    disabled={sec === 0}
                    onClick={() => set(moveSection(columns, col, sec, 'up'))}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section down"
                    disabled={sec === column.length - 1}
                    onClick={() => set(moveSection(columns, col, sec, 'down'))}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section to previous column"
                    disabled={col === 0}
                    onClick={() => set(moveSection(columns, col, sec, 'left'))}
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Move section to next column"
                    disabled={col === columns.length - 1}
                    onClick={() => set(moveSection(columns, col, sec, 'right'))}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Delete section (its attributes become hidden)"
                    onClick={() => set(removeSection(columns, col, sec))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                <ul className="mt-1">
                  {section.attributes.map((a, idx) => (
                    <li
                      key={a}
                      className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm odd:bg-surface-2/50"
                    >
                      <span className="min-w-0 flex-1 truncate">{attributeLabel(config, a)}</span>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`Move ${a} up`}
                        disabled={idx === 0}
                        onClick={() => set(moveAttribute(columns, col, sec, idx, -1))}
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`Move ${a} down`}
                        disabled={idx === section.attributes.length - 1}
                        onClick={() => set(moveAttribute(columns, col, sec, idx, 1))}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </button>
                      <select
                        aria-label={`Move ${a} to section`}
                        value={`${col}:${sec}`}
                        onChange={(e) =>
                          set(placeAttribute(columns, a, parseTarget(e.target.value)))
                        }
                        className="min-h-10 w-24 shrink-0 rounded-lg border border-border bg-surface-2 px-1 text-xs"
                      >
                        {targets.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                        <option value="hidden">Hidden</option>
                      </select>
                    </li>
                  ))}
                  {section.attributes.length === 0 && (
                    <li className="px-2 py-2 text-xs text-muted">
                      Empty. Move attributes here with the “Move to” menus.
                    </li>
                  )}
                </ul>
              </section>
            ))}

            <button
              type="button"
              onClick={() => set(addSection(columns, col))}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
            >
              <Plus className="size-4" aria-hidden /> Add section
            </button>
          </div>
        ))}
      </div>

      <SettingsSection
        id="layout/hidden"
        title={<>Hidden ({hidden.length})</>}
        variant="dashed"
        className="mt-6"
      >
        {hidden.length === 0 ? (
          <p className="text-xs text-muted">Every attribute is shown.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {hidden.map((a) => (
              <li key={a} className="flex min-h-11 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{attributeLabel(config, a)}</span>
                <select
                  aria-label={`Show ${a} in section`}
                  value="hidden"
                  onChange={(e) => set(placeAttribute(columns, a, parseTarget(e.target.value)))}
                  className="min-h-10 w-32 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                >
                  <option value="hidden">Add to…</option>
                  {targets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsShell>
  )
}
