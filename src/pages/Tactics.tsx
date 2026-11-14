import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ChevronDown,
  Download,
  Lock,
  LockOpen,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  Wand2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { TEXT, useUrlState } from '../lib/urlState'
import { useConfirm } from '../components/confirm'
import { DbUpdateNotice } from '../components/DbUpdateNotice'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { deleteTactic, isMissingTable, saveTactic } from '../data/api'
import type { PlayerRow } from '../data/db'
import { usePlayers, useTactics } from '../data/hooks'
import { roleShort, type RoleDef } from '../data/roles'
import { scoreTextColor } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { attributeLabel } from '../data/config'
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
import {
  choose,
  chosen,
  conflictsIn,
  defaultTeamCodes,
  fromSave,
  fmPositions,
  playerChoices,
  posOf,
  roleIdOf,
  rolesAt,
  shapeOf,
  slotSides,
  sideOf,
  teamCodes,
  type FmPosition,
} from '../tactics/fm'
import { exportProblems, fileTitle, tacticFile } from '../tactics/fmf'
import { briefingText, buildBriefing } from '../tactics/briefing'
import { readFmf } from '../tactics/fmfRead'
import { unzstd } from '../import/readSave'
import { byLastName, shortName } from '../lib/names'

const field =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function Tactics() {
  const career = useCurrentCareer()
  const { data: tactics, error, isPending } = useTactics(career.id)
  const [selected, setSelected] = useUrlState<string | null>('tactic', null)
  const qc = useQueryClient()
  const config = useConfig()
  const create = useMutation({
    mutationFn: () =>
      saveTactic(career.id, null, {
        name: 'New tactic',
        mentality: config.fmCodes.mentalities[3] ?? null,
        slots: FORMATIONS['4-3-3'].map((position) => ({ position })),
        instructions: { team: defaultTeamCodes(config.teamInstructions) },
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tactics'] })
      setSelected(t.id)
    },
  })
  // An FM tactic file: shape, roles and instructions as in FM, best XI from the first team
  const { data: players } = usePlayers(career.id)
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!/\.fmf$/i.test(file.name)) throw new Error('Choose an FM tactic file (.fmf).')
      const t = await readFmf(new Uint8Array(await file.arrayBuffer()), unzstd)
      const read = fromSave(t, config.roles, config.fmCodes)
      const squad = (players ?? []).filter((p) => p.in_squad && !p.extra.team)
      const ctx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }
      const xi = bestXi(read.slots, squad, ctx, new Set())
      return saveTactic(career.id, null, {
        name: t.name || file.name.replace(/\.fmf$/i, ''),
        style: t.style,
        mentality: read.mentality,
        slots: read.slots.map((s, i) => ({ ...s, player: xi[i] })),
        instructions: { team: read.team ?? defaultTeamCodes(config.teamInstructions) },
      })
    },
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
        <label
          className={clsx(
            'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-surface-2',
            upload.isPending && 'pointer-events-none opacity-50',
          )}
        >
          <Upload className="size-4" aria-hidden />
          {upload.isPending ? 'Reading…' : 'Upload FM tactic (.fmf)'}
          <input
            type="file"
            accept=".fmf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) upload.mutate(f)
            }}
          />
        </label>
        <ErrorText error={upload.error} />
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
  const team = teamCodes(form.instructions, config.teamInstructions)
  const setTeam = (codes: number[]) =>
    setForm({ ...form, instructions: { ...form.instructions, team: codes } })
  const save = useMutation({
    mutationFn: () =>
      saveTactic(career.id, tactic.id, {
        name: form.name,
        style: form.style,
        mentality: form.mentality,
        slots: form.slots,
        instructions: { team },
        notes: form.notes,
      }),
    onSuccess: done,
  })
  const problems = exportProblems({ ...form, instructions: { team } }, config)
  const download = () => {
    const bytes = tacticFile({ ...form, instructions: { team } }, config)
    const url = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileTitle(form.name)}.fmf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
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
  const sides = slotSides(
    positions,
    form.slots.map((s) => sideOf(s, phase)),
  )
  const places = pitchPlaces(positions, sides)
  const atFm = fmPositions(form.slots, phase, config.fmCodes)
  const shape = shapeOf(form.slots, phase)
  // Same positions in any slot order
  const shapeKey = (list: (PositionCode | null)[]) => [...list].map(String).sort().join()
  const formation =
    Object.keys(FORMATIONS).find((k) => shapeKey(FORMATIONS[k]) === shapeKey(positions)) ?? ''
  /**
   * A new formation for this phase: slots whose position the new shape still has keep it
   * (with role, instructions and player); the others take the remaining positions.
   */
  const applyFormation = (name: string) => {
    const left = [...FORMATIONS[name]]
    const next: (PositionCode | null)[] = form.slots.map((s) => {
      const k = left.indexOf(posOf(s, phase) as PositionCode)
      return k >= 0 ? left.splice(k, 1)[0] : null
    })
    const slots = form.slots.map((old, i) => {
      if (next[i]) return old
      const position = left.shift() ?? null
      return phase === 'ip'
        ? { ...old, position, side: null, role: null, pi: [] }
        : { ...old, positionOop: position, sideOop: null, roleOop: null, piOop: [], markOop: null }
    })
    setForm({ ...form, slots })
  }
  const rolesFor = (i: number) =>
    rolesAt(config.roles, phase, atFm[i], shape, (p) => POSITION_TEXT[p])
  const used = new Set(form.slots.map((s) => s.player).filter(Boolean))

  // Squad fit of the XI as set, and of the best XI (shown on the pitch corners)
  const fitCtx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }
  const fitNow = gradeTactic(form.slots, squad, fitCtx).team
  const bestPick = bestXi(form.slots, squad, fitCtx, locked)
  const fitBest = gradeTactic(
    form.slots.map((s, i) => ({ ...s, player: bestPick[i] })),
    squad,
    fitCtx,
  ).team
  const [open, setOpen] = useState({ team: false, brief: false, fit: false })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <Card className="grid content-start gap-3">
        <div className="flex items-center gap-1">
          <div className="flex flex-1 rounded-lg border border-border p-1" role="tablist">
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
          <button
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!past.length}
            onClick={undo}
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Undo2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!future.length}
            onClick={redo}
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Redo2 className="size-4" aria-hidden />
          </button>
        </div>
        {/* Pitch: attack at the top */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/60 bg-emerald-950/40">
          {' '}
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
                  {atFm[i]?.id ?? positions[i] ?? '?'}
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
          <PitchScore className="bottom-1.5 left-1.5" label="Squad fit" value={fitNow} />
          <PitchScore className="right-1.5 bottom-1.5" label="Best XI" value={fitBest} />
        </div>
        <p className="text-center text-xs text-muted">
          {phase === 'ip' ? 'In possession' : 'Out of possession'}:{' '}
          {formation || formationLabel(positions)} · tap a position to set it, drag to swap
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="text-muted">Style</span>
            <input
              value={form.style ?? ''}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              className={field}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="text-muted">Mentality</span>
            <select
              value={form.mentality ?? ''}
              onChange={(e) => setForm({ ...form, mentality: e.target.value || null })}
              className={field}
            >
              <option value="">Pick a mentality…</option>
              {form.mentality && !config.fmCodes.mentalities.includes(form.mentality) && (
                <option value={form.mentality}>{form.mentality}</option>
              )}
              {config.fmCodes.mentalities.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">
            Formation {phase === 'ip' ? 'in possession' : 'out of possession'}
          </span>
          <select
            value={formation}
            onChange={(e) => e.target.value && applyFormation(e.target.value)}
            className={field}
          >
            <option value="">{formation ? 'Custom' : 'Pick a formation…'}</option>
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Notes</span>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm"
          />
        </label>
        {tactic.save_index !== null && (
          <p className="text-xs text-muted">
            From your save: every import brings in its shape, roles and instructions as they are in
            FM. Your preferred XI and notes stay.
          </p>
        )}
        <div className="grid gap-1">
          <Button variant="ghost" onClick={download} disabled={problems.length > 0}>
            <Download className="size-4" aria-hidden /> Export to FM (.fmf)
          </Button>
          {problems.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-amber-300">
              {problems.slice(0, 6).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 6 && <li>and {problems.length - 6} more</li>}
            </ul>
          ) : (
            <p className="text-xs text-muted">
              Save the file in FM's tactics folder, then in FM open Tactics and choose Load Tactic.
              The players are picked in your save, not in the file.
            </p>
          )}
        </div>
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

      <div className="grid content-start gap-4">
        {active !== null && form.slots[active] && (
          <SlotPanel
            key={active}
            slot={form.slots[active]}
            phase={phase}
            roles={rolesFor(active)}
            fmPosition={atFm[active]}
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
        <Section
          title={`Team instructions · ${phase === 'ip' ? 'in possession' : 'out of possession'}`}
          open={open.team}
          onToggle={() => setOpen({ ...open, team: !open.team })}
        >
          <InstructionsEditor phase={phase} codes={team} onChange={setTeam} />
        </Section>
        <BriefingSection
          tactic={{ ...form, instructions: { team } }}
          squad={squad}
          open={open.brief}
          onToggle={() => setOpen({ ...open, brief: !open.brief })}
        />
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
          best={bestPick}
          open={open.fit}
          onToggle={() => setOpen({ ...open, fit: !open.fit })}
        />
      </div>
    </div>
  )
}

/** The tactic in words: changed instructions, each position's job and who does it. */
function BriefingSection({
  tactic,
  squad,
  open,
  onToggle,
}: {
  tactic: TacticRow
  squad: PlayerRow[]
  open: boolean
  onToggle: () => void
}) {
  const config = useConfig()
  const [copied, setCopied] = useState(false)
  const b = buildBriefing(tactic, squad, config)
  const copy = async () => {
    await navigator.clipboard.writeText(briefingText(b))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const list = (items: string[]) =>
    items.length ? (
      <ul className="grid gap-0.5 text-sm">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted">All standard</p>
    )
  return (
    <Section
      title="Briefing"
      open={open}
      onToggle={onToggle}
      aside={
        <button type="button" onClick={copy} className="min-h-9 px-2 text-sm text-accent">
          {copied ? 'Copied' : 'Copy'}
        </button>
      }
    >
      <p className="text-sm">
        <span className="font-semibold">{b.title}</span>
        <span className="block text-muted">{b.shape}</span>
      </p>
      {b.watch.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">
          <p className="mb-1 text-xs font-semibold text-amber-200">Watch</p>
          <ul className="grid gap-0.5 text-sm text-amber-100">
            {b.watch.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted">Team instructions in possession</p>
          {list(b.team.ip)}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">Team instructions out of possession</p>
          {list(b.team.oop)}
        </div>
      </div>
      <ul className="grid gap-2">
        {b.slots.map((s, i) => (
          <li key={i} className="rounded-lg bg-surface-2/60 p-2 text-sm">
            <p className="flex items-baseline gap-2">
              <span className="font-semibold">{s.where}</span>
              <span className="ml-auto truncate">
                {s.player ?? '–'}
                {s.fit !== null && (
                  <span className={clsx('ml-1 font-semibold', scoreTextColor(s.fit))}>{s.fit}</span>
                )}
              </span>
            </p>
            <p className="text-muted">{s.roles}</p>
            {s.instructions.length > 0 && (
              <p className="mt-0.5 text-xs text-muted">{s.instructions.join(' · ')}</p>
            )}
            {s.weakest.length > 0 && (
              <p className="mt-0.5 text-xs">
                <span className="text-muted">Weakest key attributes: </span>
                {s.weakest.map(([k, v]) => `${attributeLabel(config, k)} ${v}`).join(', ')}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted">Cover: {s.cover ?? 'none'}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** A score in a corner of the pitch. */
function PitchScore({
  label,
  value,
  className,
}: {
  label: string
  value: number | null
  className: string
}) {
  return (
    <div
      className={clsx(
        'absolute rounded-md bg-surface/90 px-1.5 py-0.5 text-center leading-tight shadow',
        className,
      )}
    >
      <span className="block text-[9px] text-muted">{label}</span>
      <span
        className={clsx(
          'block text-sm font-bold tabular-nums',
          value !== null && scoreTextColor(value),
        )}
      >
        {value ?? '–'}
      </span>
    </div>
  )
}

/**
 * A card that folds on phones (tap its title) and is always open on larger screens.
 */
function Section({
  title,
  aside,
  open,
  onToggle,
  className,
  children,
}: {
  title: string
  aside?: ReactNode
  open: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={clsx('grid gap-3', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left md:pointer-events-none"
        >
          <ChevronDown
            className={clsx(
              'size-4 shrink-0 text-muted transition-transform md:hidden',
              !open && '-rotate-90',
            )}
            aria-hidden
          />
          <h2 className="truncate font-semibold">{title}</h2>
        </button>
        {aside}
      </div>
      <div className={clsx('min-w-0 gap-3', open ? 'grid' : 'hidden', 'md:grid')}>{children}</div>
    </Card>
  )
}

function SlotPanel({
  slot,
  phase,
  roles,
  fmPosition,
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
  fmPosition: FmPosition | null
  squad: PlayerRow[]
  used: Set<string | null | undefined>
  onChange: (patch: Partial<TacticSlot>) => void
  onSwap: (other: number) => void
  others: { i: number; label: string }[]
  index: number
  onClose: () => void
}) {
  const config = useConfig()
  // Opened by tapping a position; folds on phones like the other sections
  const [open, setOpen] = useState(true)
  const role = roles.find((r) => r.id === roleIdOf(slot, phase)) ?? null
  const ranked = squad
    .map((p) => ({ p, score: role ? roleScore(p.attributes, role, config.roleWeights) : null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byLastName(a.p, b.p))
  return (
    <Section
      title={`${posOf(slot, phase) ?? 'Position'} · ${squad.find((p) => p.id === slot.player)?.name ?? 'no player'}`}
      open={open}
      onToggle={() => setOpen(!open)}
      className="border-accent/50"
      aside={
        <button type="button" onClick={onClose} className="min-h-9 px-2 text-sm text-muted">
          Done
        </button>
      }
    >
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
                phase === 'ip'
                  ? { position: v, side: null, role: null, pi: [] }
                  : { positionOop: v, sideOop: null, roleOop: null, piOop: [], markOop: null },
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
              // A new role starts with FM's defaults: no player instructions set
              onChange(
                phase === 'ip'
                  ? { role: e.target.value || null, pi: [] }
                  : { roleOop: e.target.value || null, piOop: [], markOop: null },
              )
            }
            className={field}
          >
            <option value="">Pick a role…</option>
            {roleIdOf(slot, phase) && !role && (
              <option value={roleIdOf(slot, phase)!}>
                {config.roles.find((r) => r.id === roleIdOf(slot, phase))?.name ?? '?'} (not offered
                here)
              </option>
            )}
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PlayerInstructions
        slot={slot}
        phase={phase}
        role={role}
        fmPosition={fmPosition}
        onChange={onChange}
      />
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
    </Section>
  )
}

type Phase = 'ip' | 'oop'

/** Player instructions FM offers for the slot's role at its position, one dropdown each. */
function PlayerInstructions({
  slot,
  phase,
  role,
  fmPosition,
  onChange,
}: {
  slot: TacticSlot
  phase: Phase
  role: RoleDef | null
  fmPosition: FmPosition | null
  onChange: (patch: Partial<TacticSlot>) => void
}) {
  const config = useConfig()
  const codes = (phase === 'ip' ? slot.pi : slot.piOop) ?? []
  const defs = config.playerInstructions.filter((d) => d.phase === phase)
  const set = (next: number[]) => onChange(phase === 'ip' ? { pi: next } : { piOop: next })
  if (!role) return null
  const rows = defs
    .map((d) => ({ d, ...playerChoices(d, role, fmPosition) }))
    .filter((r) => r.options.length > 1 || r.forced)
  if (!rows.length)
    return (
      <p className="text-xs text-muted">
        No player instructions for {role.name} here (Settings &gt; Roles sets them).
      </p>
    )
  const markTarget = rows.some(({ d }) => {
    const c = chosen(d, codes)
    return c?.target === 'position' && c.code !== 0
  })
  return (
    <section className="grid gap-2">
      <h3 className="text-sm text-muted">
        Player instructions {phase === 'ip' ? 'in possession' : 'out of possession'}
      </h3>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
        {rows.map(({ d, options, forced }) => {
          const current = forced ? options[0] : chosen(d, codes)
          return (
            <li key={d.name} className="grid gap-0.5 text-xs">
              <span className="truncate text-muted">{d.name}</span>
              <select
                value={current?.code ?? 0}
                disabled={forced}
                title={forced ? `${role.name} always does this` : undefined}
                onChange={(e) => set(choose(d, codes, Number(e.target.value)))}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm disabled:opacity-70"
              >
                {options.map((o) => (
                  <option key={o.code} value={o.code} disabled={o.target === 'player'}>
                    {o.label}
                    {o.target === 'player' ? ' (set in FM for a match)' : ''}
                    {forced ? ' (role)' : ''}
                  </option>
                ))}
              </select>
            </li>
          )
        })}
      </ul>
      {markTarget && phase === 'oop' && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Opposition position to mark</span>
          <select
            value={slot.markOop ?? ''}
            onChange={(e) => onChange({ markOop: e.target.value || null })}
            className={field}
          >
            <option value="">Pick a position…</option>
            {config.fmCodes.positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}

/** Team instructions for one phase: every instruction FM has, with its options. */
function InstructionsEditor({
  phase,
  codes,
  onChange,
}: {
  phase: Phase
  codes: number[]
  onChange: (codes: number[]) => void
}) {
  const config = useConfig()
  const defs = config.teamInstructions.filter((d) => d.phase === phase)
  const conflicts = conflictsIn(codes, config.teamInstructions, config.fmCodes)
  return (
    <section className="grid gap-2">
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
        {defs.map((d) => (
          <li key={d.name} className="grid gap-0.5 text-xs">
            <span className="truncate text-muted">{d.name}</span>
            <select
              value={chosen(d, codes)?.code ?? 0}
              onChange={(e) => onChange(choose(d, codes, Number(e.target.value)))}
              className="min-h-10 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm font-semibold"
            >
              {d.options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {conflicts.map((c) => (
        <p key={c} className="text-xs text-amber-300">
          FM does not allow {c} together.
        </p>
      ))}
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
  best,
  open,
  onToggle,
}: {
  slots: TacticSlot[]
  squad: PlayerRow[]
  locked: Set<number>
  youth: boolean
  onYouth: (v: boolean) => void
  onLock: (i: number) => void
  onSlots: (slots: TacticSlot[]) => void
  /** The best XI (player per slot), worked out by the page. */
  best: (string | null)[]
  open: boolean
  onToggle: () => void
}) {
  const config = useConfig()
  const ctx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }
  const { fits, team } = gradeTactic(slots, squad, ctx)
  const tips = suggestions(slots, squad, ctx)
  const cover = benchCover(slots, squad, ctx)
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
    <Section title={`Squad fit · ${team ?? '–'}`} open={open} onToggle={onToggle}>
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
    </Section>
  )
}
