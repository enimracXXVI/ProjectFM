import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, X } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import {
  canPlay,
  gradeTactic,
  positionRating,
  slotScore,
  withPlayer,
  type FitContext,
} from '../tactics/analysis'
import { firstTeam, slotPosition } from '../tactics/assistant'
import {
  applyPlayers,
  buildAll,
  ideaShapes,
  playerSuggestions,
  teamSuggestions,
  type BuiltTactic,
} from '../tactics/builder'
import { defaultTeamCodes, fmPositions, rolesAt, shapeOf } from '../tactics/fm'
import {
  applyCodes,
  ideaFit,
  ideaTeam,
  LINE_NAMES,
  ROLE_LINKS,
  squadCheck,
  teamConflicts,
  type GameIdea,
} from '../tactics/ideas'
import { POSITION_TEXT, formationLabel } from '../tactics/positions'
import type { TacticSlot } from '../tactics/types'
import { roleWarnings } from '../tactics/warnings'

type Step = 'idea' | 'shape' | 'roles' | 'team' | 'players' | 'save'
const STEPS: [Step, string][] = [
  ['idea', 'Game idea'],
  ['shape', 'Shape'],
  ['roles', 'Players and roles'],
  ['team', 'Team instructions'],
  ['players', 'Player instructions'],
  ['save', 'Save'],
]
const field = 'min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm'
const next = 'min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-black'
const VERDICT = {
  good: 'text-emerald-400',
  fair: 'text-amber-300',
  weak: 'text-red-400',
}

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
const r1 = (x: number | null) => (x === null ? '–' : Math.round(x * 10) / 10)

/**
 * Tactic assistant: starts from a game idea (what the team wants to do), checks the squad
 * against it, builds the shape, XI and roles the idea needs, then the team instructions that
 * go together, adjusted to the players, and player instructions from each player.
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
  const [step, setStepState] = useState<Step>('idea')
  const setStep = (s: Step) => {
    setStepState(s)
    window.scrollTo({ top: 0 })
  }
  const [idea, setIdea] = useState<GameIdea | null>(null)
  const [mustPlay, setMustPlay] = useState<string[]>([])
  const [built, setBuilt] = useState<BuiltTactic[] | null>(null)
  const [pick, setPick] = useState<BuiltTactic | null>(null)
  const [slots, setSlots] = useState<TacticSlot[]>([])
  const [mentality, setMentality] = useState('Balanced')
  const [offIdea, setOffIdea] = useState<Set<string>>(new Set())
  const [offTeam, setOffTeam] = useState<Set<string>>(new Set())
  const [offPlayer, setOffPlayer] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = useMemo(
    () =>
      config.gameIdeas
        .map((x) => {
          const c = squadCheck(x, squad)
          return { idea: x, checks: c, fit: ideaFit(c) }
        })
        .sort((a, b) => b.fit - a.fit),
    [config.gameIdeas, squad],
  )
  const preferred = useMemo(
    () => new Set(idea?.roles.flatMap((r) => [...r.ip, ...r.oop]) ?? []),
    [idea],
  )
  const grade = useMemo(() => gradeTactic(slots, squad, ctx), [slots, squad, ctx])
  const warnings = useMemo(
    () => roleWarnings(slots, config.roles, config.roleWarnings, config.fmCodes),
    [slots, config],
  )
  const unpaired = useMemo(
    () =>
      ROLE_LINKS.filter((l) => config.tacticRules[l.id] !== false).flatMap((l) => {
        const hit = l.check(slots)
        return hit ? [`${l.name}. ${hit.why}`] : []
      }),
    [slots, config.tacticRules],
  )

  // Team instructions: the idea's, then the squad's on the rest
  const base = useMemo(() => defaultTeamCodes(config.teamInstructions), [config])
  const ideaItems = useMemo(
    () => (idea ? ideaTeam(idea, base, config.teamInstructions) : []),
    [idea, base, config.teamInstructions],
  )
  const ideaOn = ideaItems.filter((t) => !offIdea.has(t.instruction))
  const afterIdea = applyCodes(base, ideaOn, config.teamInstructions)
  const squadTips = useMemo(
    () => teamSuggestions(slots, squad, afterIdea, config.teamInstructions, config.tacticRules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots, squad, afterIdea.join(','), config],
  )
  const ideaNames = new Set(ideaOn.map((t) => t.instruction))
  const squadAgainst = squadTips.filter((t) => ideaNames.has(t.instruction))
  // The squad's suggestions on what the idea leaves open, unless they clash with the idea
  const squadOpen: typeof squadTips = []
  const squadClash: { tip: (typeof squadTips)[number]; text: string }[] = []
  {
    let codes = afterIdea
    for (const t of squadTips.filter((x) => !ideaNames.has(x.instruction))) {
      const trial = applyCodes(codes, [t], config.teamInstructions)
      const before = teamConflicts(codes, config.teamInstructions, config.tacticRules)
      const added = teamConflicts(trial, config.teamInstructions, config.tacticRules).filter(
        (x) => !before.some((y) => y.id === x.id),
      )
      if (added.length) squadClash.push({ tip: t, text: added.map((x) => x.text).join(' ') })
      else {
        squadOpen.push(t)
        codes = trial
      }
    }
  }
  const squadOn = squadOpen.filter((t) => !offTeam.has(t.rule))
  const finalTeam = applyCodes(afterIdea, squadOn, config.teamInstructions)
  const conflicts = teamConflicts(finalTeam, config.teamInstructions, config.tacticRules)

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
        idea,
      ),
    [slots, squad, config, feet, idea],
  )
  const tipKey = (t: { slot: number; instruction: string }) => `${t.slot}|${t.instruction}`
  const playerOn = playerTips.filter((t) => !offPlayer.has(tipKey(t)))
  const finalSlots = applyPlayers(slots, playerOn, config.playerInstructions)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (!squad.length)
    return <Placeholder>Import your save first: the assistant builds from your squad.</Placeholder>

  const build = () => {
    if (!idea) return
    setBuilt(
      buildAll(ideaShapes(idea), {
        squad,
        roles: config.roles,
        weights: config.roleWeights,
        codes: config.fmCodes,
        warnings: config.roleWarnings,
        idea,
        enabled: config.tacticRules,
        mustPlay: new Set(mustPlay),
      }),
    )
    setPick(null)
    setStep('shape')
  }
  const choose = (b: BuiltTactic) => {
    setPick(b)
    setSlots(b.slots)
    setMentality(idea?.mentality ?? 'Balanced')
    setOffIdea(new Set())
    setOffTeam(new Set())
    setOffPlayer(new Set())
    setName(`${idea?.name ?? ''} ${formationOf(b.slots)}`.trim())
    setStep('roles')
  }
  const setSlot = (i: number, patch: Partial<TacticSlot>) =>
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const byId = (id: string | null | undefined) => squad.find((p) => p.id === id) ?? null
  const roleName = (id: string | null | undefined) => {
    const r = config.roles.find((x) => x.id === id)
    return r ? roleShort(r) : '–'
  }

  const save = async () => {
    if (!pick || !idea) return
    setSaving(true)
    setError(null)
    try {
      const t = await saveTactic(career.id, null, {
        name: name.trim() || pick.shape.label,
        style: null,
        mentality,
        slots: finalSlots,
        instructions: { team: finalTeam },
        notes: `Built with the tactic assistant: ${idea.name}. ${idea.about}`,
      })
      await qc.invalidateQueries({ queryKey: ['tactics', career.id] })
      navigate(`/tactics?tactic=${t.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const chosenCheck = checks.find((c) => c.idea.id === idea?.id)
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
        subtitle="Start from how you want to play. The assistant checks your squad against it, builds the shapes, XI and roles that idea needs, then team instructions that go together and player instructions for each player. Everything stays editable afterwards on the Tactics page."
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

      {step === 'idea' && (
        <Card className="grid gap-4">
          <section className="grid gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              How do you want to play? <Tag fm={false} />
            </h2>
            <p className="text-sm text-muted">
              Each idea says what it needs from each line of the team. The number is how well your
              squad has it (0–100): the best players for each line in the attributes that idea
              needs. Edit the ideas in Settings → Game ideas.
            </p>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {checks.map(({ idea: x, fit }) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setIdea(x)}
                    aria-pressed={idea?.id === x.id}
                    className={clsx(
                      'grid h-full w-full content-start gap-1 rounded-xl border p-3 text-left',
                      idea?.id === x.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface hover:border-accent',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{x.name}</span>
                      <span className={clsx('font-semibold tabular-nums', scoreTextColor(fit))}>
                        {fit}
                      </span>
                    </span>
                    <span className="text-xs text-muted">{x.about}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {idea && chosenCheck && (
            <section className="grid gap-2">
              <h2 className="font-semibold">Your squad for {idea.name}</h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {chosenCheck.checks.map((c, k) => (
                  <li key={k} className="grid gap-1 rounded-lg border border-border p-3 text-sm">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">
                        {c.need.lines.map((l) => LINE_NAMES[l]).join(', ')}
                      </span>
                      <span className={clsx('shrink-0 font-semibold', VERDICT[c.verdict])}>
                        {c.verdict === 'good' ? 'Good' : c.verdict === 'fair' ? 'Fair' : 'Weak'}{' '}
                        {r1(c.value)}
                      </span>
                    </span>
                    <span className="text-xs text-muted">
                      {c.need.attributes.join(', ')}. {c.need.why}
                    </span>
                    <span className="text-xs">
                      {c.best.length
                        ? `Best: ${c.best.map((b) => `${b.player.name} ${r1(b.value)}`).join(', ')}`
                        : 'Nobody in the squad plays here.'}
                    </span>
                  </li>
                ))}
              </ul>
              {chosenCheck.checks.some((c) => c.verdict === 'weak') && (
                <p className="text-sm text-amber-300">
                  Weak lines are where this idea will struggle: a target for the transfer window, or
                  a reason to pick another idea.
                </p>
              )}
            </section>
          )}

          <section className="grid gap-2">
            <h2 className="font-semibold">Players who must play (optional)</h2>
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
            <button
              type="button"
              disabled={!idea}
              onClick={build}
              className={clsx(next, 'disabled:opacity-40')}
            >
              {idea ? `Build ${idea.name}` : 'Pick an idea first'}
            </button>
          </div>
        </Card>
      )}

      {step === 'shape' && built && idea && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            Which shape for {idea.name}? <Tag fm={false} />
          </h2>
          <p className="mb-3 text-sm text-muted">
            The formations that suit {idea.name}, each with the XI that fits it best: players picked
            for their role fit and for what the idea needs from their line, in the roles the idea
            wants where they suit them, then roles paired so they cover each other and FM&apos;s
            warnings avoided. &ldquo;Idea&rdquo; is how well the XI has what the idea needs (0–100).
          </p>
          <ul className="grid gap-2">
            {built.map((b) => (
              <li key={b.shape.key}>
                <button
                  type="button"
                  onClick={() => choose(b)}
                  className="grid w-full gap-2 rounded-xl border border-border bg-surface p-3 text-left hover:border-accent"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{b.shape.label}</span>
                    <span className="flex items-center gap-3 text-sm tabular-nums">
                      {b.outOfPosition > 0 && (
                        <span className="text-amber-300">{b.outOfPosition} out of position</span>
                      )}
                      <span title="Average fit of the best bench player for each position">
                        Bench {b.depth}
                      </span>
                      {b.ideaMatch !== null && (
                        <span className={clsx('font-semibold', scoreTextColor(b.ideaMatch))}>
                          Idea {b.ideaMatch}
                        </span>
                      )}
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
                  {b.changes.length > 0 && (
                    <span className="grid gap-0.5 text-xs text-muted">
                      {b.changes.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </span>
                  )}
                  {b.leftOut.length > 0 && (
                    <span className="text-xs text-muted">
                      Leaves out:{' '}
                      {b.leftOut
                        .map((x) => `${x.player.name} (best role ${Math.round(x.score)})`)
                        .join(', ')}
                    </span>
                  )}
                  {[...b.unpaired, ...b.warnings].map((w) => (
                    <span key={w} className="text-xs text-amber-300">
                      {w}
                    </span>
                  ))}
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
            with the player&apos;s fit; ★ marks the roles {idea?.name} wants. {formationOf(slots)}{' '}
            in possession, {formationLabel(slots.map((s) => s.positionOop ?? s.position))} out of
            possession.
          </p>
          {(warnings.length > 0 || unpaired.length > 0) && (
            <ul className="mb-3 grid gap-1 rounded-lg border border-amber-400/40 p-2 text-sm text-amber-200">
              {unpaired.map((w) => (
                <li key={w}>{w}</li>
              ))}
              {warnings.map((w) => (
                <li key={w}>FM warns: {w}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            <div className="hidden gap-2 px-2 text-xs text-muted md:grid md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3rem]">
              <span>Position</span>
              <span>Player</span>
              <span>In possession</span>
              <span>Out of possession</span>
              <span className="text-right">Fit</span>
            </div>
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
                  <label className="grid gap-0.5">
                    <span className="text-xs text-muted md:hidden">Player</span>
                    <select
                      aria-label={`Player at ${slotPosition(s)}`}
                      value={s.player ?? ''}
                      onChange={(e) => setSlots(withPlayer(slots, i, e.target.value || null))}
                      className={field}
                    >
                      <option value="">No player</option>
                      {[...squad]
                        .map((p) => ({
                          p,
                          sc: slotScore(p, s, ctx),
                          ok: canPlay(p, s.position, config.positionMin),
                          rating: positionRating(p, s.position),
                        }))
                        .sort((a, b) => Number(b.ok) - Number(a.ok) || (b.sc ?? 0) - (a.sc ?? 0))
                        .map(({ p, sc, ok, rating }) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {sc ?? '–'}
                            {rating !== null ? ` · rated ${rating}` : ''}
                            {ok ? '' : ' (out of position)'}
                            {slots.some((x, j) => j !== i && x.player === p.id)
                              ? ' (in XI: swaps)'
                              : ''}
                          </option>
                        ))}
                    </select>
                  </label>
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

      {step === 'team' && pick && idea && (
        <Card className="grid gap-4">
          <label className="grid max-w-xs gap-1 text-sm">
            <span className="text-muted">
              Mentality ({idea.name} suggests {idea.mentality})
            </span>
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

          <section className="grid gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              What {idea.name} asks for <Tag fm={false} />
            </h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {ideaItems.map((t) => (
                <Tip
                  key={t.instruction}
                  on={!offIdea.has(t.instruction)}
                  onToggle={(on) => setOffIdea(toggle(offIdea, t.instruction, !on))}
                  title={`${t.instruction}: ${t.to}`}
                  text={t.why}
                />
              ))}
            </ul>
            {squadAgainst.map((t) => (
              <p key={t.rule} className="text-sm text-amber-300">
                Your players: {t.instruction} would be {t.to}, not {t.from}. {t.why} Keep it in
                mind, or untick the idea&apos;s choice above.
              </p>
            ))}
          </section>

          <section className="grid gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              From your players <Tag fm={false} />
            </h2>
            <p className="text-sm text-muted">
              Instructions the idea leaves open, worked out from the XI&apos;s attributes.
            </p>
            {squadOpen.length === 0 ? (
              <p className="text-sm text-muted">Nothing to add.</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {squadOpen.map((t) => (
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
            {squadClash.map(({ tip, text }) => (
              <p key={tip.rule} className="text-sm text-muted">
                Left out: {tip.instruction} {tip.to} ({tip.why}) would not fit the idea. {text}
              </p>
            ))}
          </section>

          {conflicts.length > 0 && (
            <ul className="grid gap-1 rounded-lg border border-red-400/40 p-2 text-sm text-red-300">
              {conflicts.map((x) => (
                <li key={x.id}>Does not fit together: {x.text}</li>
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
            From each player&apos;s attributes and what {idea?.name} asks, never against his role or
            the idea, and only where FM offers the instruction for his role at that position{' '}
            <Tag fm />. Untick any you disagree with.
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
            {idea?.name} · {mentality} · {formationOf(slots)} · team fit {grade.team ?? '–'} ·{' '}
            {ideaOn.length + squadOn.length} team and {playerOn.length} player instructions
            {grade.fits.some((f) => f.outOfPosition) &&
              ` · out of position: ${grade.fits
                .filter((f) => f.outOfPosition)
                .map((f) => f.player?.name)
                .join(', ')}`}
          </p>
          {conflicts.length > 0 && (
            <p className="text-sm text-red-300">
              {conflicts.length} team instruction{conflicts.length > 1 ? 's do' : ' does'} not fit
              together (see Team instructions).
            </p>
          )}
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
    <label className="grid gap-0.5">
      <span className="text-xs text-muted md:hidden">{label}</span>
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
    </label>
  )
}
