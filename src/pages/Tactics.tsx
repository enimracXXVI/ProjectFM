import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ChevronDown,
  Copy,
  Download,
  Lock,
  LockOpen,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TEXT, useUrlState } from '../lib/urlState'
import { useConfirm } from '../components/confirm'
import { DbUpdateNotice } from '../components/DbUpdateNotice'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { deleteTactic, isMissingTable, saveTactic } from '../data/api'
import type { PlayerRow } from '../data/db'
import { usePlayers, useTactics } from '../data/hooks'
import { roleShort, type RoleDef } from '../data/roles'
import { attrColor, attrNumber, formatAttr, scoreTextColor } from '../lib/attributes'
import { ATTRIBUTE_INFO, PROFILE_COLUMNS } from '../data/attributeInfo'
import { KEY_ROW, PREFERRED_ROW } from '../lib/roleMarks'
import { useCurrentCareer } from '../lib/career'
import { attributeLabel } from '../data/config'
import { FmAboutLine } from '../components/FmAboutBox'
import { useConfig } from '../lib/config'
import { RoleAttributes } from '../components/RoleAttributes'
import { InstructionCard } from '../components/InstructionCard'
import { useFoot } from '../lib/useFoot'
import { roleScore } from '../lib/roleFit'
import {
  BACKUP_COUNT,
  benchCover,
  bestXi,
  canPlay,
  gradeTactic,
  playsPosition,
  positionRating,
  slotScore,
  suggestBackups,
  suggestions,
  withPlayer,
} from '../tactics/analysis'
import { FORMATIONS, POSITION_TEXT, formationLabel, pitchPlaces } from '../tactics/positions'
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
  FM_GRID,
  moveSlot,
  inFmPositionOrder,
  swapPlaces,
  DEFAULT_FM_CODES,
} from '../tactics/fm'
import { exportProblems, fileTitle, tacticFile } from '../tactics/fmf'
import { briefingText, buildBriefing } from '../tactics/briefing'
import { readFmf } from '../tactics/fmfRead'
import { unzstd } from '../import/readSave'
import { useLearnFileVersion } from '../lib/fileVersion'
import { matchRoles, styleOf, styleText, type TacticalStyle } from '../tactics/styles'
import { FM_TEMPLATES, templateTactic } from '../tactics/templates'
import { tacticComplexity } from '../tactics/complexity'
import { ratingSet } from '../tactics/matchData'
import { byLastName, shortName } from '../lib/names'

/** Pitch coordinates (0–1, own goal at 0) of an FM position on FM's grid. */
function gridPlace(id: string | undefined) {
  const g = id ? FM_GRID[id] : undefined
  if (!g) return null
  const rows = [0.07, 0.22, 0.38, 0.54, 0.7, 0.87]
  return { x: 0.1 + g.col * 0.2, y: rows[g.row] }
}

const field =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function Tactics() {
  const career = useCurrentCareer()
  const foot = useFoot()
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
  // One of FM's template tactics, with the best XI from the first team
  const fromTemplate = useMutation({
    mutationFn: async (index: number) => {
      const t = templateTactic(
        FM_TEMPLATES[index],
        config.tacticalStyles,
        config.roles,
        config.fmCodes,
      )
      const squad = (players ?? []).filter((p) => p.in_squad && !p.extra.team)
      const ctx = {
        roles: config.roles,
        weights: config.roleWeights,
        fmCodes: config.fmCodes,
        foot,
      }
      const xi = bestXi(t.slots, squad, ctx, new Set())
      return saveTactic(career.id, null, {
        name: t.name,
        style: t.style,
        mentality: t.mentality,
        slots: t.slots.map((s, i) => ({ ...s, player: xi[i] })),
        instructions: { team: t.team },
      })
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tactics'] })
      setSelected(t.id)
    },
  })
  const learnVersion = useLearnFileVersion()
  const [versionNote, setVersionNote] = useState<string | null>(null)
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!/\.fmf$/i.test(file.name)) throw new Error('Choose an FM tactic file (.fmf).')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const t = await readFmf(bytes, unzstd)
      setVersionNote(await learnVersion(bytes))
      const read = fromSave(t, config.roles, config.fmCodes)
      const squad = (players ?? []).filter((p) => p.in_squad && !p.extra.team)
      const ctx = {
        roles: config.roles,
        weights: config.roleWeights,
        fmCodes: config.fmCodes,
        foot,
      }
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
        <Link
          to="/tactics/assistant"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent px-3 text-sm font-semibold text-accent hover:bg-accent/10"
        >
          <Wand2 className="size-4" aria-hidden /> Build with assistant
        </Link>
        <select
          aria-label="New tactic from an FM template"
          value=""
          disabled={fromTemplate.isPending}
          onChange={(e) => e.target.value && fromTemplate.mutate(Number(e.target.value))}
          className="min-h-11 max-w-full rounded-lg border border-border bg-surface-2 px-3 text-sm font-semibold"
        >
          <option value="">{fromTemplate.isPending ? 'Creating…' : 'From FM template…'}</option>
          {config.tacticalStyles
            .filter((st) => FM_TEMPLATES.some((t) => t.style === st.code))
            .map((st) => (
              <optgroup key={st.code} label={st.name}>
                {FM_TEMPLATES.map((t, i) =>
                  t.style === st.code ? (
                    <option key={i} value={i}>
                      {st.name}: {t.label}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
        </select>
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
        <ErrorText error={upload.error ?? fromTemplate.error} />
        {versionNote && (
          <p className="w-full rounded-lg border border-sky-400/50 bg-sky-400/10 p-2 text-sm text-sky-200">
            {versionNote}
          </p>
        )}
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

/**
 * A drop-down with a clear (×) button inside the box, shown while something is picked.
 */
function ClearableSelect({
  value,
  onChange,
  label,
  className,
  children,
}: {
  value: string
  onChange: (v: string | null) => void
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={clsx('relative min-w-0', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className={clsx(field, value && 'pr-16')}
      >
        {children}
      </select>
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          title="Clear"
          onClick={() => onChange(null)}
          className="absolute top-1/2 right-8 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-bg/60 hover:text-text"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Which sections of the tactic page are open, kept in this browser. */
const OPEN_KEY = 'pfm.tactics.open'

function TacticEditor({ tactic }: { tactic: TacticRow }) {
  const foot = useFoot()
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
  // FM's style: picking one sets its mentality and instructions; changing them makes it "Custom"
  const style = styleOf(form.style, config.tacticalStyles)
  // No style picked is FM's Clean Slate
  const cleanSlate = config.tacticalStyles.find((x) => x.code === 'NULL') ?? null
  const styleNow = style ? styleText(style, form.mentality, team) : form.style
  const pickStyle = (code: string) => {
    const s = config.tacticalStyles.find((x) => x.code === code && x.code !== '')
    // Clean Slate is no style: FM stores no style name, mentality Balanced, no instructions set
    if (!s || s.code === 'NULL')
      return setForm({
        ...form,
        style: null,
        mentality: s?.mentality ?? form.mentality,
        instructions: { ...form.instructions, team: defaultTeamCodes(config.teamInstructions) },
      })
    setForm({
      ...form,
      style: s.name,
      mentality: s.mentality,
      instructions: {
        ...form.instructions,
        team: s.team ?? defaultTeamCodes(config.teamInstructions),
      },
    })
  }
  const save = useMutation({
    mutationFn: () =>
      saveTactic(career.id, tactic.id, {
        name: form.name,
        style: styleNow,
        mentality: form.mentality,
        slots: form.slots,
        instructions: { team },
        notes: form.notes,
      }),
    onSuccess: done,
  })
  const problems = exportProblems({ ...form, instructions: { team } }, config)
  const download = () => {
    const bytes = tacticFile({ ...form, style: styleNow, instructions: { team } }, config)
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
  // A copy of the tactic as it is on screen, as a new tactic of your own (imports leave it alone)
  const [, setSelected] = useUrlState<string | null>('tactic', null)
  const copy = useMutation({
    mutationFn: () =>
      saveTactic(career.id, null, {
        name: `${form.name} (copy)`,
        style: styleNow,
        mentality: form.mentality,
        slots: form.slots,
        instructions: { team },
        notes: form.notes,
      }),
    onSuccess: async (t) => {
      await done()
      setSelected(t.id)
    },
  })

  const setSlot = (i: number, patch: Partial<TacticSlot>) => {
    const { player, ...rest } = patch
    const slots = 'player' in patch ? withPlayer(form.slots, i, player ?? null) : form.slots
    setForm({ ...form, slots: slots.map((s, j) => (j === i ? { ...s, ...rest } : s)) })
  }
  /**
   * Dropping a player on another. In possession: the two players swap (positions and roles stay
   * with the slots, so each also takes the other's out-of-possession place). Out of possession:
   * only their out-of-possession places swap, so each keeps his in-possession place.
   */
  const swap = (a: number, b: number) => {
    if (a === b) return
    if (phase === 'oop')
      return setForm({ ...form, slots: swapPlaces(form.slots, a, b, 'oop', config.fmCodes) })
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
  /** Moves a slot to a free FM position in this phase (FM's drag on the pitch). */
  const move = (i: number, to: FmPosition) => {
    if (i === 0) return
    setForm({
      ...form,
      slots: moveSlot(
        form.slots,
        i,
        to,
        phase,
        config.fmCodes,
        config.roles,
        (p) => POSITION_TEXT[p],
      ),
    })
  }
  const rolesFor = (i: number) =>
    rolesAt(config.roles, phase, atFm[i], shape, (p) => POSITION_TEXT[p])
  const used = new Set(form.slots.map((s) => s.player).filter(Boolean))

  // Squad fit of the XI as set, and of the best XI (shown on the pitch corners)
  const fitCtx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes, foot }
  const fitNow = gradeTactic(form.slots, squad, fitCtx).team
  const bestPick = bestXi(form.slots, squad, fitCtx, locked)
  const fitBest = gradeTactic(
    form.slots.map((s, i) => ({ ...s, player: bestPick[i] })),
    squad,
    fitCtx,
  ).team
  const [open, setOpenRaw] = useState(() => {
    const start = { tactic: true, instr: true, brief: false, fit: false }
    try {
      return { ...start, ...JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') }
    } catch {
      return start
    }
  })
  const setOpen = (next: typeof open) => {
    setOpenRaw(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      // Not kept: private window or blocked storage
    }
  }
  const rightRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useUrlState<'team' | 'player'>('panel', 'team', TEXT as never)
  const [piSlot, setPiSlot] = useState(0)

  return (
    <div className="grid gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <Card className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
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
          <div className="absolute inset-x-[20%] top-0 h-[12%] border-x border-b border-emerald-800/50" />
          <div className="absolute inset-x-[20%] bottom-0 h-[12%] border-x border-t border-emerald-800/50" />
          <div className="absolute inset-x-0 top-1/2 border-t border-emerald-800/50" />
          {/* FM's free spots: drop a player here, or tap one after picking a player */}
          {config.fmCodes.positions
            .filter((f) => FM_GRID[f.id] && f.id !== 'GK' && !atFm.some((a) => a?.id === f.id))
            .map((f) => {
              const { x, y } = gridPlace(f.id)!
              const can = dragFrom !== null ? dragFrom !== 0 : active !== null && active !== 0
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Move to ${f.id}`}
                  disabled={!can}
                  onDragOver={(e) => dragFrom !== null && dragFrom !== 0 && e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) move(dragFrom, f)
                    setDragFrom(null)
                  }}
                  onClick={() => active !== null && move(active, f)}
                  style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
                  className={clsx(
                    'absolute grid h-[7%] w-[17%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border border-dashed text-xs transition-opacity',
                    can
                      ? 'border-emerald-400/70 text-emerald-300 hover:bg-emerald-400/15'
                      : 'border-emerald-800/50 text-transparent opacity-40',
                  )}
                >
                  {f.id}
                </button>
              )
            })}
          {form.slots.map((s, i) => {
            const p = playerOf(s)
            const role = roleOf(s)
            const score = p && role ? roleScore(p.attributes, role, config.roleWeights) : null
            const { x, y } = gridPlace(atFm[i]?.id) ?? places[i]
            return (
              <button
                key={i}
                type="button"
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null) swap(dragFrom, i)
                  setDragFrom(null)
                }}
                onClick={() => {
                  setActive(active === i ? null : i)
                  // On a phone the panel is under the pitch: bring it into view
                  if (active !== i && window.matchMedia('(max-width: 1023px)').matches)
                    window.setTimeout(
                      () =>
                        rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                      50,
                    )
                  setPiSlot(i)
                }}
                style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
                className={clsx(
                  'absolute z-[1] w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface/95 px-1 py-1 text-center leading-tight shadow',
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
                <span
                  className={clsx(
                    'block truncate border-t border-border/60 text-[9px]',
                    backupProblems(s, form.slots, squad).length ? 'text-amber-300' : 'text-muted',
                  )}
                  title="Replacements"
                >
                  ↳{' '}
                  {backupsOf(s)
                    .filter(Boolean)
                    .map((id) => {
                      const b = squad.find((x) => x.id === id)
                      return b ? shortName(b) : '?'
                    })
                    .join(', ') || '–'}
                </span>
              </button>
            )
          })}
          <PitchScore className="bottom-1.5 left-1.5" label="Squad fit" value={fitNow} />
          <PitchScore className="right-1.5 bottom-1.5" label="Best XI" value={fitBest} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              const ctx = {
                roles: config.roles,
                weights: config.roleWeights,
                fmCodes: config.fmCodes,
              }
              const picks = suggestBackups(form.slots, squad, ctx, (p) => !injured(p))
              setForm({ ...form, slots: form.slots.map((s, i) => ({ ...s, backups: picks[i] })) })
            }}
          >
            <Wand2 className="size-4" aria-hidden /> Fill empty replacements
          </Button>
          <span className="text-xs text-muted">
            ↳ under each player: his 1st and 2nd replacement (tap him to change them)
          </span>
        </div>
        <p className="text-center text-xs text-muted">
          {phase === 'ip' ? 'In possession' : 'Out of possession'}:{' '}
          {formation || formationLabel(positions)} · drag a player to a free spot to move him (or
          tap him, then the spot); drag onto another player to swap{' '}
          {phase === 'ip' ? 'the two players' : 'their out-of-possession places only'}
        </p>
      </Card>

      <div ref={rightRef} className="grid min-w-0 scroll-mt-4 content-start gap-4">
        {active !== null && form.slots[active] ? (
          <PositionPopup
            key={`${active}-${phase}`}
            slot={form.slots[active]}
            phase={phase}
            roles={rolesFor(active)}
            fmPosition={atFm[active]}
            squad={squad}
            used={used}
            spots={config.fmCodes.positions
              .filter((f) => FM_GRID[f.id] && (active === 0) === (f.id === 'GK'))
              .map((f) => {
                const k = atFm.findIndex((a) => a?.id === f.id)
                const who = k >= 0 ? playerOf(form.slots[k]) : null
                return { id: f.id, taken: k < 0 ? null : who ? shortName(who) : f.id }
              })}
            onPlace={(id) => {
              const k = atFm.findIndex((a) => a?.id === id)
              if (k === active) return
              if (k >= 0) return swap(active, k)
              const f = config.fmCodes.positions.find((x) => x.id === id)
              if (f) move(active, f)
            }}
            onChange={(patch) => setSlot(active, patch)}
            onClose={() => setActive(null)}
            slots={form.slots}
            index={active}
            replacements={
              <BackupPicker
                index={active}
                slots={form.slots}
                squad={squad}
                onChange={(backups) => setSlot(active, { backups })}
              />
            }
          />
        ) : (
          <>
            <Section
              title={`Tactic · ${form.name}`}
              open={open.tactic}
              onToggle={() => setOpen({ ...open, tactic: !open.tactic })}
            >
              <div className="grid items-start gap-2 sm:grid-cols-2">
                <input
                  aria-label="Name"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={field}
                  title={
                    tactic.save_index !== null
                      ? 'From your save: every import brings in its shape, roles and instructions as they are in FM. Your preferred XI, replacements and notes stay.'
                      : undefined
                  }
                />
                <ComplexityInfo slots={form.slots} team={team} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid min-w-0 gap-0.5 text-xs">
                  <span className="text-muted">Style</span>
                  <select
                    value={style?.code ?? (form.style ? '' : 'NULL')}
                    onChange={(e) => pickStyle(e.target.value)}
                    className={field}
                  >
                    {/* A style name from a file that is none of FM's styles */}
                    {form.style && !style && <option value="">{form.style}</option>}
                    {config.tacticalStyles.map((x) => (
                      <option key={x.code + x.name} value={x.code}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-0.5 text-xs">
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
                <label className="grid min-w-0 gap-0.5 text-xs">
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
              </div>
              {form.mentality && (
                <FmAboutLine about={config.fmCodes.mentalityTexts[form.mentality]} />
              )}
              {style ? (
                <StyleInfo style={style} current={styleNow} slots={form.slots} />
              ) : (
                !form.style &&
                cleanSlate && (
                  <StyleInfo style={cleanSlate} current={cleanSlate.name} slots={form.slots} />
                )
              )}
              <textarea
                aria-label="Notes"
                placeholder="Notes"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={Math.min(6, Math.max(1, (form.notes ?? '').split('\n').length))}
                className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base md:text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={download}
                  disabled={problems.length > 0}
                  title="Save the file in FM's tactics folder, then in FM choose Load Tactic"
                >
                  <Download className="size-4" aria-hidden /> Export .fmf
                </Button>
                <Button variant="ghost" onClick={() => copy.mutate()} disabled={copy.isPending}>
                  <Copy className="size-4" aria-hidden /> {copy.isPending ? 'Copying…' : 'Copy'}
                </Button>
                <Button variant="ghost" onClick={() => setForm(tactic)} disabled={!dirty}>
                  <Undo2 className="size-4" aria-hidden /> Undo changes
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
                <ErrorText error={save.error ?? remove.error ?? copy.error} />
              </div>
              {problems.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-300">
                  <li className="-ml-5 list-none font-semibold">Export needs:</li>
                  {problems.slice(0, 6).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {problems.length > 6 && <li>and {problems.length - 6} more</li>}
                </ul>
              )}
            </Section>
            <Section
              title="Instructions"
              open={open.instr}
              onToggle={() => setOpen({ ...open, instr: !open.instr })}
            >
              <div className="flex flex-wrap items-center gap-2" role="tablist">
                {(
                  [
                    ['team', 'Team instructions'],
                    ['player', 'Player instructions'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={panel === k}
                    onClick={() => setPanel(k)}
                    className={clsx(
                      'min-h-9 rounded-md px-3 text-xs font-bold tracking-wide uppercase',
                      panel === k
                        ? 'bg-text text-bg'
                        : 'border border-border text-muted hover:text-text',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted">
                  {phase === 'ip' ? 'In possession' : 'Out of possession'} (switch above the pitch)
                </span>
              </div>
              {panel === 'team' ? (
                <InstructionsEditor phase={phase} codes={team} onChange={setTeam} />
              ) : (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-1.5" aria-label="Position">
                    {inFmPositionOrder(atFm).map((i) => {
                      const p = playerOf(form.slots[i])
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={piSlot === i}
                          onClick={() => setPiSlot(i)}
                          className={clsx(
                            'min-h-9 rounded-md border px-2 text-xs',
                            piSlot === i
                              ? 'border-accent bg-accent/10 text-text'
                              : 'border-border text-muted hover:text-text',
                          )}
                        >
                          <span className="font-semibold">
                            {atFm[i]?.id ?? positions[i] ?? '?'}
                          </span>{' '}
                          {p ? shortName(p) : '–'}
                        </button>
                      )
                    })}
                  </div>
                  {form.slots[piSlot] && (
                    <PlayerInstructions
                      key={`${piSlot}-${phase}`}
                      slot={form.slots[piSlot]}
                      phase={phase}
                      role={
                        rolesFor(piSlot).find(
                          (r) => r.id === roleIdOf(form.slots[piSlot], phase),
                        ) ?? null
                      }
                      fmPosition={atFm[piSlot]}
                      onChange={(patch) => setSlot(piSlot, patch)}
                    />
                  )}
                </div>
              )}
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
          </>
        )}
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

/** FM's description of the role and its tags (tap a tag for what it means). */
function RoleAbout({ role }: { role: RoleDef }) {
  const config = useConfig()
  const [tag, setTag] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <div className="grid gap-1.5 text-xs">
      {!!role.tags?.length && (
        <div className="flex flex-wrap gap-1">
          {role.tags
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className={clsx(
                  'min-h-7 rounded-full border px-2.5',
                  tag === t ? 'border-accent text-accent' : 'border-border text-muted',
                )}
              >
                {t}
              </button>
            ))}
        </div>
      )}
      {tag && config.fmCodes.roleTags[tag] && (
        <p className="rounded-lg bg-surface-2/60 p-2 text-muted">{config.fmCodes.roleTags[tag]}</p>
      )}
      {role.about && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={clsx('text-left text-muted hover:text-text', !open && 'line-clamp-2')}
        >
          {role.about}
        </button>
      )}
    </div>
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
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={clsx(
              'size-4 shrink-0 text-muted transition-transform',
              !open && '-rotate-90',
            )}
            aria-hidden
          />
          <h2 className="truncate font-semibold">{title}</h2>
        </button>
        {aside}
      </div>
      {open && <div className="grid min-w-0 gap-3">{children}</div>}
    </Card>
  )
}

/**
 * The pop-up of a position on the pitch: its player, then two tabs, Role (the roles FM offers
 * there, each with the player's fit) and Instructions (the player instructions as cards).
 */
function PositionPopup({
  slot,
  phase,
  roles,
  fmPosition,
  squad,
  used,
  spots,
  onPlace,
  onChange,
  onClose,
  replacements,
  slots,
  index,
}: {
  /** The pickers of the position's replacements. */
  replacements: ReactNode
  /** All the tactic's slots and this one's place among them (for the comparison). */
  slots: TacticSlot[]
  index: number
  slot: TacticSlot
  phase: Phase
  roles: RoleDef[]
  fmPosition: FmPosition | null
  squad: PlayerRow[]
  used: Set<string | null | undefined>
  /** FM's positions this slot can go to, with who is there now. */
  spots: { id: string; taken: string | null }[]
  /** Moves the slot to a free FM position, or swaps it with the slot at a taken one. */
  onPlace: (id: string) => void
  onChange: (patch: Partial<TacticSlot>) => void
  onClose: () => void
}) {
  const config = useConfig()
  const [tab, setTab] = useState<'role' | 'instructions' | 'players'>('role')
  const roleId = roleIdOf(slot, phase)
  const role = roles.find((r) => r.id === roleId) ?? null
  // Players able to play the position first (FM rating, Settings > Tactics), then by role fit
  const pos = posOf(slot, phase)
  const ranked = squad
    .map((p) => ({
      p,
      score: role ? roleScore(p.attributes, role, config.roleWeights) : null,
      rating: positionRating(p, pos),
      able: canPlay(p, pos, config.positionMin),
    }))
    .sort(
      (a, b) =>
        Number(b.able) - Number(a.able) ||
        (b.score ?? -1) - (a.score ?? -1) ||
        byLastName(a.p, b.p),
    )
  const current = squad.find((p) => p.id === slot.player) ?? null
  const setRole = (id: string | null) =>
    // A new role starts with FM's defaults: no player instructions set
    onChange(phase === 'ip' ? { role: id, pi: [] } : { roleOop: id, piOop: [], markOop: null })
  return (
    <div
      role="dialog"
      aria-label={`${fmPosition?.id ?? pos ?? 'Position'} ${phase === 'ip' ? 'in possession' : 'out of possession'}`}
      className="grid min-w-0 content-start gap-2 rounded-xl border border-accent/40 bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-semibold">
          {fmPosition?.id ?? (pos ? POSITION_TEXT[pos] : 'Position')}{' '}
          <span className="font-normal text-muted">
            {phase === 'ip' ? 'in possession' : 'out of possession'}
          </span>
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ClearableSelect
        label="Player"
        value={slot.player ?? ''}
        onChange={(v) => onChange({ player: v })}
      >
        <option value="">No player</option>
        {(
          [
            [`Rated ${config.positionMin}+ at ${pos ?? 'this position'}`, true],
            [`Rated under ${config.positionMin}`, false],
          ] as const
        ).map(([label, able]) => {
          const group = ranked.filter((x) => x.able === able)
          return group.length ? (
            <optgroup key={label} label={label}>
              {group.map(({ p, score, rating }) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {rating !== null ? ` · rated ${rating}` : ''}
                  {score !== null ? ` · fit ${score}` : ''}
                  {used.has(p.id) && slot.player !== p.id ? ' (in XI: swaps)' : ''}
                </option>
              ))}
            </optgroup>
          ) : null
        })}
      </ClearableSelect>
      {replacements}
      <div className="flex border-b border-border" role="tablist">
        {(
          [
            ['role', 'Role'],
            ['instructions', 'Instructions'],
            ['players', 'Players'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              'min-h-10 px-3 text-sm font-semibold',
              tab === t ? 'border-b-2 border-accent text-text' : 'text-muted hover:text-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-w-0">
        {tab === 'players' ? (
          <SlotCompare slot={slot} slots={slots} index={index} squad={squad} role={role} />
        ) : tab === 'role' ? (
          <div className="grid gap-3">
            <ul className="grid gap-1">
              {roleId && !role && (
                <li className="rounded-lg border border-amber-400/50 px-2 py-1.5 text-sm text-amber-200">
                  {config.roles.find((r) => r.id === roleId)?.name ?? '?'}: not offered here
                </li>
              )}
              {roles.map((r) => {
                const fit = current ? roleScore(current.attributes, r, config.roleWeights) : null
                const on = r.id === roleId
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRole(on ? null : r.id)}
                      className={clsx(
                        'grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm',
                        on ? 'border-accent bg-accent/10' : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <span className="text-xs font-semibold text-muted">{roleShort(r)}</span>
                      <span className="truncate">{r.name}</span>
                      {fit !== null && (
                        <span className={clsx('font-semibold tabular-nums', scoreTextColor(fit))}>
                          {fit}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {role && current && <RoleAttributes role={role} attributes={current.attributes} />}
            {role && (role.about || role.tags?.length) && <RoleAbout role={role} />}
            <RatingGuide
              role={config.roles.find((r) => r.id === slot.role) ?? null}
              complexity={role?.fm?.complexity}
            />
            <label className="grid gap-1 text-sm">
              <span className="text-muted">
                Position {phase === 'ip' ? 'in possession' : 'out of possession'} (or drag the card)
              </span>
              <select
                value={fmPosition?.id ?? ''}
                onChange={(e) => e.target.value && onPlace(e.target.value)}
                className={field}
              >
                {!fmPosition && <option value="">?</option>}
                {spots.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id}
                    {f.id === fmPosition?.id
                      ? ''
                      : f.taken
                        ? ` (${f.taken}: ${phase === 'ip' ? 'swap players' : 'swap places out of possession'})`
                        : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <PlayerInstructions
            slot={slot}
            phase={phase}
            role={role}
            fmPosition={fmPosition}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  )
}

type Phase = 'ip' | 'oop'

/**
 * Player instructions FM offers for the slot's role at its position, one card each. Those the
 * role always does, or cannot change, are locked as in FM.
 */
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
  if (!role) return <p className="text-sm text-muted">Pick a role first.</p>
  const all = defs.map((d) => ({ d, ...playerChoices(d, role, fmPosition) }))
  if (!all.some((r) => r.options.length > 1 || r.forced))
    return (
      <p className="text-xs text-muted">
        No player instructions for {role.name} here (Settings &gt; Roles sets them).
      </p>
    )
  const markTarget = all.some(({ d }) => {
    const c = chosen(d, codes)
    return c?.target === 'position' && c.code !== 0
  })
  return (
    <section className="grid gap-2">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
        {all.map(({ d, options, forced }) => {
          const locked = !forced && options.length <= 1
          // Standard (no instruction) first, then FM's options in its order
          const shown = locked
            ? d.options.filter((o) => o.code === 0).slice(0, 1)
            : [...options].sort((a, b) => Number(b.code === 0) - Number(a.code === 0))
          const value = forced ? options[0].code : (chosen(d, codes)?.code ?? 0)
          return (
            <li key={d.name}>
              <InstructionCard
                def={d}
                value={value}
                options={shown}
                disabled={forced || locked}
                note={
                  forced
                    ? `${role.name} always does this`
                    : locked
                      ? `${role.name} decides this: FM does not let you change it`
                      : undefined
                }
                onChange={(code) => set(choose(d, codes, code))}
              />
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
  // Codes no team instruction in Settings has (FM's styles set some that FM never shows)
  const hidden = codes.filter(
    (c) => !config.teamInstructions.some((d) => d.options.some((o) => o.code === c)),
  )
  return (
    <section className="grid gap-2">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
        {defs.map((d) => (
          <li key={d.name}>
            <InstructionCard
              def={d}
              value={chosen(d, codes)?.code ?? 0}
              defaultCode={d.default ?? 0}
              onChange={(code) => onChange(choose(d, codes, code))}
            />
          </li>
        ))}
      </ul>
      {conflicts.map((c) => (
        <p key={c} className="text-xs text-amber-300">
          FM does not allow {c} together.
        </p>
      ))}
      {phase === 'ip' && hidden.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>
            Also carries codes no FM27 instruction screen shows (FM&apos;s styles set them and FM
            keeps them when it saves; FM27&apos;s own option table has no option for most):{' '}
            {hidden
              .map((c) => {
                const name = (config.fmCodes.hiddenTeamCodes ?? DEFAULT_FM_CODES.hiddenTeamCodes)?.[
                  String(c)
                ]
                return name ? `${name} [${c}]` : `code ${c}`
              })
              .join(', ')}
            .
          </span>
          <button
            type="button"
            onClick={() => onChange(codes.filter((c) => !hidden.includes(c)))}
            className="font-semibold text-accent"
          >
            Clear
          </button>
        </p>
      )}
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
            {inFmPositionOrder(fmPositions(slots, 'ip', config.fmCodes)).map((i) => {
              const s = slots[i]
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
                            tip.kind === 'role'
                              ? slots.map((x, j) => (j === i ? { ...x, role: tip.value } : x))
                              : withPlayer(slots, i, tip.value),
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

const injured = (p: PlayerRow) => /\bInj\b/.test(p.extra.status ?? '')

/** The slot's replacements, always BACKUP_COUNT places ('' none). */
const backupsOf = (s: TacticSlot) =>
  Array.from({ length: BACKUP_COUNT }, (_, k) => s.backups?.[k] ?? null)

/** What is wrong with a slot's replacements (injured, already starting, covering too much…). */
function backupProblems(slot: TacticSlot, slots: TacticSlot[], squad: PlayerRow[]): string[] {
  const byId = new Map(squad.map((p) => [p.id, p]))
  const xi = new Set(slots.map((s) => s.player).filter(Boolean))
  const covers = new Map<string, number>()
  for (const s of slots)
    for (const b of backupsOf(s)) if (b) covers.set(b, (covers.get(b) ?? 0) + 1)
  const out: string[] = []
  const backups = backupsOf(slot)
  for (const b of backups) {
    if (!b) continue
    const p = byId.get(b)
    if (!p) {
      out.push('a replacement is not in the squad list')
      continue
    }
    if (injured(p)) out.push(`${shortName(p)} is injured`)
    if (xi.has(b)) out.push(`${shortName(p)} already starts`)
    if ((covers.get(b) ?? 0) > 2) out.push(`${shortName(p)} covers ${covers.get(b)} positions`)
  }
  if (backups[0] && backups[0] === backups[1]) out.push('same player twice')
  return [...new Set(out)]
}

/** Colours of the starter, 1st and 2nd replacement in the comparison. */
const SLOT_COLOURS = ['#4aa3ff', '#f5a623', '#c084fc']

/**
 * The position's starter and his replacements side by side, laid out like FM's attribute
 * screen (Technical, Mental, Physical columns), each attribute with one value per player: the
 * best marked ▲, all the same =. The role's key and preferred attributes are marked. With only
 * a starter it is his attribute screen.
 */
function SlotCompare({
  slot,
  slots,
  index,
  squad,
  role,
}: {
  slot: TacticSlot
  slots: TacticSlot[]
  index: number
  squad: PlayerRow[]
  role: RoleDef | null
}) {
  const config = useConfig()
  const ctx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }
  const [roleOnly, setRoleOnly] = useState(false)
  const byId = new Map(squad.map((p) => [p.id, p]))
  const cols = [
    { label: 'Starter', id: slot.player ?? null, colour: SLOT_COLOURS[0] },
    ...backupsOf(slots[index] ?? slot).map((id, k) => ({
      label: k === 0 ? '1st' : '2nd',
      id,
      colour: SLOT_COLOURS[k + 1],
    })),
  ]
    .map((c) => ({ ...c, p: c.id ? (byId.get(c.id) ?? null) : null }))
    .filter((c): c is typeof c & { p: PlayerRow } => !!c.p)
  if (!cols.length)
    return <p className="text-sm text-muted">Pick a player or a replacement to see them here.</p>
  const many = cols.length > 1
  const key = new Set(role?.key ?? [])
  const pref = new Set(role?.preferred ?? [])
  const columns = PROFILE_COLUMNS[slot.position === 'GK' ? 'goalkeepers' : 'outfield']
    .map((col) =>
      col
        .filter((x) => x.label !== 'Hidden')
        .map((x) => ({
          ...x,
          attributes: roleOnly
            ? x.attributes.filter((a) => key.has(a) || pref.has(a))
            : x.attributes,
        }))
        .filter((x) => x.attributes.length),
    )
    .filter((col) => col.length)
  const grid = { gridTemplateColumns: `minmax(0,1fr) repeat(${cols.length}, 2.6rem)` }
  const abbr = (a: string) => ATTRIBUTE_INFO[a]?.abbr ?? attributeLabel(config, a).slice(0, 3)
  const cell = (a: string) => {
    const vals = cols.map((c) => attrNumber(c.p.attributes[a]))
    const known = vals.filter((v): v is number => v !== null)
    const top = known.length ? Math.max(...known) : null
    const same = many && known.length === cols.length && known.every((v) => v === known[0])
    const unique = many && !same && top !== null && known.filter((v) => v === top).length === 1
    return cols.map((c, k) => ({
      text: formatAttr(c.p.attributes[a]),
      colour: attrColor(c.p.attributes[a]),
      best: unique && vals[k] === top,
      same,
    }))
  }
  const pos = slot.position
  return (
    <div className="grid gap-3">
      {/* Who is in which column, with fit and FM rating at the position */}
      <ul className="grid gap-1">
        {cols.map((c) => {
          const fit = slotScore(c.p, slot, ctx)
          const rated = positionRating(c.p, pos)
          return (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.colour }}
              />
              <span className="w-12 shrink-0 text-xs text-muted">{c.label}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{c.p.name}</span>
              <span className="text-xs text-muted">
                {rated !== null ? `rated ${rated}` : playsPosition(c.p, pos) ? 'plays here' : ''}
              </span>
              <span
                className={clsx(
                  'w-8 text-right font-semibold tabular-nums',
                  fit !== null && scoreTextColor(fit),
                )}
                title="Fit for this slot (0–100)"
              >
                {fit ?? '–'}
              </span>
            </li>
          )
        })}
      </ul>
      {role && (
        <label className="flex min-h-9 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={roleOnly}
            onChange={(e) => setRoleOnly(e.target.checked)}
          />
          Only {roleShort(role)} key and preferred attributes
        </label>
      )}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {columns.map((col, ci) => (
          <div key={ci} className="grid content-start gap-3">
            {col.map((sec) => (
              <div key={sec.label} className="grid content-start">
                <div
                  className="grid items-end gap-x-1 border-b border-border pb-1 text-xs"
                  style={grid}
                >
                  <span className="font-semibold tracking-wide text-muted uppercase">
                    {sec.label}
                  </span>
                  {many &&
                    cols.map((c) => (
                      <span key={c.label} className="flex justify-end" title={c.p.name}>
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: c.colour }}
                        />
                      </span>
                    ))}
                </div>
                {sec.attributes.map((a) => (
                  <div
                    key={a}
                    className={clsx(
                      'grid items-center gap-x-1 border-b border-border/30 py-0.5 pl-1.5 text-sm',
                      key.has(a) ? KEY_ROW : pref.has(a) && PREFERRED_ROW,
                    )}
                    style={grid}
                  >
                    <span className="truncate" title={attributeLabel(config, a)}>
                      {/* Full names when one player fits, short ones beside others */}
                      <span className={clsx(many && 'sm:hidden')}>{attributeLabel(config, a)}</span>
                      {many && <span className="hidden sm:inline">{abbr(a)}</span>}
                    </span>
                    {cell(a).map((v, k) => (
                      <span
                        key={k}
                        className={clsx(
                          'text-right whitespace-nowrap tabular-nums',
                          v.colour,
                          v.best && 'font-bold',
                        )}
                      >
                        {v.text}
                        {many && (
                          <span
                            className="inline-block w-2.5 text-center text-[10px] text-muted"
                            aria-label={v.best ? 'best' : v.same ? 'all the same' : undefined}
                          >
                            {v.best ? '▲' : v.same ? '=' : ''}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Green rows: the role&apos;s key attributes; blue: preferred. ▲ the best of the players
        shown, = all the same.
      </p>
    </div>
  )
}

/** The 1st and 2nd replacement of a position, in its pop-up on the pitch. */
function BackupPicker({
  index,
  slots,
  squad,
  onChange,
}: {
  index: number
  slots: TacticSlot[]
  squad: PlayerRow[]
  onChange: (backups: (string | null)[]) => void
}) {
  const config = useConfig()
  const ctx = { roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }
  const slot = slots[index]
  const xi = new Set(slots.map((s) => s.player).filter(Boolean))
  const backups = backupsOf(slot)
  const byId = new Map(squad.map((p) => [p.id, p]))
  // Players who can play here first, best fit first
  const options = squad
    .filter((p) => p.id !== slot.player)
    .map((p) => ({ p, score: slotScore(p, slot, ctx), plays: playsPosition(p, slot.position) }))
    .sort((a, b) => Number(b.plays) - Number(a.plays) || (b.score ?? -1) - (a.score ?? -1))
  const label = (o: (typeof options)[number]) =>
    `${shortName(o.p)} · ${o.score ?? '–'}${injured(o.p) ? ' · injured' : ''}${xi.has(o.p.id) ? ' · starts' : ''}`
  const suggest = () => {
    const cleared = slots.map((s, j) => (j === index ? { ...s, backups: [] } : s))
    onChange(suggestBackups(cleared, squad, ctx, (p) => !injured(p))[index])
  }
  const problems = backupProblems(slot, slots, squad)
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-1">
        <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2">
          {backups.map((b, k) => (
            <ClearableSelect
              key={k}
              label={`${k === 0 ? '1st' : '2nd'} replacement`}
              value={b ?? ''}
              onChange={(v) => onChange(backups.map((x, j) => (j === k ? v : x)))}
            >
              <option value="">{k === 0 ? '1st replacement' : '2nd replacement'}</option>
              {b && !byId.has(b) && <option value={b}>(not in the list)</option>}
              <optgroup label="Plays the position">
                {options
                  .filter((o) => o.plays)
                  .map((o) => (
                    <option key={o.p.id} value={o.p.id}>
                      {label(o)}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Others">
                {options
                  .filter((o) => !o.plays)
                  .map((o) => (
                    <option key={o.p.id} value={o.p.id}>
                      {label(o)}
                    </option>
                  ))}
              </optgroup>
            </ClearableSelect>
          ))}
        </div>
        <button
          type="button"
          onClick={suggest}
          title="Suggest replacements"
          aria-label="Suggest replacements"
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-text"
        >
          <Wand2 className="size-4" aria-hidden />
        </button>
      </div>
      {problems.length > 0 && <p className="text-xs text-amber-300">{problems.join(' · ')}</p>}
    </div>
  )
}

/** FM's description of a tactical style, and whether the tactic still matches it. */
function StyleInfo({
  style,
  current,
  slots,
}: {
  style: TacticalStyle
  current: string | null
  slots: TacticSlot[]
}) {
  const config = useConfig()
  const [open, setOpen] = useState(false)
  // FM's preferred roles for the style, and which the tactic uses
  const used = new Set(slots.flatMap((s) => [s.role, s.roleOop]).filter(Boolean))
  const preferred = matchRoles(style, config.roles)
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-surface-2/50 px-2 text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-[2.6rem] items-center gap-1 text-left"
      >
        <span className="font-semibold">{current ?? style.name}</span>
        {style.summary.length > 0 && (
          <span className="min-w-0 flex-1 truncate text-muted">· {style.summary.join(' · ')}</span>
        )}
        <ChevronDown
          className={clsx('size-3.5 shrink-0 text-muted', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      {current !== style.name && (
        <p className="text-amber-300">
          Mentality or instructions changed from FM&apos;s {style.name}: FM calls it {current}.
        </p>
      )}
      {open && (
        <>
          {style.about && <p>{style.about}</p>}
          {style.features.length > 0 && (
            <p>
              <span className="text-muted">Features of play: </span>
              {style.features.join(', ')}
            </p>
          )}
          {style.favoured.length > 0 && (
            <p>
              <span className="text-muted">Favoured attributes: </span>
              {style.favoured.join(', ')}
            </p>
          )}
          {preferred.length > 0 && (
            <div>
              <span className="text-muted">Preferred roles (FM&apos;s style data): </span>
              <ul className="mt-0.5 flex flex-wrap gap-1">
                {preferred.map((p) => {
                  const inUse = p.roles.some((r) => used.has(r.id))
                  return (
                    <li
                      key={p.name}
                      title={
                        p.roles.length
                          ? inUse
                            ? 'Used in this tactic'
                            : 'Not used in this tactic'
                          : 'A role from older FMs: FM27 has no role of this name'
                      }
                      className={clsx(
                        'rounded-full border px-2 py-0.5',
                        inUse
                          ? 'border-accent bg-accent/15 text-accent'
                          : p.roles.length
                            ? 'border-border'
                            : 'border-dashed border-border text-muted',
                      )}
                    >
                      {inUse && '✓ '}
                      {p.name}
                    </li>
                  )
                })}
              </ul>
              {preferred.some((p) => !p.roles.length) && (
                <p className="mt-0.5 text-muted">
                  Dashed: names from older FMs that FM27 has no role for.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** FM's complexity points for the tactic, with what costs most. */
function ComplexityInfo({ slots, team }: { slots: TacticSlot[]; team: number[] }) {
  const config = useConfig()
  const [open, setOpen] = useState(false)
  const c = tacticComplexity(slots, team, config)
  const heavy = c.players.flatMap((p) => p.items.filter((x) => x.points >= 3)).map((x) => x.label)
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-surface-2/50 px-2 text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-[2.6rem] items-center gap-1 text-left"
      >
        <span className="font-semibold">Complexity</span>
        <span className="min-w-0 flex-1 truncate text-muted">
          · team {c.team.points}/{c.team.max} · players {c.playerAverage.toFixed(1)}/{c.playerMax}{' '}
          on average
        </span>
        <ChevronDown
          className={clsx('size-3.5 shrink-0 text-muted', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      {heavy.length > 0 && (
        <p className="pb-1.5 text-amber-300">
          Hardest to learn: {[...new Set(heavy)].join(', ')} (3 points each).
        </p>
      )}
      {open && (
        <>
          <p className="text-muted">
            FM&apos;s points from its match data: more points take longer for the squad to learn.
            FM&apos;s own badge also weighs your players and the opponent.
          </p>
          <ul className="grid gap-0.5">
            {[...c.team.items]
              .sort((a, b) => b.points - a.points)
              .map((x) => (
                <li key={x.label} className="flex justify-between gap-2">
                  <span>{x.label}</span>
                  <span className="tabular-nums">{x.points}</span>
                </li>
              ))}
          </ul>
          <ul className="grid gap-0.5 border-t border-border pt-1">
            {c.players.map((p) => (
              <li key={p.slot} className="flex justify-between gap-2">
                <span className="truncate">
                  {slots[p.slot].position ?? '?'}: {p.items.map((x) => x.label).join(', ') || '–'}
                </span>
                <span className="tabular-nums">{p.points}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const SKIP_RATING = /^(Shootout|90min|Team Goals)/

/** How FM's match ratings reward and punish a role (FM's match data). */
function RatingGuide({ role, complexity }: { role: RoleDef | null; complexity?: number }) {
  const config = useConfig()
  const [open, setOpen] = useState(false)
  const set = ratingSet(role, config.matchData, config.fmCodes.roleCodeMask)
  if (!set && complexity === undefined) return null
  const items = (set ?? []).filter(([n, v]) => v !== 0 && !SKIP_RATING.test(n))
  const up = items.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const down = items.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(v % 10 ? 3 : 2)}`
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-surface-2/50 px-2 text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-[2.6rem] items-center gap-1 text-left"
      >
        <span className="font-semibold">How FM rates {role?.name ?? 'this role'}</span>
        {complexity !== undefined && <span className="text-muted">· complexity {complexity}</span>}
        <ChevronDown
          className={clsx('ml-auto size-3.5 shrink-0 text-muted', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      {open && set && (
        <>
          <p className="text-muted">
            Every player starts the match at {(config.matchData.ratings.start / 1000).toFixed(1)};
            each event below moves the rating (FM&apos;s match data, by in-possession role).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ul className="grid content-start gap-0.5">
              {up.map(([n, v]) => (
                <li key={n} className="flex justify-between gap-2">
                  <span>{n}</span>
                  <span className="text-emerald-400 tabular-nums">{fmt(v)}</span>
                </li>
              ))}
            </ul>
            <ul className="grid content-start gap-0.5">
              {down.map(([n, v]) => (
                <li key={n} className="flex justify-between gap-2">
                  <span>{n}</span>
                  <span className="text-red-400 tabular-nums">{fmt(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {open && !set && (
        <p className="text-muted">FM&apos;s rating data has no entry for this role.</p>
      )}
    </div>
  )
}
