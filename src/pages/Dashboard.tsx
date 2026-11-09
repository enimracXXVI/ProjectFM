import { PageHeader, Placeholder, Stat } from '../components/ui'
import { players, scoutTargets } from '../data/mock'
import { useCareer } from '../lib/career'
import { formatMoney } from '../lib/format'

export function Dashboard() {
  const { current } = useCareer()
  const squad = players.filter((p) => p.careerId === current.id)
  const goals = squad.reduce((sum, p) => sum + p.goals, 0)
  const value = squad.reduce((sum, p) => sum + p.value, 0)
  const targets = scoutTargets.filter((t) => t.careerId === current.id && t.status !== 'rejected')

  return (
    <>
      <PageHeader
        title={current.club}
        subtitle={`${current.name} · Season ${current.currentSeason}`}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Squad size" value={squad.length} />
        <Stat label="Goals" value={goals} />
        <Stat label="Squad value" value={formatMoney(value)} />
        <Stat label="Scout targets" value={targets.length} />
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Placeholder>Season timeline chart — coming soon</Placeholder>
        <Placeholder>Finances chart — coming soon</Placeholder>
      </div>
    </>
  )
}
