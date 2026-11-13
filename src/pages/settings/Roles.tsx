import { clsx } from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useConfirm } from '../../components/confirm'
import { SettingsShell } from '../../components/SettingsShell'
import { attributeLabel } from '../../data/config'
import {
  CONFIRMED_SHORT,
  defaultShort,
  roleShort,
  type RoleDef,
  type RolePhase,
} from '../../data/roles'
import { ATTRIBUTE_GROUPS } from '../../import/fields'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { CONDITION_TEXT, type RoleCondition, type RoleFm } from '../../tactics/fm'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

const POSITIONS = [
  'GK',
  'D (C)',
  'D (L)',
  'D (R)',
  'WB (L)',
  'WB (R)',
  'DM',
  'M (C)',
  'M (L)',
  'M (R)',
  'AM (C)',
  'AM (L)',
  'AM (R)',
  'ST (C)',
]

type Mark = 'key' | 'preferred' | null

export function RolesSettings() {
  const config = useConfig()
  const confirm = useConfirm()
  const { save, reset } = useSaveConfig('roles')
  const [roles, setRoles] = useState(config.roles)
  const [prev, setPrev] = useState(config.roles)
  if (config.roles !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(config.roles)
    setRoles(config.roles)
  }
  const [phase, setPhase] = useState<RolePhase>('ip')
  const [filter, setFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = useMemo(() => {
    const q = filter.toLowerCase()
    return roles.filter((r) => r.phase === phase && (!q || r.name.toLowerCase().includes(q)))
  }, [roles, phase, filter])

  const update = (id: string, patch: Partial<RoleDef>) =>
    setRoles(roles.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // Tap cycles: not used → key → preferred → not used
  const cycle = (r: RoleDef, attr: string) => {
    const mark: Mark = r.key.includes(attr)
      ? 'key'
      : r.preferred.includes(attr)
        ? 'preferred'
        : null
    const key = r.key.filter((a) => a !== attr)
    const preferred = r.preferred.filter((a) => a !== attr)
    if (mark === null) key.push(attr)
    if (mark === 'key') preferred.push(attr)
    update(r.id, { key, preferred })
  }

  const addRole = () => {
    const id = `custom-${Date.now()}`
    setRoles([
      ...roles,
      { id, name: 'New role', phase, group: 'Custom', positions: [], key: [], preferred: [] },
    ])
    setOpenId(id)
  }

  const dirty = JSON.stringify(roles) !== JSON.stringify(config.roles)

  return (
    <SettingsShell
      title="Roles"
      subtitle="FM27 roles: positions that can play them and their key and preferred attributes."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(roles)}
      onReset={() => reset.mutate()}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5" role="group">
          {(
            [
              ['ip', 'In possession'],
              ['oop', 'Out of possession'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
              className={clsx(
                'min-h-10 rounded-md px-3 text-sm',
                phase === p ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Find role"
          aria-label="Find role"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${input} bg-surface sm:max-w-xs`}
        />
      </div>
      <p className="mb-3 text-sm text-muted">
        Tap an attribute to cycle it: <span className="text-accent">key</span> →{' '}
        <span className="text-sky-300">preferred</span> → not used.
      </p>

      <ul className="grid gap-2">
        {shown.map((r) => {
          const open = openId === r.id
          const gk = r.positions.includes('GK')
          const attrs = gk
            ? [
                ...ATTRIBUTE_GROUPS.Goalkeeping,
                ...ATTRIBUTE_GROUPS.Mental,
                ...ATTRIBUTE_GROUPS.Physical,
                'First Touch',
                'Passing',
                'Technique',
              ]
            : [
                ...ATTRIBUTE_GROUPS.Technical,
                ...ATTRIBUTE_GROUPS.Mental,
                ...ATTRIBUTE_GROUPS.Physical,
              ]
          return (
            <li key={r.id} className="rounded-xl border border-border bg-surface">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left"
              >
                <span className="font-semibold">
                  <span className="mr-2 inline-block min-w-10 rounded bg-surface-2 px-1.5 py-0.5 text-center text-xs">
                    {roleShort(r)}
                  </span>
                  {r.name}
                </span>
                <span className="text-xs text-muted">
                  {r.positions.join(', ') || 'No positions'}
                </span>
              </button>
              {open && (
                <div className="grid gap-4 border-t border-border p-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="grid min-w-48 flex-1 gap-1 text-xs text-muted">
                      Name
                      <input
                        value={r.name}
                        onChange={(e) => update(r.id, { name: e.target.value })}
                        className={input}
                      />
                    </label>
                    <label className="grid w-24 gap-1 text-xs text-muted">
                      Short name
                      <input
                        value={r.short ?? ''}
                        placeholder={defaultShort(r.id)}
                        onChange={(e) => update(r.id, { short: e.target.value.toUpperCase() })}
                        className={input}
                      />
                      {CONFIRMED_SHORT.has(r.id) && (
                        <span className="text-[11px] text-accent">Checked in FM</span>
                      )}
                    </label>
                    <label className="grid gap-1 text-xs text-muted">
                      Phase
                      <select
                        value={r.phase}
                        onChange={(e) => update(r.id, { phase: e.target.value as RolePhase })}
                        className={input}
                      >
                        <option value="ip">In possession</option>
                        <option value="oop">Out of possession</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      aria-label={`Delete ${r.name}`}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Delete ${r.name}?`,
                            message: 'The role is removed when you save changes.',
                            confirmLabel: 'Delete',
                            danger: true,
                          })
                        )
                          setRoles((all) => all.filter((x) => x.id !== r.id))
                      }}
                      className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted">Positions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {POSITIONS.map((p) => {
                        const on = r.positions.includes(p)
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              update(r.id, {
                                positions: on
                                  ? r.positions.filter((x) => x !== p)
                                  : [...r.positions, p],
                              })
                            }
                            className={clsx(
                              'min-h-9 rounded-full border px-3 text-sm',
                              on
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-border text-muted hover:text-text',
                            )}
                          >
                            {p}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <RoleFmEditor role={r} onChange={(fm) => update(r.id, { fm })} />

                  <div>
                    <p className="mb-1 text-xs text-muted">
                      Attributes ({r.key.length} key, {r.preferred.length} preferred)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {attrs.map((a) => {
                        const mark: Mark = r.key.includes(a)
                          ? 'key'
                          : r.preferred.includes(a)
                            ? 'preferred'
                            : null
                        return (
                          <button
                            key={a}
                            type="button"
                            aria-label={`${a}: ${mark ?? 'not used'}`}
                            onClick={() => cycle(r, a)}
                            className={clsx(
                              'min-h-9 rounded-full border px-3 text-sm',
                              mark === 'key' && 'border-accent bg-accent/15 text-accent',
                              mark === 'preferred' && 'border-sky-400 bg-sky-400/15 text-sky-300',
                              !mark && 'border-border text-muted hover:text-text',
                            )}
                          >
                            {attributeLabel(config, a)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={addRole}
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add role
      </button>
    </SettingsShell>
  )
}

type Rule = 'no' | 'yes' | 'forced'

/**
 * FM's codes for a role: the number the save stores, where FM offers the role (with any shape
 * condition), and which player instructions it has at each of those positions.
 */
function RoleFmEditor({ role, onChange }: { role: RoleDef; onChange: (fm: RoleFm) => void }) {
  const config = useConfig()
  const fm = role.fm ?? {}
  const where = fm.where ?? []
  const [open, setOpen] = useState<string | null>(null)
  const defs = config.playerInstructions.filter((d) => d.phase === role.phase)
  const ruleOf = (pos: string, code: number): Rule => {
    const r = fm.instructions?.[pos]
    return r?.forced.includes(code) ? 'forced' : r?.allowed.includes(code) ? 'yes' : 'no'
  }
  // Tap cycles: not offered → offered → forced by the role → not offered
  const cycle = (pos: string, code: number) => {
    const r = fm.instructions?.[pos] ?? { allowed: [], forced: [] }
    const now = ruleOf(pos, code)
    const allowed = r.allowed.filter((c) => c !== code)
    const forced = r.forced.filter((c) => c !== code)
    if (now === 'no') allowed.push(code)
    if (now === 'yes') forced.push(code)
    onChange({
      ...fm,
      instructions: {
        ...fm.instructions,
        [pos]: { allowed: allowed.sort((a, b) => a - b), forced: forced.sort((a, b) => a - b) },
      },
    })
  }
  return (
    <details className="rounded-lg border border-border">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
        FM codes and player instructions
      </summary>
      <div className="grid gap-3 border-t border-border p-3">
        <label className="grid gap-1 text-xs text-muted">
          Number the save and tactic files store for the role
          <input
            value={fm.code ?? ''}
            inputMode="numeric"
            onChange={(e) =>
              onChange({ ...fm, code: e.target.value.replace(/\D/g, '') || undefined })
            }
            className={`${input} tabular-nums`}
          />
        </label>
        <div>
          <p className="mb-1 text-xs text-muted">
            Where FM offers the role (FM positions; left, centre and right of a pair or trio count
            separately). With none, the positions above are used.
          </p>
          <ul className="grid gap-1">
            {where.map((w, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1">
                <select
                  aria-label="FM position"
                  value={w.pos}
                  onChange={(e) =>
                    onChange({
                      ...fm,
                      where: where.map((x, j) => (j === i ? { ...x, pos: e.target.value } : x)),
                    })
                  }
                  className={`${input} w-28`}
                >
                  {config.fmCodes.positions.map((p) => (
                    <option key={p.id}>{p.id}</option>
                  ))}
                </select>
                <select
                  aria-label={`When at ${w.pos}`}
                  value={w.when ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...fm,
                      where: where.map((x, j) =>
                        j === i
                          ? { ...x, when: (e.target.value || undefined) as RoleCondition }
                          : x,
                      ),
                    })
                  }
                  className={`${input} min-w-0 flex-1`}
                >
                  <option value="">always</option>
                  {(Object.keys(CONDITION_TEXT) as RoleCondition[]).map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_TEXT[c]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setOpen(open === w.pos ? null : w.pos)}
                  className="min-h-11 rounded-lg border border-border px-3 text-sm"
                  aria-expanded={open === w.pos}
                >
                  Instructions
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${w.pos}`}
                  onClick={() => onChange({ ...fm, where: where.filter((_, j) => j !== i) })}
                  className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
                {open === w.pos && (
                  <div className="mt-1 grid w-full gap-2 rounded-lg bg-surface-2/50 p-2">
                    <p className="text-xs text-muted">
                      Tap an option: <span className="text-text">not offered</span> →{' '}
                      <span className="text-accent">offered</span> →{' '}
                      <span className="text-sky-300">always on for this role</span>.
                    </p>
                    {defs.map((d) => (
                      <div key={d.name}>
                        <p className="mb-1 text-xs text-muted">{d.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {d.options
                            .filter((o) => o.code)
                            .map((o) => {
                              const rule = ruleOf(w.pos, o.code)
                              return (
                                <button
                                  key={o.code}
                                  type="button"
                                  aria-label={`${o.label}: ${rule}`}
                                  onClick={() => cycle(w.pos, o.code)}
                                  className={clsx(
                                    'min-h-9 rounded-full border px-3 text-sm',
                                    rule === 'yes' && 'border-accent bg-accent/15 text-accent',
                                    rule === 'forced' &&
                                      'border-sky-400 bg-sky-400/15 text-sky-300',
                                    rule === 'no' && 'border-border text-muted',
                                  )}
                                >
                                  {o.label}
                                </button>
                              )
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...fm,
                where: [...where, { pos: config.fmCodes.positions[0]?.id ?? 'GK' }],
              })
            }
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            <Plus className="size-4" aria-hidden /> Add position
          </button>
        </div>
      </div>
    </details>
  )
}
