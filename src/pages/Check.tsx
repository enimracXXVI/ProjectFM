import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { setPlayerPersonality, teachJob, teachRole, teachWord } from '../data/api'
import { JOB_TITLES } from '../data/staffJobs'
import type { PlayerRow } from '../data/db'
import { MORALE_WORDS } from '../import/dump'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import type { UnknownCompetition, UnknownRound, UnknownValue } from '../lib/checks'
import type { CompetitionKind } from '../competitions/types'
import { useSaveConfig } from '../lib/useSaveConfig'
import type { LearnedKind } from '../lib/learned'
import { useChecks } from '../lib/useChecks'

const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Values and fields the app could not work out: look them up in FM and teach the app. */
export function Check() {
  const checks = useChecks()
  const config = useConfig()
  const moraleWords = [
    ...new Set([...Object.values(MORALE_WORDS), ...Object.values(config.learned.morale)]),
  ]

  return (
    <>
      <PageHeader
        title="Check in game"
        subtitle="Things the app could not work out by itself. Look them up in FM and tell the app: it remembers for every future import."
      />
      {checks.total === 0 && (
        <Card className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-accent" aria-hidden />
          <p className="text-sm">Nothing to check. Everything imported has a known FM word.</p>
        </Card>
      )}

      {checks.morale.length > 0 && (
        <Section
          title="Morale"
          hint="Open one of these players in FM and read the word next to Morale."
        >
          {checks.morale.map((u) => (
            <TeachRow key={u.value} kind="morale" item={u} options={moraleWords} free />
          ))}
        </Section>
      )}

      {checks.knowledge.length > 0 && (
        <Section
          title="Scouting knowledge"
          hint="Open the scout in FM (Scouting tab) and read the level next to the nation."
        >
          {checks.knowledge.map((u) => (
            <TeachRow key={u.value} kind="knowledge" item={u} options={config.knowledgeLevels} />
          ))}
        </Section>
      )}

      {checks.personality.length > 0 && (
        <Section
          title="Personality"
          hint="Their hidden values fit none of the known personalities. Open the player in FM and pick what it shows."
        >
          {checks.personality.map((p) => (
            <PersonalityRow key={p.id} player={p} />
          ))}
        </Section>
      )}

      {checks.competitions.length > 0 && (
        <Section
          title="Competitions"
          hint="The save only has an ID. Name the competition and say what it is."
        >
          {checks.competitions.map((c) => (
            <CompetitionRow key={c.databaseId} item={c} />
          ))}
        </Section>
      )}

      {checks.rounds.length > 0 && (
        <Section
          title="Cup rounds"
          hint="Name each round as FM shows it (for example First Round, Round of 16, Final)."
        >
          {checks.rounds.map((r) => (
            <RoundRow key={r.code} item={r} />
          ))}
        </Section>
      )}

      {checks.jobs.length > 0 && (
        <Section
          title="Staff jobs"
          hint="The save only has a job code for these. Open one of them in FM and pick the job it shows."
        >
          {checks.jobs.map((j) => (
            <JobRow key={j.code} code={j.code} names={j.names} />
          ))}
        </Section>
      )}

      {checks.tactics.length > 0 && (
        <Section
          title="Tactics"
          hint="Roles the app does not recognise in your save (a game update can change how FM stores them). Open the tactic in FM, look at the position, and pick the role it shows: the app remembers it."
        >
          {checks.tactics.flatMap((t) =>
            t.codes.map((c) => (
              <RoleRow
                key={`${t.name}-${c.phase}-${c.code}-${c.position}`}
                tactic={t.name}
                {...c}
              />
            )),
          )}
        </Section>
      )}

      <p className="mt-6 text-sm text-muted">
        How each value is worked out:{' '}
        <Link to="/explain" className="text-accent underline">
          How it works
        </Link>
      </p>
    </>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-2 text-sm text-muted">{hint}</p>
      <ul className="grid gap-2">{children}</ul>
    </section>
  )
}

function TeachRow({
  kind,
  item,
  options,
  free = false,
}: {
  kind: LearnedKind
  item: UnknownValue
  options: string[]
  free?: boolean
}) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const [word, setWord] = useState('')
  const listId = `words-${kind}-${item.value}`
  const save = useMutation({
    mutationFn: () => teachWord(career.id, kind, item.value, word.trim()),
    onSuccess: () => qc.invalidateQueries(),
  })
  return (
    <li className="rounded-lg border border-amber-400/40 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-amber-400/15 px-2 py-1 text-sm font-semibold text-amber-300 tabular-nums">
          Value {item.value}
        </span>
        <span className="min-w-0 flex-1 text-sm">{item.where.join(', ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {free ? (
          <>
            <input
              aria-label={`FM word for ${item.value}`}
              list={listId}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Word FM shows"
              className={field}
            />
            <datalist id={listId}>
              {options.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </>
        ) : (
          <select
            aria-label={`FM word for ${item.value}`}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className={field}
          >
            <option value="">Pick the word FM shows…</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        )}
        <Button onClick={() => save.mutate()} disabled={!word.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <ErrorText error={save.error} />
      </div>
    </li>
  )
}

function PersonalityRow({ player }: { player: PlayerRow }) {
  const qc = useQueryClient()
  const { personalityRules } = useConfig()
  const names = [...new Set([...personalityRules.map((r) => r.name), 'Devoted'])].sort()
  const [word, setWord] = useState('')
  const save = useMutation({
    mutationFn: () => setPlayerPersonality(player.id, word),
    onSuccess: () => qc.invalidateQueries(),
  })
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-surface p-3">
      <Link to={`/squad/${player.id}`} className="min-w-0 flex-1 text-sm font-medium underline">
        {player.name}
      </Link>
      <select
        aria-label={`Personality of ${player.name}`}
        value={word}
        onChange={(e) => setWord(e.target.value)}
        className={field}
      >
        <option value="">Pick the personality FM shows…</option>
        {names.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <Button onClick={() => save.mutate()} disabled={!word || save.isPending}>
        Save
      </Button>
      <ErrorText error={save.error} />
    </li>
  )
}

function CompetitionRow({ item }: { item: UnknownCompetition }) {
  const config = useConfig()
  const { save } = useSaveConfig('competitions')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CompetitionKind>('league')
  return (
    <li className="rounded-lg border border-amber-400/40 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-amber-400/15 px-2 py-1 text-sm font-semibold text-amber-300 tabular-nums">
          ID {item.databaseId}
        </span>
        <span className="min-w-0 flex-1 text-sm">{item.examples.join(' · ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label={`Name of competition ${item.databaseId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name in FM"
          className={field}
        />
        <select
          aria-label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value as CompetitionKind)}
          className={field}
        >
          <option value="league">League</option>
          <option value="cup">Cup</option>
          <option value="friendlies">Friendlies</option>
        </select>
        <Button
          onClick={() =>
            save.mutate({
              ...config.competitions,
              [String(item.databaseId)]: { name: name.trim(), kind },
            })
          }
          disabled={!name.trim() || save.isPending}
        >
          Save
        </Button>
        <ErrorText error={save.error} />
      </div>
    </li>
  )
}

function RoundRow({ item }: { item: UnknownRound }) {
  const config = useConfig()
  const { save } = useSaveConfig('learned')
  const [name, setName] = useState('')
  return (
    <li className="rounded-lg border border-amber-400/40 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-amber-400/15 px-2 py-1 text-sm font-semibold text-amber-300">
          {item.competition} · {item.date}
        </span>
        <span className="min-w-0 flex-1 text-sm">{item.examples.join(' · ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label="Round name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Round name in FM"
          className={field}
        />
        <Button
          onClick={() =>
            save.mutate({
              ...config.learned,
              rounds: { ...config.learned.rounds, [String(item.code)]: name.trim() },
            })
          }
          disabled={!name.trim() || save.isPending}
        >
          Save
        </Button>
        <ErrorText error={save.error} />
      </div>
    </li>
  )
}

function JobRow({ code, names }: { code: number; names: string[] }) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const save = useMutation({
    mutationFn: () => teachJob(career.id, code, title),
    onSuccess: () => qc.invalidateQueries(),
  })
  return (
    <li className="rounded-lg border border-amber-400/40 bg-surface p-3">
      <p className="text-sm">{names.join(', ')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label={`Job of ${names.join(', ')}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        >
          <option value="">Pick the job FM shows…</option>
          {JOB_TITLES.map(([t]) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button onClick={() => save.mutate()} disabled={!title || save.isPending}>
          Save
        </Button>
        <ErrorText error={save.error} />
      </div>
    </li>
  )
}

function RoleRow({
  tactic,
  code,
  phase,
  position,
}: {
  tactic: string
  code: string
  phase: 'ip' | 'oop'
  position: string | null
}) {
  const career = useCurrentCareer()
  const config = useConfig()
  const qc = useQueryClient()
  const [role, setRole] = useState('')
  const save = useMutation({
    mutationFn: () => teachRole(career.id, code, phase, role),
    onSuccess: () => qc.invalidateQueries(),
  })
  const where = phase === 'ip' ? 'in possession' : 'out of possession'
  return (
    <li className="rounded-lg border border-amber-400/40 bg-surface p-3">
      <p className="text-sm">
        <Link to="/tactics" className="font-semibold underline">
          {tactic}
        </Link>{' '}
        · {position ?? '?'} {where}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label={`Role at ${position ?? '?'} ${where}`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={field}
        >
          <option value="">Pick the role FM shows…</option>
          {config.roles
            .filter((r) => r.phase === phase)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <Button onClick={() => save.mutate()} disabled={!role || save.isPending}>
          Save
        </Button>
        <ErrorText error={save.error} />
      </div>
    </li>
  )
}
