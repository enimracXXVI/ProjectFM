import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useMemo } from 'react'
import { useUrlState } from '../lib/urlState'
import { Link, useSearchParams } from 'react-router-dom'
import { PlayerSearch } from '../components/PlayerSearch'
import { Radar } from '../components/Radar'
import { PageHeader, Placeholder } from '../components/ui'
import { isGoalkeeper } from '../data/attributeInfo'
import { attributeLabel, tableSections, type AppConfig } from '../data/config'
import type { RoleDef } from '../data/roles'
import { HIDDEN_PLAYER_ATTRS, PERSONALITY_KEYS } from '../import/dump'
import type { PlayerRow } from '../data/db'
import { usePlayers } from '../data/hooks'
import {
  HIGH_IS_BAD,
  attrColor,
  attrNumber,
  formatAttr,
  parsePositionRatings,
  scoreTextColor,
  valueColor,
} from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { saveCompareIds } from '../lib/compare'
import { useConfig } from '../lib/config'
import { allRoleFits, roleScore } from '../lib/roleFit'
import { SERIES_COLORS } from '../lib/seriesColors'
import { byLastName } from '../lib/names'

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
  const [roleChoice, setRoleChoice] = useUrlState<string | null>('roleId', null)
  const role = config.roles.find((r) => r.id === (roleChoice ?? firstBest)) ?? config.roles[0]

  const series = players.map((p, i) => ({ name: p.name, color: SERIES_COLORS[i], player: p }))
  const avg = (p: PlayerRow, names: string[]) => {
    const vals = names
      .map((a) => attrNumber(p.attributes[a]))
      .filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  const available = (data ?? []).filter((p) => p.in_squad && !ids.includes(p.id)).sort(byLastName)

  const rows = buildRows(players, sections, role, config)

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
          <PlayerSearch
            players={available}
            onPick={(p) => setIds([...ids, p.id])}
            detail={(p) => p.positions}
          />
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

          <CompareRows rows={rows} series={series} />
        </>
      )}
    </>
  )
}

type Cell = { text: string; className?: string; best?: boolean }
type Row = { type: 'group'; label: string } | { type: 'row'; label: string; cells: Cell[] }

const textCells = (values: (string | null | undefined)[]): Cell[] =>
  values.map((v) => ({ text: v ?? '–' }))

/** Number cells; the best value is marked. `color` colours each value. */
function numCells(
  values: (number | null)[],
  opts: {
    best?: 'high' | 'low' | 'none'
    color?: (v: number) => string
    format?: (v: number) => string
  } = {},
): Cell[] {
  const best = opts.best ?? 'high'
  const known = values.filter((v): v is number => v !== null)
  const top =
    known.length > 1 && best !== 'none'
      ? best === 'high'
        ? Math.max(...known)
        : Math.min(...known)
      : null
  return values.map((v) =>
    v === null
      ? { text: '–', className: 'text-muted' }
      : {
          text: opts.format ? opts.format(v) : String(v),
          className: opts.color?.(v),
          best: v === top,
        },
  )
}

function buildRows(
  players: PlayerRow[],
  sections: { label: string; attributes: string[] }[],
  role: RoleDef | undefined,
  config: AppConfig,
): Row[] {
  const rows: Row[] = []
  const group = (label: string) => rows.push({ type: 'group', label })
  const row = (label: string, cells: Cell[]) => rows.push({ type: 'row', label, cells })

  group('Profile')
  row('Position', textCells(players.map((p) => p.positions)))
  row(
    'Age',
    numCells(
      players.map((p) => p.age),
      { best: 'none' },
    ),
  )
  row('Nation', textCells(players.map((p) => p.nation)))
  row(
    'Height (cm)',
    numCells(
      players.map((p) => p.height_cm),
      { best: 'none' },
    ),
  )
  row('Left foot', textCells(players.map((p) => p.left_foot)))
  row('Right foot', textCells(players.map((p) => p.right_foot)))
  row('Personality', textCells(players.map((p) => p.personality)))
  for (const [label, key] of [
    ['Wage', 'Wage'],
    ['Transfer value', 'Transfer Value'],
    ['Contract expires', 'Expires'],
  ])
    if (players.some((p) => p.extra[key])) row(label, textCells(players.map((p) => p.extra[key])))

  group('Roles')
  if (role)
    row(
      role.name,
      numCells(
        players.map((p) => roleScore(p.attributes, role, config.roleWeights)),
        { color: scoreTextColor },
      ),
    )
  for (const phase of ['ip', 'oop'] as const) {
    const fits = players.map(
      (p) =>
        allRoleFits(p.attributes, p.positions, config.roles, config.roleWeights).find(
          (x) => x.natural && x.role.phase === phase,
        ) ?? null,
    )
    row(
      phase === 'ip' ? 'Best role in possession' : 'Best role out of possession',
      fits.map((f) =>
        f
          ? { text: `${f.role.name} (${f.score})`, className: scoreTextColor(f.score) }
          : { text: '–' },
      ),
    )
  }

  for (const sec of sections) {
    group(sec.label)
    for (const a of sec.attributes)
      row(
        attributeLabel(config, a),
        numCells(
          players.map((p) => attrNumber(p.attributes[a])),
          { color: (v) => attrColor(v), format: (v) => String(v) },
        ).map((c, i) => ({ ...c, text: formatAttr(players[i].attributes[a]) })),
      )
  }

  const ratings = players.map((p) => parsePositionRatings(p.extra['Reader positions']))
  const positions = POSITION_ORDER.filter((pos) => ratings.some((r) => (r[pos] ?? 0) >= 10))
  if (positions.length) {
    group('Position ratings')
    for (const pos of positions)
      row(
        pos,
        numCells(
          ratings.map((r) => r[pos] ?? null),
          { color: (v) => attrColor(v) },
        ),
      )
  }

  if (config.showHidden) {
    const hidden = ['CA', 'PA', ...HIDDEN_PLAYER_ATTRS, ...PERSONALITY_KEYS.map(([, l]) => l)]
    const shown = hidden.filter((k) => players.some((p) => p.extra[k]))
    if (shown.length) {
      group('Hidden values')
      for (const k of shown) {
        const nums = players.map((p) => (p.extra[k] ? Number(p.extra[k]) : null))
        const scale20 = k !== 'CA' && k !== 'PA'
        row(
          k,
          numCells(nums, {
            best: HIGH_IS_BAD.has(k) ? 'low' : 'high',
            color: scale20 ? (v) => valueColor(k, v) : (v) => attrColor(v / 10),
          }),
        )
      }
    }
  }
  return rows
}

const POSITION_ORDER = [
  'GK',
  'SW',
  'DL',
  'DC',
  'DR',
  'WBL',
  'DM',
  'WBR',
  'ML',
  'MC',
  'MR',
  'AML',
  'AMC',
  'AMR',
  'ST',
]

type Series = { name: string; color: string; player: PlayerRow }

const Best = () => (
  <span className="ml-1 text-xs text-muted" aria-label="best">
    ▲
  </span>
)

/** Phones: names stay on top, every row shows all players side by side. Wider: a table. */
function CompareRows({ rows, series }: { rows: Row[]; series: Series[] }) {
  const cols = { gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }
  return (
    <>
      {/* Phone */}
      <div className="md:hidden">
        <div
          className="sticky -top-4 z-10 -mx-4 grid gap-1 border-b border-border bg-bg px-4 pt-3 pb-2"
          style={cols}
        >
          {series.map((s) => (
            <span
              key={s.player.id}
              className="flex min-w-0 items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.player.name.split(' ').at(-1)}</span>
            </span>
          ))}
        </div>
        {rows.map((r, i) =>
          r.type === 'group' ? (
            <h3
              key={i}
              className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {r.label}
            </h3>
          ) : (
            <div key={i} className="border-b border-border/60 py-1.5">
              <div className="text-xs text-muted">{r.label}</div>
              <div className="grid gap-1 text-center text-sm tabular-nums" style={cols}>
                {r.cells.map((c, j) => (
                  <span key={j} className={clsx('truncate', c.className, c.best && 'font-bold')}>
                    {c.text}
                    {c.best && <Best />}
                  </span>
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Tablet and desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
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
            {rows.map((r, i) =>
              r.type === 'group' ? (
                <tr key={i} className="border-t border-border bg-surface-2/50">
                  <th
                    colSpan={series.length + 1}
                    className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase"
                  >
                    {/* Only the text sticks, so the heading stays put when scrolling sideways */}
                    <span className="sticky left-4">{r.label}</span>
                  </th>
                </tr>
              ) : (
                <tr key={i} className="border-t border-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-surface px-4 py-2 text-left font-normal whitespace-nowrap text-muted shadow-[inset_-1px_0_0_var(--color-border)]"
                  >
                    {r.label}
                  </th>
                  {r.cells.map((c, j) => (
                    <td
                      key={j}
                      className={clsx(
                        'px-3 py-2 whitespace-nowrap',
                        c.className,
                        c.best && 'font-semibold',
                      )}
                    >
                      {c.text}
                      {c.best && <Best />}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
