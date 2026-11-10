import { Link } from 'react-router-dom'
import { PageHeader, Placeholder, Stat } from '../components/ui'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'

export function Dashboard() {
  const career = useCurrentCareer()
  const { data } = usePlayers(career.id)
  const squad = (data ?? []).filter((p) => p.in_squad)
  const ages = squad.map((p) => p.age).filter((a): a is number => a != null)
  const avgAge = ages.length ? (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1) : '–'
  const injured = squad.filter((p) => p.extra.status === 'Inj').length
  const u21 = ages.filter((a) => a <= 21).length

  return (
    <>
      <PageHeader
        title={career.club}
        subtitle={[career.name, career.current_season && `Season ${career.current_season}`]
          .filter(Boolean)
          .join(' · ')}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Squad size" value={squad.length} />
        <Stat label="Average age" value={avgAge} />
        <Stat label="U21 players" value={u21} />
        <Stat label="Injured" value={injured} />
      </div>
      {squad.length === 0 && (
        <div className="mt-6">
          <Placeholder>
            <span className="block">
              Start by{' '}
              <Link to="/import" className="text-accent underline">
                importing your squad
              </Link>
              .
            </span>
          </Placeholder>
        </div>
      )}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Placeholder>Season timeline chart — coming soon</Placeholder>
        <Placeholder>Finances chart — coming soon</Placeholder>
      </div>
    </>
  )
}
