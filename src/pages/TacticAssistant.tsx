import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { saveTactic } from '../data/api'
import type { PlayerRow } from '../data/db'
import { usePlayers } from '../data/hooks'
import { scoreTextColor } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { gradeTactic, playsPosition, slotScore, type FitContext } from '../tactics/analysis'
import {
  adjustments,
  firstTeam,
  shapeOptions,
  slotPosition,
  styleFits,
  type ShapeOption,
} from '../tactics/assistant'
import { POSITION_TEXT, formationLabel } from '../tactics/positions'
import { matchRoles, type TacticalStyle } from '../tactics/styles'
import type { TacticSlot } from '../tactics/types'

type Step = 'style' | 'shape' | 'roles' | 'instructions' | 'save'
const STEPS: [Step, string][] = [
  ['style', 'Style'],
  ['shape', 'Shape'],
  ['roles', 'Players and roles'],
  ['instructions', 'Team instructions'],
  ['save', 'Save'],
]
const field = 'min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm'
const Tag = ({ fm }: { fm: boolean }) => (
  <span
    className={clsx(
      'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
      fm ? 'bg-accent/15 text-accent' : 'bg-amber-400/15 text-amber-300',
    )}
  >
    {fm ? 'FM27 data' : 'Rule of thumb'}
  </span>
)

/** Tactic assistant: style, shape, players and roles, team instructions, then a new tactic. */
export function TacticAssistant() {
  const career = useCurrentCareer()
  const config = useConfig()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: players, isPending } = usePlayers(career.id)
  const squad = useMemo(() => firstTeam(players ?? []), [players])
  const ctx: FitContext = useMemo(
    () => ({ roles: config.roles, weights: config.roleWeights, fmCodes: config.fmCodes }),
    [config],
  )
  const [step, setStep] = useState<Step>('style')
  const [style, setStyle] = useState<TacticalStyle | null>(null)
  const [shape, setShape] = useState<ShapeOption | null>(null)
  const [slots, setSlots] = useState<TacticSlot[]>([])
  const [team, setTeam] = useState<number[]>([])
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fits = useMemo(() => styleFits(config.tacticalStyles, squad), [config, squad])
  const shapes = useMemo(
    () =>
      style
        ? shapeOptions(style, config.tacticalStyles, squad, config.roles, config.fmCodes, ctx)
        : [],
    [style, config, squad, ctx],
  )
  const preferred = useMemo(
    () =>
      new Set(
        style
          ? matchRoles(style, config.roles)
              .flatMap((m) => m.roles)
              .map((r) => r.id)
          : [],
      ),
    [style, config.roles],
  )
  const grade = useMemo(() => gradeTactic(slots, squad, ctx), [slots, squad, ctx])
  const suggested = useMemo(
    () => adjustments(slots, squad, team, config.teamInstructions, config.tacticRules),
    [slots, squad, team, config],
  )

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (!squad.length)
    return <Placeholder>Import your save first: the assistant builds from your squad.</Placeholder>

  const pickShape = (o: ShapeOption) => {
    setShape(o)
    setSlots(o.slots)
    setTeam(o.team)
    setApplied(new Set())
    setName(o.name)
    setStep('roles')
  }
  const setSlot = (i: number, patch: Partial<TacticSlot>) =>
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const playerName = (id: string | null | undefined) => squad.find((p) => p.id === id)?.name

  const save = async () => {
    if (!shape) return
    setSaving(true)
    setError(null)
    try {
      const t = await saveTactic(career.id, null, {
        name: name.trim() || shape.name,
        style: shape.styleText,
        mentality: shape.mentality,
        slots,
        instructions: { team },
        notes: `Built with the tactic assistant from FM's template ${shape.template.label}.`,
      })
      await qc.invalidateQueries({ queryKey: ['tactics', career.id] })
      navigate(`/tactics?tactic=${t.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const stepIndex = STEPS.findIndex(([s]) => s === step)
  return (
    <>
      <Link
        to="/tactics"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tactics
      </Link>
      <PageHeader
        title="Tactic assistant"
        subtitle="Builds a tactic for your squad from FM27's own styles and template tactics, then adjusts it to your players. Everything stays editable afterwards on the Tactics page."
      />
      <ol className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {STEPS.map(([s, label], i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > stepIndex}
              onClick={() => setStep(s)}
              className={clsx(
                'min-h-9 rounded-full border px-3',
                s === step
                  ? 'border-accent bg-accent/15 text-accent'
                  : i < stepIndex
                    ? 'border-border text-text'
                    : 'border-border text-muted',
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 'style' && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            Which style? <Tag fm />
          </h2>
          <p className="mb-3 text-sm text-muted">
            Ranked by your squad&apos;s average (best 16 players) in the attributes FM says each
            style favours. Pick the one you want; the ranking is only a hint.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {fits.map(({ style: s, score, per }) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => (setStyle(s), setStep('shape'))}
                  className="grid w-full gap-1 rounded-xl border border-border bg-surface p-3 text-left hover:border-accent"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{s.name}</span>
                    {score !== null && (
                      <span className="tabular-nums">{Math.round(score * 10) / 10}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {per
                      .map(
                        (x) =>
                          `${x.attribute} ${x.value === null ? '–' : Math.round(x.value * 10) / 10}`,
                      )
                      .join(' · ')}
                  </span>
                  {s.summary.length > 0 && (
                    <span className="text-xs text-muted">{s.summary.join(' · ')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'shape' && style && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            Which shape? <Tag fm />
          </h2>
          <p className="mb-3 text-sm text-muted">
            FM&apos;s own {style.name} templates (shape, roles, instructions), each filled with your
            best XI. Ranked by how many players would be out of position, then by role fit.
          </p>
          <ul className="grid gap-2">
            {shapes.map((o) => (
              <li key={o.template.label}>
                <button
                  type="button"
                  onClick={() => pickShape(o)}
                  className="grid w-full gap-1 rounded-xl border border-border bg-surface p-3 text-left hover:border-accent"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{o.template.label}</span>
                    <span className="flex items-center gap-3 text-sm">
                      {o.outOfPosition > 0 && (
                        <span className="text-amber-300">{o.outOfPosition} out of position</span>
                      )}
                      {o.grade !== null && (
                        <span
                          className={clsx('font-semibold tabular-nums', scoreTextColor(o.grade))}
                        >
                          Fit {o.grade}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {o.slots
                      .map((s) => `${slotPosition(s)} ${shortName(squad, s.player)}`)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'roles' && shape && (
        <Card>
          <h2 className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
            Players and roles <Tag fm />
            {grade.team !== null && (
              <span className={clsx('ml-auto tabular-nums', scoreTextColor(grade.team))}>
                Team fit {grade.team}
              </span>
            )}
          </h2>
          <p className="mb-3 text-sm text-muted">
            FM&apos;s template roles, with your best XI. Each role list shows the player&apos;s fit;
            ★ marks the roles FM&apos;s {style?.name} style prefers.{' '}
            {formationLabel(slots.map((s) => s.position))} in possession.
          </p>
          <div className="grid gap-2">
            {slots.map((s, i) => {
              const player = squad.find((p) => p.id === s.player) ?? null
              const fit = player ? slotScore(player, s, ctx) : null
              return (
                <div
                  key={i}
                  className="grid items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3rem]"
                >
                  <span className="text-sm font-semibold">{slotPosition(s)}</span>
                  <select
                    aria-label={`Player at ${slotPosition(s)}`}
                    value={s.player ?? ''}
                    onChange={(e) => setSlot(i, { player: e.target.value || null })}
                    className={field}
                  >
                    <option value="">No player</option>
                    {[...squad]
                      .map((p) => ({
                        p,
                        sc: slotScore(p, s, ctx),
                        ok: playsPosition(p, s.position),
                      }))
                      .sort((a, b) => Number(b.ok) - Number(a.ok) || (b.sc ?? 0) - (a.sc ?? 0))
                      .map(({ p, sc, ok }) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {sc ?? '–'}
                          {ok ? '' : ' (out of position)'}
                        </option>
                      ))}
                  </select>
                  <RolePick
                    label="In possession"
                    phase="ip"
                    slot={s}
                    player={player}
                    preferred={preferred}
                    onChange={(role) => setSlot(i, { role, pi: [] })}
                  />
                  <RolePick
                    label="Out of possession"
                    phase="oop"
                    slot={s}
                    player={player}
                    preferred={preferred}
                    onChange={(roleOop) => setSlot(i, { roleOop, piOop: [] })}
                  />
                  <span
                    className={clsx(
                      'text-right font-semibold tabular-nums',
                      fit !== null && scoreTextColor(fit),
                    )}
                  >
                    {fit ?? '–'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setStep('instructions')}
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-black"
            >
              Next: team instructions
            </button>
          </div>
        </Card>
      )}

      {step === 'instructions' && shape && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">Team instructions</h2>
          <p className="mb-3 text-sm text-muted">
            The tactic starts with FM&apos;s own instructions for this template <Tag fm />. The
            rules of thumb below <Tag fm={false} /> suggest changes for your players; apply the ones
            you agree with. Switch rules off in Settings → Tactic assistant.
          </p>
          {suggested.length === 0 && applied.size === 0 ? (
            <p className="text-sm text-muted">No changes suggested for this XI.</p>
          ) : (
            <ul className="grid gap-2">
              {suggested.map((a) => (
                <li
                  key={a.rule}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {a.instruction}: {a.from} → {a.to}
                    </span>
                    <span className="block text-sm text-muted">
                      {a.rule}. {a.why}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTeam(a.apply(team))
                      setApplied(new Set([...applied, a.rule]))
                    }}
                    className="min-h-10 rounded-lg border border-accent px-3 text-sm font-semibold text-accent"
                  >
                    Apply
                  </button>
                </li>
              ))}
              {[...applied].map((r) => (
                <li key={r} className="flex items-center gap-2 text-sm text-accent">
                  <Check className="size-4" aria-hidden /> Applied: {r}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Player instructions come from FM&apos;s template for each role; change them on the
            Tactics page after saving.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setStep('save')}
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-black"
            >
              Next: save
            </button>
          </div>
        </Card>
      )}

      {step === 'save' && shape && (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Save the tactic</h2>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <p className="text-sm text-muted">
            {shape.styleText ?? style?.name} · {shape.mentality ?? 'Balanced'} ·{' '}
            {formationLabel(slots.map((s) => s.position))} · team fit {grade.team ?? '–'}
            {grade.fits.some((f) => f.outOfPosition) &&
              ` · out of position: ${grade.fits
                .filter((f) => f.outOfPosition)
                .map((f) => playerName(f.player?.id))
                .join(', ')}`}
          </p>
          <p className="text-sm text-muted">
            It opens on the Tactics page, with the briefing, best XI and FM file export.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save tactic'}
            </button>
          </div>
        </Card>
      )}
    </>
  )
}

function shortName(squad: PlayerRow[], id: string | null | undefined) {
  const p = squad.find((x) => x.id === id)
  return p ? p.name.split(' ').slice(-1)[0] : '—'
}

/** A role for the slot in one phase: roles for its position, with the player's fit. */
function RolePick({
  label,
  phase,
  slot,
  player,
  preferred,
  onChange,
}: {
  label: string
  phase: 'ip' | 'oop'
  slot: TacticSlot
  player: PlayerRow | null
  preferred: Set<string>
  onChange: (role: string | null) => void
}) {
  const config = useConfig()
  const ctx: FitContext = { roles: config.roles, weights: config.roleWeights }
  const pos = phase === 'ip' ? slot.position : (slot.positionOop ?? slot.position)
  const text = pos ? POSITION_TEXT[pos] : null
  const options = config.roles
    .filter((r) => r.phase === phase && text && r.positions.includes(text))
    .map((r) => {
      const trial: TacticSlot =
        phase === 'ip'
          ? { ...slot, role: r.id, roleOop: null }
          : { ...slot, role: null, roleOop: r.id }
      return { r, sc: player ? slotScore(player, trial, ctx) : null }
    })
    .sort((a, b) => (b.sc ?? 0) - (a.sc ?? 0))
  const value = (phase === 'ip' ? slot.role : slot.roleOop) ?? ''
  return (
    <select
      aria-label={`${label} role`}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
      className={field}
    >
      <option value="">{label}: no role</option>
      {value && !options.some((o) => o.r.id === value) && (
        <option value={value}>{config.roles.find((r) => r.id === value)?.name ?? value}</option>
      )}
      {options.map(({ r, sc }) => (
        <option key={r.id} value={r.id}>
          {preferred.has(r.id) ? '★ ' : ''}
          {r.name} · {sc ?? '–'}
        </option>
      ))}
    </select>
  )
}
