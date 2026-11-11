import { Link } from 'react-router-dom'
import { useAllCompetitions } from '../competitions/hooks'
import { allGames, headToHead } from '../competitions/records'
import { fixtureKey, resultFor, scoreText } from '../competitions/view'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { ResultBadge } from '../pages/competitionParts'
import { Card } from './ui'

/** Your record against one club, across every saved season and competition. */
export function HeadToHead({ opponent, name }: { opponent: number; name: string }) {
  const career = useCurrentCareer()
  const config = useConfig()
  const { data } = useAllCompetitions(career.id)
  const { record: r, list } = headToHead(allGames(data, config), opponent)
  if (!list.length) return null
  return (
    <Card>
      <h2 className="mb-2 font-semibold">Head-to-head with {name}</h2>
      <p className="mb-2 text-sm">
        Played {r.played} · <span className="text-emerald-400">W {r.won}</span> · D {r.drawn} ·{' '}
        <span className="text-red-400">L {r.lost}</span> · goals {r.gf}–{r.ga}
      </p>
      <ul className="grid gap-0.5 text-sm">
        {list.map((g) => (
          <li key={fixtureKey(g.f)}>
            <Link
              to={`/competitions/${g.compDbId}/match/${fixtureKey(g.f)}?season=${g.file.season ?? ''}`}
              className="flex min-h-9 items-center gap-2 rounded-lg px-1 hover:bg-surface-2"
            >
              <span className="w-24 shrink-0 text-xs text-muted">{g.f.date}</span>
              <span className="min-w-0 flex-1 truncate">
                {g.f.homeShort} {scoreText(g.f)} {g.f.awayShort}
              </span>
              <span className="hidden text-xs text-muted sm:inline">{g.compName}</span>
              <ResultBadge r={resultFor(g.f, g.file.club)} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
