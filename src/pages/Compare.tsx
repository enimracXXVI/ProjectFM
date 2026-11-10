import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Radar } from '../components/Radar'
import { PageHeader, Placeholder } from '../components/ui'
import { isGoalkeeper } from '../data/attributeInfo'
import { attributeLabel, tableSections } from '../data/config'
import type { PlayerRow } from '../data/db'
import { usePlayers } from '../data/hooks'
import { attrColor, attrNumber, formatAttr } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { saveCompareIds } from '../lib/compare'
import { useConfig } from '../lib/config'
import { allRoleFits, roleScore } from '../lib/roleFit'
import { SERIES_COLORS } from '../lib/seriesColors'

const MAX_PLAYERS = 5

export function Compare() {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data } = usePlayers(career.id)
  const [params, setParams] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_PLAYERS)
  const byId = useMemo(() => new Map((data ?? []).map((p) => [p.id, p])), [data])
  const players = ids.map((id) => byId.get(id)).filter((p): p is PlayerRow => !!p)

  const setIds = (next: string[]) => {
    saveCompareIds(next)
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true })
  }

  // Keepers compare on the keeper layout only when everyone selected is a keeper
  const kind =
    players.length > 0 && players.every((p) => isGoalkeeper(p.positions))
      ? 'goalkeepers'
      : 'outfield'
  const sections = tableSections(config.layout, kind)
    .map((s) => ({
      ...s,
      attributes: s.attributes.filter((a) => players.some((p) => p.attributes[a] !== undefined)),
    }))
    .filter((s) => s.attributes.length > 0)

  // Default role: the first player's best natural role
  const firstBest = players[0]
    ? allRoleFits(
        players[0].attributes,
        players[0].positions,
        config.roles,
        config.roleWeights,
      ).find((f) => f.natural)?.role.id
    : undefined
  const [roleChoice, setRoleChoice] = useState<string | null>(null)
  const role = config.roles.find((r) => r.id === (roleChoice ?? firstBest)) ?? config.roles[0]

  const series = players.map((p, i) => ({ name: p.name, color: SERIES_COLORS[i], player: p }))
  const avg = (p: PlayerRow, names: string[]) => {
    const vals = names
      .map((a) => attrNumber(p.attributes[a]))
      .filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  const available = (data ?? [])
    .filter((p) => p.in_squad && !ids.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader title="Compare" subtitle={`Up to ${MAX_PLAYERS} players side by side`} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {series.map((s) => (
          <span
            key={s.player.id}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface pr-1 pl-3 text-sm"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <Link to={`/squad/${s.player.id}`} className="font-medium hover:text-accent">
              {s.name}
            </Link>
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={() => setIds(ids.filter((id) => id !== s.player.id))}
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        ))}
        {ids.length < MAX_PLAYERS && (
          <select
            value=""
            aria-label="Add player to comparison"
            onChange={(e) => e.target.value && setIds([...ids, e.target.value])}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base md:text-sm"
          >
            <option value="">Add player…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {players.length === 0 ? (
        <Placeholder>Pick players above, or use “Compare” on a player's page.</Placeholder>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Radar
              title="Attribute areas (average)"
              axes={sections.map((s) => s.label)}
              series={series.map((s) => ({
                name: s.name,
                color: s.color,
                values: sections.map((sec) => avg(s.player, sec.attributes)),
              }))}
            />
            <div className="grid content-start gap-2">
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Key attributes for</span>
                <select
                  value={role?.id ?? ''}
                  onChange={(e) => setRoleChoice(e.target.value)}
                  className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base md:text-sm"
                >
                  {(['ip', 'oop'] as const).map((phase) => (
                    <optgroup
                      key={phase}
                      label={phase === 'ip' ? 'In possession' : 'Out of possession'}
                    >
                      {config.roles
                        .filter((r) => r.phase === phase)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {role && (
                <Radar
                  title={role.name}
                  axes={role.key.map((a) => attributeLabel(config, a))}
                  series={series.map((s) => ({
                    name: s.name,
                    color: s.color,
                    values: role.key.map((a) => attrNumber(s.player.attributes[a])),
                  }))}
                />
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="sticky left-0 z-[1] bg-surface-2 px-4 py-3 shadow-[inset_-1px_0_0_var(--color-border)]" />
                  {series.map((s) => (
                    <th key={s.player.id} className="min-w-32 px-3 py-3 font-semibold text-text">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-surface tabular-nums">
                <Group label="Profile" span={series.length} />
                <TextRow label="Position" values={players.map((p) => p.positions)} />
                <NumRow label="Age" values={players.map((p) => p.age)} best="none" />
                <TextRow label="Nation" values={players.map((p) => p.nation)} />
                <NumRow label="Height (cm)" values={players.map((p) => p.height_cm)} best="none" />
                <TextRow label="Left foot" values={players.map((p) => p.left_foot)} />
                <TextRow label="Right foot" values={players.map((p) => p.right_foot)} />
                <TextRow label="Personality" values={players.map((p) => p.personality)} />
                <TextRow label="Ability" values={players.map((p) => p.extra.Ability ?? null)} />
                <TextRow label="Potential" values={players.map((p) => p.extra.Potential ?? null)} />
                <TextRow label="Wage" values={players.map((p) => p.extra.Wage ?? null)} />
                <TextRow
                  label="Transfer value"
                  values={players.map((p) => p.extra['Transfer Value'] ?? null)}
                />
                <TextRow
                  label="Contract expires"
                  values={players.map((p) => p.extra.Expires ?? null)}
                />

                <Group label="Roles" span={series.length} />
                {role && (
                  <NumRow
                    label={role.name}
                    values={players.map((p) => roleScore(p.attributes, role, config.roleWeights))}
                  />
                )}
                {(['ip', 'oop'] as const).map((phase) => (
                  <TextRow
                    key={phase}
                    label={
                      phase === 'ip' ? 'Best role in possession' : 'Best role out of possession'
                    }
                    values={players.map((p) => {
                      const f = allRoleFits(
                        p.attributes,
                        p.positions,
                        config.roles,
                        config.roleWeights,
                      ).find((x) => x.natural && x.role.phase === phase)
                      return f ? `${f.role.name} (${f.score})` : null
                    })}
                  />
                ))}

                {sections.map((sec) => (
                  <SectionRows
                    key={sec.label}
                    label={sec.label}
                    attributes={sec.attributes}
                    players={players}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function Group({ label, span }: { label: string; span: number }) {
  return (
    <tr className="border-t border-border bg-surface-2/50">
      <th
        colSpan={span + 1}
        className="sticky left-0 px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {label}
      </th>
    </tr>
  )
}

const labelCell =
  'sticky left-0 z-[1] bg-surface px-4 py-2 whitespace-nowrap text-muted shadow-[inset_-1px_0_0_var(--color-border)]'

function TextRow({ label, values }: { label: string; values: (string | null)[] }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className={clsx(labelCell, 'text-left font-normal')}>
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2 whitespace-nowrap">
          {v ?? '–'}
        </td>
      ))}
    </tr>
  )
}

/** Numeric row: the best value is bold and marked. */
function NumRow({
  label,
  values,
  best = 'high',
}: {
  label: string
  values: (number | null)[]
  best?: 'high' | 'low' | 'none'
}) {
  const known = values.filter((v): v is number => v !== null)
  const top =
    known.length > 1 && best !== 'none'
      ? best === 'high'
        ? Math.max(...known)
        : Math.min(...known)
      : null
  return (
    <tr className="border-t border-border">
      <th scope="row" className={clsx(labelCell, 'text-left font-normal')}>
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className={clsx('px-3 py-2', v !== null && v === top && 'font-semibold')}>
          {v ?? '–'}
          {v !== null && v === top && <span className="ml-1 text-xs text-muted">▲</span>}
        </td>
      ))}
    </tr>
  )
}

function SectionRows({
  label,
  attributes,
  players,
}: {
  label: string
  attributes: string[]
  players: PlayerRow[]
}) {
  const config = useConfig()
  return (
    <>
      <Group label={label} span={players.length} />
      {attributes.map((a) => {
        const nums = players.map((p) => attrNumber(p.attributes[a]))
        const known = nums.filter((v): v is number => v !== null)
        const top = known.length > 1 ? Math.max(...known) : null
        return (
          <tr key={a} className="border-t border-border">
            <th scope="row" className={clsx(labelCell, 'text-left font-normal')}>
              {attributeLabel(config, a)}
            </th>
            {players.map((p, i) => (
              <td
                key={p.id}
                className={clsx(
                  'px-3 py-2',
                  attrColor(p.attributes[a]),
                  nums[i] !== null && nums[i] === top && 'font-semibold',
                )}
              >
                {formatAttr(p.attributes[a])}
                {nums[i] !== null && nums[i] === top && (
                  <span className="ml-1 text-xs text-muted">▲</span>
                )}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
