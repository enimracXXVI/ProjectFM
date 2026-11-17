import { ArrowLeft, Dumbbell, Scale } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FocusSelect } from '../components/FocusSelect'
import { NotesPanel } from '../components/NotesPanel'
import { DevChart } from '../components/profile/DevChart'
import {
  ProfileStrip,
  ProfileTab,
  ProfileTabs,
  type ProfileData,
} from '../components/profile/Profile'
import { StatusChip } from '../components/StatusChip'
import { TeamSelect } from '../components/TeamSelect'
import { Tooltip } from '../components/Tooltip'
import { ClubCrest, Face, Flag } from '../components/Pictures'
import { InfoCard, type InfoRow } from '../components/profile/InfoCard'
import { isoDate } from '../lib/format'
import { Placeholder } from '../components/ui'
import { statGroup } from '../data/columns'
import { eur } from '../lib/money'
import { mediaHandling } from '../lib/mediaHandling'
import { isGoalkeeper } from '../data/attributeInfo'
import { attributeLabel } from '../data/config'
import type { PlayerRow } from '../data/db'
import { usePlayer, useSnapshots } from '../data/hooks'
import { HIDDEN_PLAYER_ATTRS, PERSONALITY_KEYS } from '../import/dump'
import type { AttributeValue } from '../import/types'
import { attrNumber, parsePositionRatings } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { compareUrlWith } from '../lib/compare'
import { useConfig } from '../lib/config'
import { reachBand, reachForHeight } from '../lib/reach'
import { TEXT, useUrlState } from '../lib/urlState'
import { FOCUS_KEY } from '../training/focus'

const HIDDEN_LIST = [...HIDDEN_PLAYER_ATTRS, ...PERSONALITY_KEYS.map(([, label]) => label)]

type Tab = 'profile' | 'development' | 'contract' | 'notes'

export function PlayerDetail() {
  const { id = '' } = useParams()
  const config = useConfig()
  const career = useCurrentCareer()
  const navigate = useNavigate()
  const [tab, setTab] = useUrlState<Tab>('tab', 'profile', TEXT as never)
  const { data: p, isPending, error } = usePlayer(id)
  const { data: allSnapshots } = useSnapshots(id)
  const snapshots = allSnapshots?.filter((s) => Object.keys(s.attributes).length > 0)

  if (isPending) return <p className="text-sm text-muted">Loading…</p>
  if (error || !p) return <Placeholder>{error?.message ?? 'Player not found'}</Placeholder>

  const focus = config.trainingFocuses.find((f) => f.name === p.extra[FOCUS_KEY]) ?? null
  // Compare with the previous import to show development
  const latest = snapshots?.at(-1) ?? null
  const previous = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const status = p.extra.status ? config.statuses[p.extra.status]?.label || p.extra.status : null

  const data: ProfileData = {
    positions: p.positions,
    ratings: parsePositionRatings(p.extra['Reader positions']),
    attributes: p.attributes,
    previous: previous?.attributes ?? null,
    trained: focus?.attributes,
    trainedBy: focus?.name,
    feet: [p.left_foot, p.right_foot],
    info: [
      { label: 'Team', value: <TeamSelect player={p} /> },
      { label: 'Height', value: p.height_cm ? `${p.height_cm} cm` : null },
      { label: 'Personality', value: p.personality },
      ...(status ? [{ label: 'Status', value: status }] : []),
      ...(p.extra.selection ? [{ label: 'Selection', value: p.extra.selection }] : []),
    ],
    summary: [p.height_cm ? `${p.height_cm} cm` : '', p.personality ?? '', status ?? ''],
    traits: p.extra.Traits ?? null,
    hidden: config.showHidden
      ? [
          ...(p.extra.CA ? [{ label: 'CA', value: p.extra.CA, strong: true }] : []),
          ...(p.extra.PA ? [{ label: 'PA', value: p.extra.PA, strong: true }] : []),
          ...HIDDEN_LIST.filter((k) => p.extra[k]).map((k) => ({
            label: k,
            value: Number(p.extra[k]) || p.extra[k],
          })),
        ]
      : null,
    sections: [
      {
        title: 'Training',
        body: (
          <div className="grid gap-1.5 text-sm">
            <label className="flex min-w-0 items-center gap-2">
              <span className="text-muted">Focus</span>
              <FocusSelect player={p} />
            </label>
            {focus && focus.attributes.length > 0 && (
              <span className="flex items-start gap-1 text-xs text-accent">
                <Dumbbell className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {focus.attributes.map((a) => attributeLabel(config, a)).join(', ')}
              </span>
            )}
            <ReachLines height={p.height_cm} attributes={p.attributes} />
          </div>
        ),
      },
    ],
    goalkeeper: isGoalkeeper(p.positions),
  }

  const tabs: [Tab, string][] = [
    ['profile', 'Profile'],
    ['development', 'Development'],
    ['contract', 'Contract & Stats'],
    ['notes', 'Notes'],
  ]

  return (
    <>
      <Link
        to="/squad"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Squad
      </Link>

      <div className="mb-3 flex items-center gap-3">
        <Face id={p.fm_uid} className="size-14 lg:size-16" />
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-lg font-bold text-accent lg:size-14 lg:text-xl">
          {p.squad_number ?? '–'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-2 text-xl font-bold tracking-tight lg:text-2xl">
            {p.name} <StatusChip code={p.extra.status} />
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            {[p.positions, p.age != null ? `${p.age} years` : null].filter(Boolean).join(' · ')}
            {p.nation && (
              <>
                <span>·</span>
                <Flag nation={p.nation} />
                {p.nation}
              </>
            )}
            {!p.in_squad && <span>· Left the club</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(compareUrlWith(p.id))}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface-2"
        >
          <Scale className="size-4" aria-hidden /> <span className="hidden sm:inline">Compare</span>
        </button>
      </div>

      <ProfileStrip data={data} />
      <ProfileTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'profile' && (
        <ProfileTab
          data={data}
          footer={
            latest && (
              <>
                Last updated {new Date(latest.created_at).toLocaleDateString()}
                {latest.season ? ` · season ${latest.season}` : ''}
                {previous &&
                  ` · changes compared with ${new Date(previous.created_at).toLocaleDateString()}`}
              </>
            )
          }
        />
      )}

      {tab === 'development' && (
        <DevChart snapshots={allSnapshots ?? []} goalkeeper={data.goalkeeper} />
      )}

      {tab === 'contract' && (
        <ContractAndStats player={p} club={career.club} season={career.current_season ?? null} />
      )}

      {tab === 'notes' && <NotesPanel scope={{ kind: 'player', id: p.id }} />}
    </>
  )
}

/** Contract keys shown in this order at the top of the Contract box. */
const CONTRACT_FIRST = ['Playing Time', 'Contract Status', 'Wage', 'Expires']

function ContractAndStats({
  player: p,
  club,
  season,
}: {
  player: PlayerRow
  club: string
  season: string | null
}) {
  const config = useConfig()
  const contractCols = config.views.contract.columns
  const labelOf = (key: string) => contractCols.find((c) => c.key === key)?.label || key
  const value =
    p.extra['Transfer Value'] ?? (p.extra.Value ? eur(Number(p.extra.Value)) : undefined)
  const contract: InfoRow[] = [
    {
      label: 'Club',
      value: (
        <>
          <ClubCrest id={p.extra['Club ID']} />
          {club}
        </>
      ),
    },
    { label: 'Squad number', value: p.squad_number },
    ...CONTRACT_FIRST.map((k) => ({ label: labelOf(k), value: p.extra[k] })),
    { label: 'Value', value },
    ...contractCols
      .filter((c) => !CONTRACT_FIRST.includes(c.key) && c.key !== 'Transfer Value')
      .map((c) => ({ label: c.label || c.key, value: p.extra[c.key], hint: c.description })),
  ]
  const personal: InfoRow[] = [
    { label: 'Name', value: p.name },
    { label: 'Age', value: p.age },
    { label: 'Date of birth', value: isoDate(p.extra['Date of birth']) },
    {
      label: 'Nationality',
      value: p.nation && (
        <>
          <Flag nation={p.nation} />
          {p.nation}
        </>
      ),
    },
    {
      label: 'Other nationality',
      value: p.second_nation && (
        <>
          <Flag nation={p.second_nation} />
          {p.second_nation}
        </>
      ),
    },
    { label: 'Personality', value: p.personality },
    {
      label: 'Media handling',
      value: mediaHandling((k) => Number(p.extra[k]) || null, config.mediaHandling),
    },
    { label: 'Height', value: p.height_cm ? `${p.height_cm} cm` : null },
  ]
  // Stats in boxes (General, Attacking…), as set in Settings → Contract & Stats
  const groups = new Map<string, InfoRow[]>()
  // Condition and morale (from the save) lead the General box
  const now: InfoRow[] = [
    { label: 'Condition', value: p.extra.Condition },
    { label: 'Morale', value: p.extra.Morale },
  ].filter((r) => r.value)
  if (now.length) groups.set('General', now)
  for (const c of config.views.stats.columns) {
    if (p.extra[c.key] === undefined) continue
    const g = statGroup(c)
    groups.set(g, [
      ...(groups.get(g) ?? []),
      { label: c.label || c.key, value: p.extra[c.key], hint: c.description },
    ])
  }
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard title="Personal" rows={personal} />
        <InfoCard title="Contract" rows={contract} />
      </div>
      {groups.size > 0 ? (
        <>
          <h2 className="text-sm font-semibold">Stats{season ? ` · ${season}` : ''}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...groups].map(([g, rows]) => (
              <InfoCard key={g} title={g} rows={rows} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No stats yet: import a save or a stats view.</p>
      )}
    </div>
  )
}

/** FM's height tables: where the player's Jumping (and Aerial) Reach sits for his height. */
export function ReachLines({
  height,
  attributes,
}: {
  height: number | null
  attributes: Record<string, AttributeValue>
}) {
  const rows = (
    [
      ['jumping', 'Jumping Reach'],
      ['aerial', 'Aerial Reach'],
    ] as const
  )
    .map(([kind, name]) => {
      const value = attrNumber(attributes[name])
      const range = height ? reachForHeight(kind, height) : null
      return value !== null && range ? { name, value, range } : null
    })
    .filter((x) => x !== null)
  if (!rows.length) return null
  return (
    <>
      {rows.map((r) => (
        <Tooltip
          key={r.name}
          title={`${r.name} for his height`}
          text={`At ${height} cm FM gives ${r.range[0]} (poor leap) to ${r.range[r.range.length - 1]} (good leap). In FM reach comes mostly from height; where a player sits in the range shows whether he jumps better or worse than his height alone would give.`}
        >
          <span tabIndex={0} className="cursor-help text-xs text-muted">
            {r.name} {r.value} at {height} cm: {reachBand(r.value, r.range)}
          </span>
        </Tooltip>
      ))}
    </>
  )
}
