import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PickList } from '../components/PickList'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { saveTactic } from '../data/api'
import type { PlayerRow } from '../data/db'
import { roleShort } from '../data/roles'
import { usePlayers } from '../data/hooks'
import { scoreTextColor } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { shortName } from '../lib/names'
import { footLevel } from '../lib/profile'
import { gradeTactic, playsPosition, slotScore, type FitContext } from '../tactics/analysis'
import { firstTeam, slotPosition, styleFits } from '../tactics/assistant'
import {
  applyPlayers,
  applyTeam,
  buildAll,
  candidateShapes,
  playerSuggestions,
  teamSuggestions,
  type BuiltTactic,
} from '../tactics/builder'
import { defaultTeamCodes, fmPositions, rolesAt, shapeOf } from '../tactics/fm'
import { POSITION_TEXT, formationLabel } from '../tactics/positions'
import { matchRoles, styleText, type TacticalStyle } from '../tactics/styles'
import type { TacticSlot } from '../tactics/types'
import { roleWarnings } from '../tactics/warnings'

type Step = 'start' | 'shape' | 'roles' | 'team' | 'players' | 'save'
const STEPS: [Step, string][] = [
  ['start', 'Start'],
  ['shape', 'Shape'],
  ['roles', 'Players and roles'],
  ['team', 'Team instructions'],
  ['players', 'Player instructions'],
  ['save', 'Save'],
]
const field = 'min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm'
const next = 'min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-black'

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

const formationOf = (slots: TacticSlot[]) => formationLabel(slots.map((s) => s.position))

/**
 * Tactic assistant: builds tactics around the squad. Every shape is filled with the best XI
 * and the roles each player suits; team and player instructions follow from the players.
 */
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
  const [step, setStep] = useState<Step>('start')
  const [style, setStyle] = useState<TacticalStyle | null>(null)
  const [mustPlay, setMustPlay] = useState<string[]>([])
  const [built, setBuilt] = useState<BuiltTactic[] | null>(null)
  const [pick, setPick] = useState<BuiltTactic | null>(null)
  const [slots, setSlots] = useState<TacticSlot[]>([])
  const [mentality, setMentality] = useState('Balanced')
  const [offTeam, setOffTeam] = useState<Set<string>>(new Set())
  const [offPlayer, setOffPlayer] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fits = useMemo(() => styleFits(config.tacticalStyles, squad), [config, squad])
  const base = useMemo(
    () => style?.team ?? defaultTeamCodes(config.teamInstructions),
    [style, config.teamInstructions],
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
  const warnings = useMemo(
    () => roleWarnings(slots, config.roles, config.roleWarnings, config.fmCodes),
    [slots, config],
  )
  const teamTips = useMemo(
    () => teamSuggestions(slots, squad, base, config.teamInstructions, config.tacticRules),
    [slots, squad, base, config],
  )
  const feet = useMemo(
    () => (p: PlayerRow) => ({
      left: footLevel(p.left_foot, config.footWords, config.footMins)?.level ?? null,
      right: footLevel(p.right_foot, config.footWords, config.footMins)?.level ?? null,
    }),
    [config],
  )
  const playerTips = useMemo(
    () =>
      playerSuggestions(
        slots,
        squad,
        config.roles,
        config.fmCodes,
        config.playerInstructions,
        config.tacticRules,
        feet,
      ),
    [slots, squad, config, feet],
  )
  const tipKey = (t: { slot: number; instruction: string }) => `${t.slot}|${t.instruction}`

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (!squad.length)
    return <Placeholder>Import your save first: the assistant builds from your squad.</Placeholder>

  const build = () => {
    const shapes = candidateShapes(config.tacticalStyles, config.roles, config.fmCodes)
    setBuilt(
      buildAll(shapes, {
        squad,
        roles: config.roles,
        weights: config.roleWeights,
        codes: config.fmCodes,
        warnings: config.roleWarnings,
        style,
        mustPlay: new Set(mustPlay),
      }),
    )
    setPick(null)
    setStep('shape')
  }
  const choose = (b: BuiltTactic) => {
    setPick(b)
    setSlots(b.slots)
    setMentality(style?.mentality ?? 'Balanced')
    setOffTeam(new Set())
    setOffPlayer(new Set())
    setName(`${style ? `${style.name} ` : ''}${formationOf(b.slots)}`)
    setStep('roles')
  }
  const setSlot = (i: number, patch: Partial<TacticSlot>) =>
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const byId = (id: string | null | undefined) => squad.find((p) => p.id === id) ?? null
  const roleName = (id: string | null | undefined) => {
    const r = config.roles.find((x) => x.id === id)
    return r ? roleShort(r) : '–'
  }

  const teamOn = teamTips.filter((t) => !offTeam.has(t.rule))
  const playerOn = playerTips.filter((t) => !offPlayer.has(tipKey(t)))
  const finalTeam = applyTeam(base, teamOn, config.teamInstructions)
  const finalSlots = applyPlayers(slots, playerOn, config.playerInstructions)

  const save = async () => {
    if (!pick) return
    setSaving(true)
    setError(null)
    try {
      const t = await saveTactic(career.id, null, {
        name: name.trim() || pick.shape.label,
        style: style ? styleText(style, mentality, finalTeam) : null,
        mentality,
        slots: finalSlots,
        instructions: { team: finalTeam },
        notes: `Built with the tactic assistant around your squad (${pick.shape.label}).`,
      })
      await qc.invalidateQueries({ queryKey: ['tactics', career.id] })
      navigate(`/tactics?tactic=${t.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  // One option per in-possession formation: the best of its out-of-possession variants
  const options = (built ?? []).filter(
    (b, i, all) => all.findIndex((x) => formationOf(x.slots) === formationOf(b.slots)) === i,
  )
  const reached = pick ? STEPS.length - 1 : built ? 1 : 0

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
        subtitle="Builds tactics around your squad: every shape filled with your best XI and the role each player suits, then team and player instructions from your players' attributes. Everything stays editable afterwards on the Tactics page."
      />
      <ol className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {STEPS.map(([s, label], i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > reached}
              onClick={() => setStep(s)}
              className={clsx(
                'min-h-9 rounded-full border px-3',
                s === step
                  ? 'border-accent bg-accent/15 text-accent'
                  : i <= reached
                    ? 'border-border text-text'
                    : 'border-border text-muted',
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 'start' && (
        <Card className="grid gap-4">
          <section className="grid gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              Style (optional) <Tag fm />
            </h2>
            <p className="text-sm text-muted">
              Without a style the tactic starts from FM&apos;s standard instructions and is built
              only from your players. A style gives its mentality and instructions as the starting
              point, and a small bonus to the roles FM says it prefers. The number is your
              squad&apos;s average in the attributes FM says the style favours.
            </p>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <li>
                <StyleButton active={!style} onClick={() => setStyle(null)} title="No style">
                  Built only from your players
                </StyleButton>
              </li>
              {fits.map(({ style: s, score }) => (
                <li key={s.code}>
                  <StyleButton
                    active={style?.code === s.code}
                    onClick={() => setStyle(s)}
                    title={s.name}
                    score={score}
                  >
                    {s.summary.join(' · ')}
                  </StyleButton>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-2">
            <h2 className="font-semibold">Players who must play (optional)</h2>
            <p className="text-sm text-muted">
              Your key players: every shape is built with them in the XI.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {mustPlay.map((id) => (
                <span
                  key={id}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border pr-1 pl-3 text-sm"
                >
                  {byId(id)?.name}
                  <button
                    type="button"
                    aria-label={`Remove ${byId(id)?.name}`}
                    onClick={() => setMustPlay(mustPlay.filter((x) => x !== id))}
                    className="grid size-7 place-items-center rounded-full text-muted hover:text-red-400"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              {mustPlay.length < 11 && (
                <div className="w-64 max-w-full">
                  <PickList
                    value=""
                    placeholder="Add a player"
                    onChange={(id) =>
                      id && !mustPlay.includes(id) && setMustPlay([...mustPlay, id])
                    }
                    options={[...squad]
                      .filter((p) => !mustPlay.includes(p.id))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => ({ value: p.id, label: p.name, group: p.positions ?? '' }))}
                  />
                </div>
              )}
            </div>
          </section>
          <div className="flex justify-end">
            <button type="button" onClick={build} className={next}>
              Build tactics
            </button>
          </div>
        </Card>
      )}

      {step === 'shape' && built && (
        <Card>
          <h2 className="mb-1 font-semibold">Which shape?</h2>
          <p className="mb-3 text-sm text-muted">
            Common formations and every shape FM27&apos;s templates use (with their
            out-of-possession shape), each built for your squad: best XI in positions they can play,
            each player in the role he suits best where FM offers it, changed only where FM would
            warn about the combination. Ranked by role fit, then cover on the bench.
          </p>
          <ul className="grid gap-2">
            {options.slice(0, 10).map((b) => (
              <li key={b.shape.key}>
                <button
                  type="button"
                  onClick={() => choose(b)}
                  className="grid w-full gap-2 rounded-xl border border-border bg-surface p-3 text-left hover:border-accent"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-semibold">{b.shape.label}</span>
                      <span className="block text-xs text-muted">{b.shape.from}</span>
                    </span>
                    <span className="flex items-center gap-3 text-sm tabular-nums">
                      {b.outOfPosition > 0 && (
                        <span className="text-amber-300">{b.outOfPosition} out of position</span>
                      )}
                      <span title="Average fit of the best bench player for each position">
                        Bench {b.depth}
                      </span>
                      <span className={clsx('font-semibold', scoreTextColor(b.fit))}>
                        Fit {b.fit}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {b.slots.map((s, i) => {
                      const p = byId(s.player)
                      const sc = b.picks[i].score
                      return (
                        <span
                          key={i}
                          className={clsx(
                            'rounded-md border px-1.5 py-0.5 text-xs',
                            b.picks[i].outOfPosition ? 'border-amber-400/60' : 'border-border',
                          )}
                        >
                          <span className="text-muted">{s.position}</span> {p ? shortName(p) : '–'}{' '}
                          <span className="text-muted">
                            {roleName(s.role)}/{roleName(s.roleOop)}
                          </span>{' '}
                          {sc !== null && (
                            <span className={clsx('font-semibold', scoreTextColor(sc))}>{sc}</span>
                          )}
                        </span>
                      )
                    })}
                  </span>
                  {b.leftOut.length > 0 && (
                    <span className="text-xs text-muted">
                      Leaves out:{' '}
                      {b.leftOut
                        .map((x) => `${x.player.name} (best role ${Math.round(x.score)})`)
                        .join(', ')}
                    </span>
                  )}
                  {b.changes.length > 0 && (
                    <span className="text-xs text-muted">Changed: {b.changes.join('; ')}</span>
                  )}
                  {b.warnings.length > 0 && (
                    <span className="text-xs text-amber-300">FM warns: {b.warnings.join(' ')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'roles' && pick && (
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
            Change any player or role. Role lists show only the roles FM offers at that position,
            with the player&apos;s fit{style ? `; ★ marks roles ${style.name} prefers` : ''}.{' '}
            {formationOf(slots)} in possession,{' '}
            {formationLabel(slots.map((s) => s.positionOop ?? s.position))} out of possession.
          </p>
          {warnings.length > 0 && (
            <ul className="mb-3 grid gap-1 rounded-lg border border-amber-400/40 p-2 text-sm text-amber-200">
              {warnings.map((w) => (
                <li key={w}>FM warns: {w}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            {slots.map((s, i) => {
              const player = byId(s.player)
              const fit = player ? slotScore(player, s, ctx) : null
              return (
                <div
                  key={i}
                  className="grid items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3rem]"
                >
                  <span className="text-sm font-semibold">
                    {slotPosition(s)}
                    {s.positionOop && s.positionOop !== s.position && (
                      <span className="block text-xs font-normal text-muted">
                        {POSITION_TEXT[s.positionOop]} out
                      </span>
                    )}
                  </span>
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
                          {slots.some((x, j) => j !== i && x.player === p.id) ? ' (in XI)' : ''}
                        </option>
                      ))}
                  </select>
                  <RolePick
                    label="In possession"
                    phase="ip"
                    slots={slots}
                    index={i}
                    player={player}
                    preferred={preferred}
                    onChange={(role) => setSlot(i, { role })}
                  />
                  <RolePick
                    label="Out of possession"
                    phase="oop"
                    slots={slots}
                    index={i}
                    player={player}
                    preferred={preferred}
                    onChange={(roleOop) => setSlot(i, { roleOop })}
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
            <button type="button" onClick={() => setStep('team')} className={next}>
              Next: team instructions
            </button>
          </div>
        </Card>
      )}

      {step === 'team' && pick && (
        <Card className="grid gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            Team instructions <Tag fm={false} />
          </h2>
          <p className="text-sm text-muted">
            Worked out from the attributes of the XI you picked. Starting point:{' '}
            {style ? `${style.name}'s instructions (FM27 data)` : "FM's standard instructions"}.
            Untick any you disagree with; switch rules off for good in Settings → Tactic assistant.
          </p>
          <label className="grid max-w-xs gap-1 text-sm">
            <span className="text-muted">Mentality (pick it for the opponent)</span>
            <select
              value={mentality}
              onChange={(e) => setMentality(e.target.value)}
              className={field}
            >
              {config.fmCodes.mentalities.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {teamTips.length === 0 ? (
            <p className="text-sm text-muted">Nothing to change for this XI.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {teamTips.map((t) => (
                <Tip
                  key={t.rule}
                  on={!offTeam.has(t.rule)}
                  onToggle={(on) => setOffTeam(toggle(offTeam, t.rule, !on))}
                  title={`${t.instruction}: ${t.from} → ${t.to}`}
                  text={`${t.name}. ${t.why}`}
                />
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep('players')} className={next}>
              Next: player instructions
            </button>
          </div>
        </Card>
      )}

      {step === 'players' && pick && (
        <Card className="grid gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            Player instructions <Tag fm={false} />
          </h2>
          <p className="text-sm text-muted">
            From each player&apos;s attributes, only where FM offers the instruction for his role at
            that position <Tag fm />. Untick any you disagree with.
          </p>
          {playerTips.length === 0 ? (
            <p className="text-sm text-muted">Nothing to suggest for this XI.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {slots.map((s, i) => {
                const tips = playerTips.filter((t) => t.slot === i)
                if (!tips.length) return null
                return (
                  <section key={i} className="grid content-start gap-1.5">
                    <h3 className="text-sm font-semibold">
                      {byId(s.player)?.name}{' '}
                      <span className="font-normal text-muted">
                        {slotPosition(s)} · {roleName(s.role)}/{roleName(s.roleOop)}
                      </span>
                    </h3>
                    <ul className="grid gap-1.5">
                      {tips.map((t) => (
                        <Tip
                          key={tipKey(t)}
                          on={!offPlayer.has(tipKey(t))}
                          onToggle={(on) => setOffPlayer(toggle(offPlayer, tipKey(t), !on))}
                          title={`${t.instruction}: ${t.to}`}
                          text={t.why}
                        />
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep('save')} className={next}>
              Next: save
            </button>
          </div>
        </Card>
      )}

      {step === 'save' && pick && (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Save the tactic</h2>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <p className="text-sm text-muted">
            {style ? styleText(style, mentality, finalTeam) : 'No style'} · {mentality} ·{' '}
            {formationOf(slots)} · team fit {grade.team ?? '–'} · {teamOn.length} team and{' '}
            {playerOn.length} player instructions set
            {grade.fits.some((f) => f.outOfPosition) &&
              ` · out of position: ${grade.fits
                .filter((f) => f.outOfPosition)
                .map((f) => f.player?.name)
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
              className={clsx(next, 'disabled:opacity-50')}
            >
              {saving ? 'Saving…' : 'Save tactic'}
            </button>
          </div>
        </Card>
      )}
    </>
  )
}

const toggle = (set: Set<string>, key: string, on: boolean) => {
  const out = new Set(set)
  if (on) out.add(key)
  else out.delete(key)
  return out
}

function StyleButton({
  active,
  onClick,
  title,
  score,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  score?: number | null
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'grid h-full w-full content-start gap-1 rounded-xl border p-3 text-left',
        active ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {score != null && <span className="tabular-nums">{Math.round(score * 10) / 10}</span>}
      </span>
      <span className="text-xs text-muted">{children}</span>
    </button>
  )
}

function Tip({
  on,
  onToggle,
  title,
  text,
}: {
  on: boolean
  onToggle: (on: boolean) => void
  title: string
  text: string
}) {
  return (
    <li className="rounded-lg border border-border p-2.5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0"
          checked={on}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="min-w-0">
          <span className={clsx('block text-sm font-semibold', !on && 'text-muted line-through')}>
            {title}
          </span>
          <span className="block text-xs text-muted">{text}</span>
        </span>
      </label>
    </li>
  )
}

/** A role for the slot in one phase: the roles FM offers at its position, with the player's fit. */
function RolePick({
  label,
  phase,
  slots,
  index,
  player,
  preferred,
  onChange,
}: {
  label: string
  phase: 'ip' | 'oop'
  slots: TacticSlot[]
  index: number
  player: PlayerRow | null
  preferred: Set<string>
  onChange: (role: string | null) => void
}) {
  const config = useConfig()
  const ctx: FitContext = { roles: config.roles, weights: config.roleWeights }
  const slot = slots[index]
  const at = fmPositions(slots, phase, config.fmCodes)[index]
  const options = rolesAt(config.roles, phase, at, shapeOf(slots, phase), (p) => POSITION_TEXT[p])
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
