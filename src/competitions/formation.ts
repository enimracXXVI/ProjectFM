/**
 * Formations each team started a match with, from the positions the save records for every
 * player in the match (FM keeps them for the competitions it follows).
 */
import { FORMATIONS } from '../tactics/positions'
import type { PositionCode } from '../tactics/types'
import type { CompetitionsFile, Fixture, PlayerMatch, ReportPlayer } from './types'

/** Lines from the back, for formations that are none of the named ones (wing-backs count in
 * the back line, as FM names its WB formations: 5-2-3 WB). */
const LINES: PositionCode[][] = [
  ['DL', 'DC', 'DR', 'WBL', 'WBR'],
  ['DM'],
  ['ML', 'MC', 'MR'],
  ['AML', 'AMC', 'AMR'],
  ['ST'],
]

const key = (codes: PositionCode[]) => [...codes].sort().join(',')
const NAMED = new Map(Object.entries(FORMATIONS).map(([name, codes]) => [key(codes), name]))

/** A starting eleven's formation: FM's usual name when it is one, else its lines (4-1-4-1). */
export function formationName(codes: PositionCode[]): string | null {
  if (codes.length < 10) return null
  const withKeeper = codes.includes('GK') ? codes : ['GK' as PositionCode, ...codes]
  const named = NAMED.get(key(withKeeper))
  if (named) return named
  const counts = LINES.map((line) => codes.filter((c) => line.includes(c)).length).filter(
    (n) => n > 0,
  )
  return counts.join('-')
}

/** One side's starting positions in a match (rows where the player started and has a position). */
function starters(lines: PlayerMatch[]): PositionCode[] {
  return lines
    .filter((m) => m.pos && !m.entered && (m.minutes ?? 0) > 0)
    .map((m) => m.pos as PositionCode)
}

/**
 * Both teams' starting formations in one match: from the match report's line-ups (both teams,
 * reader 21), else from the players' match records (mostly your own team). Null where the save
 * has no positions.
 */
export function matchFormations(
  file: CompetitionsFile,
  compId: number,
  f: Fixture,
): { home: string | null; away: string | null } {
  const report = file.squads?.find(
    (s) => s.date === f.date && s.home === f.home && s.away === f.away,
  )
  const fromReport = (players: ReportPlayer[] | undefined) =>
    players
      ? formationName(players.filter((p) => p.start && p.pos).map((p) => p.pos as PositionCode))
      : null
  const home = fromReport(report?.homePlayers)
  const away = fromReport(report?.awayPlayers)
  if (home && away) return { home, away }
  const rows = file.playerMatches.filter((m) => m.comp === compId && m.date === f.date)
  // A team's players are the rows whose opponent is the other team
  const side = (opponent: number | null) =>
    formationName(starters(rows.filter((m) => m.opponent === opponent)))
  return { home: home ?? side(f.away), away: away ?? side(f.home) }
}
