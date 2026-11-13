import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Lock, LockOpen, Plus, Redo2, Trash2, Undo2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { TEXT, useUrlState } from '../lib/urlState'
import { useConfirm } from '../components/confirm'
import { DbUpdateNotice } from '../components/DbUpdateNotice'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { deleteTactic, isMissingTable, rememberTactic, saveTactic } from '../data/api'
import type { Instructions } from '../tactics/saveRoles'
import type { PlayerRow } from '../data/db'
import { usePlayers, useTactics } from '../data/hooks'
import { roleShort, type RoleDef } from '../data/roles'
import { scoreTextColor } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { roleScore } from '../lib/roleFit'
import { benchCover, bestXi, gradeTactic, suggestions } from '../tactics/analysis'
import {
  FORMATIONS,
  POSITION_CODES,
  POSITION_TEXT,
  formationLabel,
  pitchPlaces,
} from '../tactics/positions'
import type { PositionCode, TacticRow, TacticSlot } from '../tactics/types'
import { byLastName, shortName } from '../lib/names'

const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function Tactics() {
  const career = useCurrentCareer()
  const { data: tactics, error, isPending } = useTactics(career.id)
  const [selected, setSelected] = useUrlState<string | null>('tactic', null)
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: () =>
      saveTactic(career.id, null, {
        name: 'New tactic',
        slots: FORMATIONS['4-3-3'].map((position) => ({ position })),
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tactics'] })
      setSelected(t.id)
    },
  })

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error)
    return (
      <>
        <PageHeader title="Tactics" />
        {isMissingTable(error) ? <DbUpdateNotice /> : <Placeholder>{error.message}</Placeholder>}
      </>
    )
  const current = tactics.find((t) => t.id === selected) ?? tactics[0]

  return (
    <>
      <PageHeader
        title="Tactics"
        subtitle="Your tactics from the save, with roles and your preferred XI"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tactics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={clsx(
              'min-h-11 rounded-full border px-4 text-sm',
              t.id === current?.id
                ? 'border-accent bg-accent/15 font-semibold text-accent'
                : 'border-border hover:bg-surface-2',
            )}
          >
            {t.name}
          </button>
        ))}
        <Button variant="ghost" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4" aria-hidden /> New tactic
        </Button>
        <ErrorText error={create.error} />
      </div>
      {current ? (
        <TacticEditor key={current.id + current.updated_at} tactic={current} />
      ) : (
        <Placeholder>Import your save to bring in your tactics, or create one.</Placeholder>
      )}
    </>
  )
}

function TacticEditor({ tactic }: { tactic: TacticRow }) {
  const career = useCurrentCareer()
  const config = useConfig()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const { data: players } = usePlayers(career.id)
  const [youth, setYouth] = useState(false)
  // First team by default; U20 and U18 players on request
  const squad = (players ?? []).filter((p) => p.in_squad && (youth || !p.extra.team))
  const [form, setFormRaw] = useState(tactic)
  // Undo / redo of every edit since the tactic was opened
  const [past, setPast] = useState<TacticRow[]>([])
  const [future, setFuture] = useState<TacticRow[]>([])
  const setForm = (next: TacticRow) => {
    setPast((p) => [...p.slice(-49), form])
    setFuture([])
    setFormRaw(next)
  }
  const undo = () => {
    if (!past.length) return
    setFuture((f) => [form, ...f])
    setFormRaw(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, form])
    setFormRaw(future[0])
    setFuture((f) => f.slice(1))
  }
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [phase, setPhase] = useUrlState<Phase>('phase', 'ip', TEXT as never)
  const dirty = JSON.stringify(form) !== JSON.stringify(tactic)
  const done = () => qc.invalidateQueries({ queryKey: ['tactics'] })
  const instructions = (form.instructions ?? {}) as Instructions
  const setInstructions = (patch: Partial<Instructions>) =>
    setForm({
      ...form,
      instructions: { ...instructions, ...patch, changed: false } as Record<string, unknown>,
    })
  const save = useMutation({
    mutationFn: async () => {
      await saveTactic(career.id, tactic.id, {
        name: form.name,
        style: form.style,
        mentality: form.mentality,
        slots: form.slots,
        instructions: form.instructions,
        notes: form.notes,
      })
      // Roles and instruction words set on a save tactic are learned for later imports
      if (tactic.save_index !== null) await rememberTactic(form.slots, instructions)
    },
    onSuccess: () => {
      done()
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const remove = useMutation({ mutationFn: () => deleteTactic(tactic.id), onSuccess: done })

  const setSlot = (i: number, patch: Partial<TacticSlot>) =>
    setForm({ ...form, slots: form.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  /** Swaps the players of two slots (positions and roles stay with the slots). */
  const swap = (a: number, b: number) => {
    if (a === b) return
    const slots = form.slots.map((s) => ({ ...s }))
    ;[slots[a].player, slots[b].player] = [slots[b].player, slots[a].player]
    setForm({ ...form, slots })
  }
  const roleOf = (s: TacticSlot) => config.roles.find((r) => r.id === roleIdOf(s, phase)) ?? null
  const playerOf = (s: TacticSlot) => squad.find((p) => p.id === s.player) ?? null
  const positions = form.slots.map((s) => posOf(s, phase))
  const places = pitchPlaces(positions)
  const formation =
    Object.keys(FORMATIONS).find(
      (k) => JSON.stringify(FORMATIONS[k]) === JSON.stringify(positions),
    ) ?? ''
  const rolesFor = (pos: PositionCode | null) =>
    pos ? config.roles.filter((r) => r.positions.includes(POSITION_TEXT[pos])) : []
  const used = new Set(form.slots.map((s) => s.player).filter(Boolean))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div>
        <div className="mb-3 flex rounded-lg border border-border p-1" role="tablist">
          {(
            [
              ['ip', 'In possession'],
              ['oop', 'Out of possession'],
            ] as const
          ).map(([ph, label]) => (
            <button
              key={ph}
              type="button"
              role="tab"
              aria-selected={phase === ph}
              onClick={() => setPhase(ph)}
              className={clsx(
                'min-h-10 flex-1 rounded-md text-sm',
                phase === ph ? 'bg-surface-2 font-semibold' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Pitch: attack at the top */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/60 bg-emerald-950/40">
          <div className="absolute inset-x-[20%] top-0 h-[12%] border-x border-b border-emerald-800/50" />
          <div className="absolute inset-x-[20%] bottom-0 h-[12%] border-x border-t border-emerald-800/50" />
          <div className="absolute inset-x-0 top-1/2 border-t border-emerald-800/50" />
          {form.slots.map((s, i) => {
            const p = playerOf(s)
            const role = roleOf(s)
            const score = p && role ? roleScore(p.attributes, role, config.roleWeights) : null
            const { x, y } = places[i]
            return (
              <button
                key={i}
                type="button"
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null) swap(dragFrom, i)
                  setDragFrom(null)
                }}
                onClick={() => setActive(active === i ? null : i)}
                style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
                className={clsx(
                  'absolute w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface/95 px-1 py-1 text-center leading-tight shadow',
                  active === i ? 'border-accent ring-2 ring-accent/50' : 'border-border',
                  !positions[i] && 'border-amber-400',
                )}
              >
                <span className="block text-[10px] text-muted">
                  {positions[i] ?? '?'}
                  {score !== null && (
                    <span className={clsx('ml-1 font-semibold', scoreTextColor(score))}>
                      {score}
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] font-semibold">
                  {p ? shortName(p) : '–'}
                </span>
                <span className="block truncate text-[9px] text-muted">
                  {role ? roleShort(role) : 'No role'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          {phase === 'ip' ? 'In possession' : 'Out of possession'}:{' '}
          {formation || formationLabel(positions)} · tap a position to set it, drag to swap
        </p>
      </div>

      <div className="grid content-start gap-4">
        <SquadFit
          slots={form.slots}
          squad={squad}
          locked={locked}
          youth={youth}
          onYouth={setYouth}
          onLock={(i) => {
            const n = new Set(locked)
            if (n.has(i)) n.delete(i)
            else n.add(i)
            setLocked(n)
          }}
          onSlots={(slots) => setForm({ ...form, slots })}
          undo={past.length ? undo : null}
          redo={future.length ? redo : null}
        />
        {active !== null && form.slots[active] && (
          <SlotPanel
            slot={form.slots[active]}
            phase={phase}
            roles={rolesFor(posOf(form.slots[active], phase)).filter((r) => r.phase === phase)}
            squad={squad}
            used={used}
            onChange={(patch) => setSlot(active, patch)}
            onSwap={(other) => swap(active, other)}
            others={form.slots.map((s, i) => ({
              i,
              label: `${posOf(s, phase) ?? '?'} · ${playerOf(s) ? shortName(playerOf(s)!) : '–'}`,
            }))}
            index={active}
            onClose={() => setActive(null)}
          />
        )}
        <Card className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={field}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Style</span>
              <input
                value={form.style ?? ''}
                onChange={(e) => setForm({ ...form, style: e.target.value })}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Mentality</span>
              <input
                value={form.mentality ?? ''}
                onChange={(e) => setForm({ ...form, mentality: e.target.value })}
                className={field}
              />
            </label>
          </div>
          {tactic.save_index === null && (
            <label className="grid gap-1 text-sm">
              <span className="text-muted">
                Formation {phase === 'ip' ? 'in possession' : 'out of possession'}
              </span>
              <select
                value={formation}
                onChange={(e) =>
                  e.target.value &&
                  setForm({
                    ...form,
                    slots: FORMATIONS[e.target.value].map((position, i) => {
                      const old = form.slots[i] ?? { position: null }
                      return phase === 'ip'
                        ? { ...old, position, role: null }
                        : { ...old, positionOop: position, roleOop: null }
                    }),
                  })
                }
                className={field}
              >
                <option value="">{formation ? 'Custom' : 'Pick a formation…'}</option>
                {Object.keys(FORMATIONS).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          <InstructionsEditor
            phase={phase}
            instructions={instructions}
            onChange={setInstructions}
          />
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Notes</span>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm"
            />
          </label>
          {tactic.save_index !== null && (
            <p className="text-xs text-muted">
              From your save: name, style, mentality and positions update on every import; roles,
              preferred XI and notes are yours.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setForm(tactic)} disabled={!dirty}>
              Undo changes
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${tactic.name}?`,
                    message:
                      tactic.save_index !== null
                        ? 'It comes back with your next save import (without your roles and notes).'
                        : undefined,
                    confirmLabel: 'Delete',
                    danger: true,
                  })
                )
                  remove.mutate()
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
            <ErrorText error={save.error ?? remove.error} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function SlotPanel({
  slot,
  phase,
  roles,
  squad,
  used,
  onChange,
  onSwap,
  others,
  index,
  onClose,
}: {
  slot: TacticSlot
  phase: Phase
  roles: RoleDef[]
  squad: PlayerRow[]
  used: Set<string | null | undefined>
  onChange: (patch: Partial<TacticSlot>) => void
  onSwap: (other: number) => void
  others: { i: number; label: string }[]
  index: number
  onClose: () => void
}) {
  const config = useConfig()
  const role = roles.find((r) => r.id === roleIdOf(slot, phase)) ?? null
  const ranked = squad
    .map((p) => ({ p, score: role ? roleScore(p.attributes, role, config.roleWeights) : null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byLastName(a.p, b.p))
  return (
    <Card className="grid gap-3 border-accent/50">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Position</h2>
        <button type="button" onClick={onClose} className="min-h-9 px-2 text-sm text-muted">
          Done
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">
            Position {phase === 'ip' ? 'in possession' : 'out of possession'}
          </span>
          <select
            value={posOf(slot, phase) ?? ''}
            onChange={(e) => {
              const v = (e.target.value || null) as PositionCode | null
              onChange(
                phase === 'ip' ? { position: v, role: null } : { positionOop: v, roleOop: null },
              )
            }}
            className={field}
          >
            <option value="">?</option>
            {POSITION_CODES.map((c) => (
              <option key={c} value={c}>
                {POSITION_TEXT[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Role</span>
          <select
            value={roleIdOf(slot, phase) ?? ''}
            onChange={(e) =>
              onChange(
                phase === 'ip'
                  ? { role: e.target.value || null }
                  : { roleOop: e.target.value || null },
              )
            }
            className={field}
          >
            <option value="">Pick a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Swap player with</span>
        <select
          value=""
          onChange={(e) => e.target.value && onSwap(Number(e.target.value))}
          className={field}
        >
          <option value="">Pick a position…</option>
          {others
            .filter((o) => o.i !== index)
            .map((o) => (
              <option key={o.i} value={o.i}>
                {o.label}
              </option>
            ))}
        </select>
      </label>
      <div>
        <p className="mb-1 text-sm text-muted">
          Preferred player {role ? '(best for the role first)' : ''}
        </p>
        <ul className="grid max-h-72 gap-0.5 overflow-y-auto">
          {ranked.map(({ p, score }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange({ player: p.id })}
                className={clsx(
                  'flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm',
                  slot.player === p.id
                    ? 'bg-accent/15 font-semibold text-accent'
                    : 'hover:bg-surface-2',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {used.has(p.id) && slot.player !== p.id && (
                    <span className="ml-1 text-xs text-muted">(in XI)</span>
                  )}
                </span>
                <span className="text-xs text-muted">{p.positions}</span>
                {score !== null && (
                  <span
                    className={clsx(
                      'w-8 text-right font-semibold tabular-nums',
                      scoreTextColor(score),
                    )}
                  >
                    {score}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

type Phase = 'ip' | 'oop'

const posOf = (s: TacticSlot, phase: Phase) =>
  phase === 'ip' ? s.position : (s.positionOop ?? s.position)

const roleIdOf = (s: TacticSlot, phase: Phase) => (phase === 'ip' ? s.role : s.roleOop)

/** Team instructions for one phase, as label → value rows (FM's own words). */
function InstructionsEditor({
  phase,
  instructions,
  onChange,
}: {
  phase: Phase
  instructions: Instructions
  onChange: (patch: Partial<Instructions>) => void
}) {
  const rows = (phase === 'ip' ? instructions.ip : instructions.oop) ?? []
  const defs = useConfig().teamInstructions.filter((d) => d.phase === phase)
  const set = (next: [string, string][]) => onChange(phase === 'ip' ? { ip: next } : { oop: next })
  return (
    <section className="grid gap-2">
      <h3 className="text-sm text-muted">
        Instructions {phase === 'ip' ? 'in possession' : 'out of possession'}
      </h3>
      {instructions.changed && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-200">
          The app does not know these instructions yet (the save stores them only as numbers). Set
          them as they are on your FM tactic screen and save: the app remembers them from then on.
        </p>
      )}
      <ul className="grid gap-1">
        {rows.map(([label, value], i) => {
          const def = defs.find((d) => d.name === label)
          const options = def?.options ?? []
          // Names already used by other rows are not offered again
          const free = defs.filter((d) => d.name === label || !rows.some(([l]) => l === d.name))
          return (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <select
                aria-label="Instruction"
                value={label}
                onChange={(e) => {
                  const next = defs.find((d) => d.name === e.target.value)
                  set(
                    rows.map((r, j) =>
                      j === i ? [e.target.value, next?.options.includes(r[1]) ? r[1] : ''] : r,
                    ),
                  )
                }}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm"
              >
                <option value="">Pick an instruction…</option>
                {label && !def && <option value={label}>{label}</option>}
                {free.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${label} setting`}
                value={value}
                disabled={!label}
                onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm font-semibold disabled:opacity-50"
              >
                <option value="">Pick an option…</option>
                {value && !options.includes(value) && <option value={value}>{value}</option>}
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => set(rows.filter((_, j) => j !== i))}
                className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => set([...rows, ['', '']])}
        className="justify-self-start text-sm text-accent"
      >
        + Add instruction
      </button>
    </section>
  )
}

/** Squad fit of the tactic: team and slot scores, best XI, suggestions and bench cover. */
function SquadFit({
  slots,
  squad,
  locked,
  youth,
  onYouth,
  onLock,
  onSlots,
  undo,
  redo,
}: {
  slots: TacticSlot[]
  squad: PlayerRow[]
  locked: Set<number>
  youth: boolean
  onYouth: (v: boolean) => void
  onLock: (i: number) => void
  onSlots: (slots: TacticSlot[]) => void
  undo: (() => void) | null
  redo: (() => void) | null
}) {
  const config = useConfig()
  const ctx = { roles: config.roles, weights: config.roleWeights }
  const { fits, team } = gradeTactic(slots, squad, ctx)
  const tips = suggestions(slots, squad, ctx)
  const cover = benchCover(slots, squad, ctx)
  const best = bestXi(slots, squad, ctx, locked)
  const bestTeam = gradeTactic(
    slots.map((s, i) => ({ ...s, player: best[i] })),
    squad,
    ctx,
  ).team
  const roleName = (id: string | null | undefined) => {
    const r = config.roles.find((x) => x.id === id)
    return r ? roleShort(r) : '–'
  }
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-muted">Squad fit</p>
          <p
            className={clsx(
              'text-3xl font-bold tabular-nums',
              team !== null && scoreTextColor(team),
            )}
          >
            {team ?? '–'}
          </p>
        </div>
        {bestTeam !== null && bestTeam !== team && (
          <p className="text-sm text-muted">
            Best XI would score{' '}
            <span className={clsx('font-semibold', scoreTextColor(bestTeam))}>{bestTeam}</span>
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!undo}
            onClick={() => undo?.()}
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Undo2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!redo}
            onClick={() => redo?.()}
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Redo2 className="size-4" aria-hidden />
          </button>
          <Button onClick={() => onSlots(slots.map((s, i) => ({ ...s, player: best[i] })))}>
            <Wand2 className="size-4" aria-hidden /> Pick best XI
          </Button>
        </div>
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={youth} onChange={(e) => onYouth(e.target.checked)} />
        Include U20 and U18 players
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 pr-1 font-normal" title="Lock: Pick best XI keeps this player">
                <Lock className="size-3.5" aria-label="Lock" />
              </th>
              <th className="py-1 pr-2 font-normal">Pos</th>
              <th className="py-1 pr-2 font-normal">Roles</th>
              <th className="py-1 pr-2 font-normal">Player</th>
              <th className="py-1 pr-2 text-right font-normal">Fit</th>
              <th className="py-1 pr-2 font-normal">Suggestion</th>
              <th className="py-1 font-normal">Cover</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s, i) => {
              const f = fits[i]
              const tip =
                tips.find((t) => t.slot === i && t.kind === 'role') ??
                tips.find((t) => t.slot === i)
              const c = cover[i]
              return (
                <tr key={i} className="border-t border-border/50 align-middle">
                  <td className="py-1 pr-1">
                    <button
                      type="button"
                      aria-label={locked.has(i) ? 'Unlock' : 'Lock'}
                      onClick={() => onLock(i)}
                      className={clsx(
                        'grid size-8 place-items-center rounded-md',
                        locked.has(i) ? 'text-accent' : 'text-muted hover:text-text',
                      )}
                    >
                      {locked.has(i) ? (
                        <Lock className="size-3.5" aria-hidden />
                      ) : (
                        <LockOpen className="size-3.5" aria-hidden />
                      )}
                    </button>
                  </td>
                  <td className="py-1 pr-2 text-muted">{s.position ?? '?'}</td>
                  <td className="py-1 pr-2 text-xs whitespace-nowrap text-muted">
                    {roleName(s.role)}
                    {s.roleOop ? ` / ${roleName(s.roleOop)}` : ''}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {f.player ? shortName(f.player) : <span className="text-muted">–</span>}
                    {f.outOfPosition && (
                      <span className="ml-1 text-xs text-amber-300" title="Not his position">
                        out of position
                      </span>
                    )}
                  </td>
                  <td
                    className={clsx(
                      'py-1 pr-2 text-right font-semibold tabular-nums',
                      f.score !== null && scoreTextColor(f.score),
                    )}
                  >
                    {f.score ?? '–'}
                  </td>
                  <td className="py-1 pr-2 text-xs">
                    {tip && (
                      <button
                        type="button"
                        onClick={() =>
                          onSlots(
                            slots.map((x, j) =>
                              j !== i
                                ? x
                                : tip.kind === 'role'
                                  ? { ...x, role: tip.value }
                                  : { ...x, player: tip.value },
                            ),
                          )
                        }
                        className="text-left text-accent hover:underline"
                        title="Apply"
                      >
                        {tip.kind === 'role' ? 'Role: ' : 'Player: '}
                        {tip.label} ({tip.from ?? '–'} → {tip.to})
                      </button>
                    )}
                  </td>
                  <td className="py-1 text-xs whitespace-nowrap text-muted">
                    {c ? (
                      <>
                        {shortName(c.player)}{' '}
                        <span className={clsx('font-semibold', scoreTextColor(c.score))}>
                          {c.score}
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-300">none</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Fit: the player&apos;s role scores in this slot (both phases), 0–100. Pick best XI fills
        every unlocked slot with the best players who can play the position. Cover: the best player
        outside the XI for that position.
      </p>
    </Card>
  )
}
