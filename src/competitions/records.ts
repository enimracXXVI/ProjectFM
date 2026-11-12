import type { AppConfig } from '../data/config'
import type { MatchLogRow } from '../tactics/types'
import { lastPlayedMatchday, leagueTable, matchdayCount } from './league'
import type { CompetitionsFile, Fixture } from './types'
import { compInfo, compLabel, cupRounds, fixtureKey, myFixtures, resultFor } from './view'

export interface Record3 {
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
}

const empty = (): Record3 => ({ played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 })

function add(r: Record3, f: Fixture, club: number) {
  const res = resultFor(f, club)
  if (!res) return
  const [gf, ga] = f.home === club ? [f.hg!, f.ag!] : [f.ag!, f.hg!]
  r.played++
  r.gf += gf
  r.ga += ga
  if (res === 'W') r.won++
  else if (res === 'D') r.drawn++
  else r.lost++
}

export interface PlayedGame {
  f: Fixture
  file: CompetitionsFile
  compDbId: number | null
  compName: string
}

/** The club's played games across all seasons and competitions, newest first. */
export function allGames(files: CompetitionsFile[], config: AppConfig): PlayedGame[] {
  return files
    .flatMap((file) =>
      file.competitions.flatMap((c) =>
        myFixtures(file, c)
          .filter((f) => f.played && f.hg !== null)
          .map((f) => ({ f, file, compDbId: c.databaseId, compName: compLabel(config, c) })),
      ),
    )
    .sort((a, b) => (b.f.date ?? '').localeCompare(a.f.date ?? ''))
}

/** Record and games against one club. */
export function headToHead(games: PlayedGame[], opponent: number) {
  const record = empty()
  const list = games.filter((g) => g.f.home === opponent || g.f.away === opponent)
  for (const g of list) add(record, g.f, g.file.club)
  return { record, list }
}

/** Record grouped by a key taken from each game's match log (opponent formation, your tactic). */
export function recordBy(
  games: PlayedGame[],
  log: MatchLogRow[],
  key: (row: MatchLogRow) => string | null,
): [string, Record3][] {
  const byKey = new Map(log.map((r) => [r.match_key, r]))
  const out = new Map<string, Record3>()
  for (const g of games) {
    const row = byKey.get(fixtureKey(g.f))
    const k = row ? key(row) : null
    if (!k) continue
    const r = out.get(k) ?? empty()
    add(r, g.f, g.file.club)
    out.set(k, r)
  }
  return [...out.entries()].sort((a, b) => b[1].played - a[1].played)
}

export interface Achievement {
  season: number | null
  competition: string
  compDbId: number | null
  /** e.g. "Champions", "3rd", "Winners", "Runners-up", "Reached Round of 16". */
  result: string
  trophy: boolean
  finished: boolean
}

const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`

/** Final (or current) standing in every league and cup, per season. */
export function achievements(files: CompetitionsFile[], config: AppConfig): Achievement[] {
  const out: Achievement[] = []
  for (const file of files) {
    for (const c of file.competitions) {
      const info = compInfo(config, c)
      if (!info || info.kind === 'friendlies') continue
      const base = { season: file.season, competition: info.name, compDbId: c.databaseId }
      if (info.kind === 'league') {
        const finished =
          c.fixtures.length > 0 &&
          c.fixtures.every((f) => f.played) &&
          lastPlayedMatchday(c.fixtures) === matchdayCount(c.fixtures)
        const pos = leagueTable(c.fixtures).find((r) => r.club === file.club)?.position
        if (!pos) continue
        out.push({
          ...base,
          result:
            finished && pos === 1
              ? 'Champions'
              : finished
                ? `${ordinal(pos)}`
                : `${ordinal(pos)} (in progress)`,
          trophy: finished && pos === 1,
          finished,
        })
      } else {
        const rounds = cupRounds(c, config.learned.rounds ?? {})
        const mineIn = rounds.filter((r) =>
          r.ties.some((t) => t.a.club === file.club || t.b.club === file.club),
        )
        const last = mineIn.at(-1)
        if (!last) continue
        const tie = last.ties.find((t) => t.a.club === file.club || t.b.club === file.club)!
        const isFinal = last === rounds.at(-1) && last.ties.length === 1
        const done = tie.legs.every((l) => l.played)
        const mineIsA = tie.a.club === file.club
        const won =
          tie.agg && tie.agg[0] !== tie.agg[1]
            ? tie.agg[0] > tie.agg[1] === mineIsA
            : tie.pensWinner != null
              ? tie.pensWinner === file.club
              : null
        if (isFinal && done && won !== null)
          out.push({ ...base, result: won ? 'Winners' : 'Runners-up', trophy: won, finished: true })
        else if (done && won === false)
          out.push({ ...base, result: `Out in ${last.name}`, trophy: false, finished: true })
        else
          out.push({
            ...base,
            result: `${last.name}${done ? '' : ' (to play)'}`,
            trophy: false,
            finished: false,
          })
      }
    }
  }
  return out
}
