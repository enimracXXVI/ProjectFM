import { ArrowLeft, Scale } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NotesPanel } from '../components/NotesPanel'
import {
  ProfileStrip,
  ProfileTab,
  ProfileTabs,
  type ProfileData,
} from '../components/profile/Profile'
import { Placeholder } from '../components/ui'
import { isGoalkeeper } from '../data/attributeInfo'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { compareUrlWith } from '../lib/compare'
import { useConfig } from '../lib/config'
import { eur, eurWagePerYear } from '../lib/money'
import { TEXT, useUrlState } from '../lib/urlState'
import { useWorld } from '../world/hooks'
import { rowToPlayer } from '../world/world'
import { Info, ReachLines } from './PlayerDetail'

type Tab = 'profile' | 'contract' | 'notes'

export function WorldPlayer() {
  const { id = '' } = useParams()
  const career = useCurrentCareer()
  const config = useConfig()
  const navigate = useNavigate()
  const [tab, setTab] = useUrlState<Tab>('tab', 'profile', TEXT as never)
  const { data, isPending, error } = useWorld(career.id)
  const { data: squad } = usePlayers(career.id)

  const p = useMemo(() => {
    const row = data?.file.rows.find((r) => String(r[0]) === id)
    return row && data ? rowToPlayer(data.file, row) : null
  }, [data, id])

  if (isPending) return <p className="text-sm text-muted">Opening the world database…</p>
  if (error) return <Placeholder>{error.message}</Placeholder>
  if (!p) return <Placeholder>Player not found in the world database.</Placeholder>

  const mine = squad?.find((s) => s.fm_uid === p.id)
  const hasReach = p.height !== null && p.attributes['Jumping Reach'] !== undefined

  const profile: ProfileData = {
    positions: p.positions,
    attributes: p.attributes,
    feet: [p.footLeft, p.footRight],
    info: [
      { label: 'Club', value: p.club ?? 'Free agent' },
      { label: 'Division', value: p.division },
      { label: 'Height', value: p.height ? `${p.height} cm` : null },
      { label: 'Personality', value: p.personality },
      { label: 'Value', value: eur(p.value) },
    ],
    summary: [p.height ? `${p.height} cm` : '', p.personality ?? '', eur(p.value) ?? ''],
    traits: p.traits.join(','),
    hidden: config.showHidden
      ? [
          { label: 'CA', value: p.ca, strong: true },
          { label: 'PA', value: p.pa, strong: true },
          ...Object.entries(p.hidden).map(([label, value]) => ({ label, value })),
        ]
      : null,
    sections: hasReach
      ? [
          {
            title: 'Reach',
            body: (
              <div className="grid gap-1">
                <ReachLines height={p.height} attributes={p.attributes} />
              </div>
            ),
          },
        ]
      : [],
    goalkeeper: isGoalkeeper(p.positions),
  }

  const tabs: [Tab, string][] = [
    ['profile', 'Profile'],
    ['contract', 'Contract'],
    ['notes', 'Notes'],
  ]

  return (
    <>
      <Link
        to="/world"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> World
      </Link>

      <div className="mb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{p.name}</h1>
          <p className="text-sm text-muted">
            {[
              p.positions,
              p.age && `${p.age} years`,
              [p.nation, p.secondNation].filter(Boolean).join(' / '),
              p.club,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {mine && (
            <p className="text-sm">
              In your squad:{' '}
              <Link to={`/squad/${mine.id}`} className="text-accent underline">
                open player page
              </Link>
            </p>
          )}
        </div>
        {mine && (
          <button
            type="button"
            onClick={() => navigate(compareUrlWith(mine.id))}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface-2"
          >
            <Scale className="size-4" aria-hidden />{' '}
            <span className="hidden sm:inline">Compare</span>
          </button>
        )}
      </div>

      <ProfileStrip data={profile} />
      <ProfileTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'profile' && <ProfileTab data={profile} />}

      {tab === 'contract' && (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Info label="Club" value={p.club ?? 'Free agent'} />
          <Info label="Value" value={eur(p.value)} />
          <Info label="Wage" value={eurWagePerYear(p.wage)} />
          <Info label="Contract until" value={p.expires} />
          <Info label="Transfer listed" value={p.listed ? 'Yes' : 'No'} />
        </dl>
      )}

      {tab === 'notes' && <NotesPanel scope={{ kind: 'world', id: String(p.id), name: p.name }} />}
    </>
  )
}
