import { Link } from 'react-router-dom'
import { Crest } from '../components/Crest'
import { SectionLinks } from '../components/SectionLinks'
import { Placeholder, Stat } from '../components/ui'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useChecks } from '../lib/useChecks'

export function Dashboard() {
  const career = useCurrentCareer()
  const { data } = usePlayers(career.id)
  const squad = (data ?? []).filter((p) => p.in_squad)
  const checks = useChecks()
  const ages = squad.map((p) => p.age).filter((a): a is number => a != null)
  const avgAge = ages.length ? (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1) : '–'
  const injured = squad.filter((p) => p.extra.status === 'Inj').length
  const u21 = ages.filter((a) => a <= 21).length
  const kits = (
    [
      ['Home', career.kit_home_url],
      ['Away', career.kit_away_url],
      ['Third', career.kit_third_url],
    ] as [string, string | null][]
  ).filter((k): k is [string, string] => !!k[1])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Crest url={career.crest_url} className="size-16" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{career.club}</h1>
          <p className="mt-1 text-sm text-muted">
            {[career.name, career.current_season && `Season ${career.current_season}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {kits.length > 0 && (
          <div className="flex gap-2">
            {kits.map(([label, url]) => (
              <figure key={label} className="grid justify-items-center gap-1">
                <img src={url} alt={label} className="size-14 object-contain" />
                <figcaption className="text-[11px] text-muted">{label}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
      <SectionLinks />
      {checks.total > 0 && (
        <Link
          to="/check"
          className="mb-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm"
        >
          <span>
            <strong>{checks.total}</strong> {checks.total === 1 ? 'thing' : 'things'} the app could
            not work out. Look them up in FM so it learns.
          </span>
          <span className="font-semibold text-amber-300">Check in game →</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Squad size" value={squad.length} />
        <Stat label="Average age" value={avgAge} />
        <Stat label="U20 players" value={u21} />
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
