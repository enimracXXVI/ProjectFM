import { ArrowRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { MORALE_WORDS } from '../import/dump'
import { scaleRanges } from '../data/staffInfo'
import { usePlayers } from '../data/hooks'
import type { PlayerRow } from '../data/db'
import { attrNumber } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { EUR_PER_GBP } from '../lib/money'
import {
  personalityMatches,
  personalityName,
  personalityRanges,
  type PersonalityValues,
} from '../lib/personality'
import { allRoleFits, roleScore, scoreColor } from '../lib/roleFit'
import { knowledgeWord } from '../import/save'
import { useChecks } from '../lib/useChecks'

/** Plain-language, visual explanations of every value ProjectFM works out by itself. */
export function Explain() {
  const checks = useChecks()
  const { staffScale, staffScaleMin } = useConfig()
  return (
    <>
      <PageHeader title="How it works" subtitle="Where each value comes from, in pictures." />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ['sources', 'Where data comes from'],
          ['words', 'Numbers into FM words'],
          ['personality', 'Personality'],
          ['roles', 'Role fit'],
          ['money', 'Money'],
          ['development', 'Development'],
          ['unknown', 'When the app cannot tell'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-border px-3 py-1.5 hover:bg-surface-2"
          >
            {label}
          </a>
        ))}
      </nav>

      <Topic id="sources" title="Where data comes from">
        <Flow
          from="Your FM save (.fm)"
          to={[
            'Squad (all teams): attributes, positions, feet, numbers, morale, contracts, season stats',
            'Staff: everyone at the club, with attributes and scouting knowledge',
            'Competitions: fixtures, results, goals, match reports and player stats',
            'Tactics and the World database (every player)',
          ]}
        />
        <p className="mt-3 text-sm text-muted">
          Every import makes the app match the save: players and staff no longer at the club leave,
          each player's attributes are kept for the Development page, and a save from a new season
          first stores last season's squad. A save from another club offers a new career.
        </p>
      </Topic>

      <Topic id="words" title="Numbers into FM words">
        <p className="mb-3 text-sm">
          The save stores numbers; FM shows words. ProjectFM keeps both, like{' '}
          <Chip>Very Good (17)</Chip>, so you can always compare with the game.
        </p>
        <Scale
          title="Staff attributes (1–20)"
          items={staffScale.map((w, i) => [w, scaleRanges(staffScaleMin)[i] ?? ''])}
        />
        <Scale
          title="Feet (1–20)"
          items={[
            ['Very Weak', '1–4'],
            ['Weak', '5–8'],
            ['Reasonable', '9–11'],
            ['Fairly Strong', '12–14'],
            ['Strong', '15–17'],
            ['Very Strong', '18–20'],
          ]}
        />
        <Points
          title="Scouting knowledge (0–100), values seen so far"
          points={[30, 36, 48, 50, 60, 75, 90, 100].map((n) => [n, knowledgeWord(n)])}
        />
        <Points
          title="Morale (1–20), values seen so far"
          points={Object.entries(MORALE_WORDS).map(([n, w]) => [Number(n), `${w} (${n})`])}
        />
      </Topic>

      <Topic id="personality" title="Personality">
        <PersonalityExplainer />
      </Topic>

      <Topic id="roles" title="Role fit">
        <RoleExplainer />
      </Topic>

      <Topic id="money" title="Money">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Chip>£ in the save</Chip>
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Chip>× {EUR_PER_GBP}</Chip>
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Chip>€ as in your FM</Chip>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Chip>Weekly wage</Chip>
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Chip>× 52</Chip>
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Chip>per year</Chip>
        </div>
        <p className="mt-2 text-sm text-muted">
          The rate was measured on 17 of your players, comparing the save with your FM screens.
        </p>
      </Topic>

      <Topic id="development" title="Development">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Chip>First import</Chip>
          <span className="text-muted">vs</span>
          <Chip>Latest import</Chip>
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Chip>+/− per attribute</Chip>
        </div>
        <p className="mt-2 text-sm text-muted">
          Every import keeps a snapshot. Only attributes present in both snapshots are compared, so
          a new column never counts as growth.
        </p>
      </Topic>

      <Topic id="unknown" title="When the app cannot tell">
        <p className="text-sm">
          A value with no known word shows as <Chip>Unknown (12)</Chip>. A personality that fits no
          rule stays empty. All of them are listed under{' '}
          <Link to="/check" className="text-accent underline">
            Check in game
          </Link>{' '}
          ({checks.total} now): look them up in FM, pick the word, and the app remembers it for
          every future import.
        </p>
      </Topic>
    </>
  )
}

function Topic({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-6 scroll-mt-20">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </Card>
    </section>
  )
}

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded-md bg-surface-2 px-2 py-0.5 font-medium">{children}</span>
)

function Flow({ from, to }: { from: string; to: string[] }) {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[auto_auto_1fr]">
      <div className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-center font-semibold">
        {from}
      </div>
      <ArrowRight className="mx-auto size-5 rotate-90 text-muted sm:rotate-0" aria-hidden />
      <ul className="grid gap-2">
        {to.map((t) => (
          <li key={t} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

const TONES = [
  'bg-red-400/70',
  'bg-amber-400/70',
  'bg-amber-300/60',
  'bg-slate-400/50',
  'bg-lime-300/60',
  'bg-emerald-400/70',
  'bg-emerald-500/80',
  'bg-emerald-600/90',
]

function Scale({ title, items }: { title: string; items: string[][] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <div className="flex overflow-hidden rounded-lg text-center text-xs">
        {items.map(([word, range], i) => (
          <div
            key={word}
            className={`min-w-0 flex-1 px-1 py-2 text-black ${TONES[Math.round((i / Math.max(items.length - 1, 1)) * (TONES.length - 1))]}`}
          >
            <div className="truncate font-semibold">{word}</div>
            <div className="opacity-80">{range}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Points({ title, points }: { title: string; points: [number, string][] }) {
  const max = Math.max(...points.map(([n]) => n), 20) > 20 ? 100 : 20
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <div className="relative mx-12 mt-8 mb-10 h-1.5 rounded bg-surface-2">
        {points.map(([n, label], i) => (
          <div
            key={n}
            className="absolute -translate-x-1/2"
            style={{ left: `${(n / max) * 100}%`, top: i % 2 ? '0.5rem' : '-2rem' }}
          >
            <div className="text-[11px] whitespace-nowrap text-muted">{label}</div>
          </div>
        ))}
        {points.map(([n]) => (
          <span
            key={`dot-${n}`}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ left: `${(n / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

const VALUE_LABELS: Record<keyof PersonalityValues, string> = {
  professionalism: 'Professionalism',
  pressure: 'Pressure',
  ambition: 'Ambition',
  temperament: 'Temperament',
  loyalty: 'Loyalty',
  sportsmanship: 'Sportsmanship',
  determination: 'Determination',
  leadership: 'Leadership',
}

function valuesOf(p: PlayerRow): PersonalityValues {
  const n = (k: string) => (p.extra[k] !== undefined ? Number(p.extra[k]) : undefined)
  return {
    professionalism: n('Professionalism'),
    pressure: n('Pressure'),
    ambition: n('Ambition'),
    temperament: n('Temperament'),
    loyalty: n('Loyalty'),
    sportsmanship: n('Sportsmanship'),
    determination: attrNumber(p.attributes.Determination) ?? undefined,
    leadership: attrNumber(p.attributes.Leadership) ?? undefined,
  }
}

function PersonalityExplainer() {
  const career = useCurrentCareer()
  const { showHidden, personalityRules } = useConfig()
  const { data: players } = usePlayers(career.id)
  const withValues = (players ?? []).filter((p) => p.in_squad && p.extra.Ambition !== undefined)
  const [id, setId] = useState('')
  const player = withValues.find((p) => p.id === id) ?? withValues[0]
  const values = player ? valuesOf(player) : null
  const matches = values ? personalityMatches(values, personalityRules) : []
  const winner = values ? personalityName(values, personalityRules) : null

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Chip>6 hidden values</Chip>
        <span>+</span>
        <Chip>Determination</Chip>
        <span>+</span>
        <Chip>Leadership</Chip>
        <ArrowRight className="size-4 text-muted" aria-hidden />
        <Chip>ranges table</Chip>
        <ArrowRight className="size-4 text-muted" aria-hidden />
        <Chip>priority when several fit</Chip>
        <ArrowRight className="size-4 text-muted" aria-hidden />
        <Chip>personality</Chip>
      </div>
      <p className="mb-3 text-sm text-muted">
        Each personality needs every value inside its range. When values fit more than one, the
        stronger personality wins (for example Spirited beats Fairly Professional). Rules from a
        community test on Reddit; they match FM for all 24 players and 6 scouts checked.
      </p>
      {!showHidden ? (
        <p className="text-sm text-muted">
          Turn on hidden values in Settings to see your players’ values against the ranges.
        </p>
      ) : player && values ? (
        <>
          <select
            aria-label="Player"
            value={player.id}
            onChange={(e) => setId(e.target.value)}
            className="mb-3 min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
          >
            {withValues.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mb-3 text-sm">
            Fits: {matches.length ? matches.join(', ') : 'none'}{' '}
            <ArrowRight className="inline size-4" aria-hidden />{' '}
            <strong className="text-accent">{winner ?? 'cannot tell (see Check in game)'}</strong>
          </p>
          {winner && <RangeBars name={winner} values={values} />}
        </>
      ) : (
        <p className="text-sm text-muted">Import your save to see your players here.</p>
      )}
    </>
  )
}

function RangeBars({ name, values }: { name: string; values: PersonalityValues }) {
  const { personalityRules } = useConfig()
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">Green band: what {name} needs. Dot: this player.</p>
      {personalityRanges(name, personalityRules).map(([key, min, max]) => {
        const v = values[key]
        return (
          <div key={key} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="truncate">{VALUE_LABELS[key]}</span>
            <div className="relative h-3 rounded bg-surface-2">
              <div
                className="absolute inset-y-0 rounded bg-emerald-500/50"
                style={{
                  left: `${((min - 1) / 19) * 100}%`,
                  width: `${((max - min) / 19) * 100}%`,
                  minWidth: '4px',
                }}
              />
              {v !== undefined && (
                <span
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-text"
                  style={{ left: `${((v - 1) / 19) * 100}%` }}
                />
              )}
            </div>
            <span className="text-right tabular-nums">{v ?? '–'}</span>
          </div>
        )
      })}
    </div>
  )
}

function RoleExplainer() {
  const career = useCurrentCareer()
  const { roles, roleWeights } = useConfig()
  const { data: players } = usePlayers(career.id)
  const squad = (players ?? []).filter((p) => p.in_squad && Object.keys(p.attributes).length)
  const [pid, setPid] = useState('')
  const [rid, setRid] = useState('')
  const player = squad.find((p) => p.id === pid) ?? squad[0]
  // Default: the player's best role
  const best = player ? allRoleFits(player.attributes, player.positions, roles, roleWeights) : []
  const role =
    roles.find((r) => r.id === rid) ?? (best.find((f) => f.natural) ?? best[0])?.role ?? roles[0]

  const parts = (() => {
    if (!player || !role) return []
    const gk = role.positions.includes('GK')
    const tiers = gk ? roleWeights.goalkeeper : roleWeights.outfield
    const tierOf = new Map(tiers.flatMap((t) => t.attributes.map((a) => [a, t.weight] as const)))
    return [...role.key, ...role.preferred]
      .map((name) => {
        const factor = role.key.includes(name) ? roleWeights.key : roleWeights.preferred
        const weight = (tierOf.get(name) ?? roleWeights.defaultWeight) * factor
        return { name, weight, value: attrNumber(player.attributes[name]) }
      })
      .sort((a, b) => b.weight - a.weight)
  })()
  const score = player && role ? roleScore(player.attributes, role, roleWeights) : null
  const maxWeight = Math.max(1, ...parts.map((p) => p.weight))

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Chip>attribute</Chip>
        <span>×</span>
        <Chip>
          importance ({roleWeights.outfield.map((t) => `${t.name} ${t.weight}`).join(', ')}, others{' '}
          {roleWeights.defaultWeight})
        </Chip>
        <span>×</span>
        <Chip>
          role factor (key {roleWeights.key}, preferred {roleWeights.preferred}, other{' '}
          {roleWeights.other})
        </Chip>
        <ArrowRight className="size-4 text-muted" aria-hidden />
        <Chip>weighted average</Chip>
        <ArrowRight className="size-4 text-muted" aria-hidden />
        <Chip>0–100</Chip>
      </div>
      <p className="mb-3 text-sm text-muted">
        All 1s scores 0, all 20s scores 100. This is ProjectFM’s own formula, not FM’s; every number
        is editable in Settings → Role weights.
      </p>
      {player && role && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              aria-label="Player"
              value={player.id}
              onChange={(e) => setPid(e.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
            >
              {squad.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Role"
              value={role.id}
              onChange={(e) => setRid(e.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {score !== null && (
              <span
                className={`grid min-h-11 place-items-center rounded-lg px-3 font-bold text-black ${scoreColor(score)}`}
              >
                {score}
              </span>
            )}
          </div>
          <p className="mb-1 text-xs text-muted">
            Key and preferred attributes for this role: bar length = how much each counts, number =
            the player’s value.
          </p>
          <ul className="grid gap-1">
            {parts.map((p) => (
              <li
                key={p.name}
                className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2 text-sm"
              >
                <span className="truncate">{p.name}</span>
                <div className="h-3 rounded bg-surface-2">
                  <div
                    className={`h-3 rounded ${role.key.includes(p.name) ? 'bg-accent' : 'bg-accent/50'}`}
                    style={{ width: `${(p.weight / maxWeight) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{p.value ?? '–'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Bright: key attribute · faded: preferred · all other attributes count at ×
            {roleWeights.other}.
          </p>
        </>
      )}
    </>
  )
}
