import type { CompetitionInfo } from '../competitions/types'
import type { LeagueInfo } from '../import/dump'
import { fmNation } from '../import/save'
import type { WorldFile, WorldRow } from './world'

/**
 * A player's level: his league's strength (average reputation of its clubs) where the save
 * keeps the league's table, otherwise his club's own reputation. 0–100 (reputation / 100).
 */
export function levelOf(
  row: WorldRow,
  leagues: Record<string, LeagueInfo> | undefined,
): { level: number; from: 'league' | 'club' } | null {
  const league = row[28] != null ? leagues?.[String(row[28])] : undefined
  if (league?.rep) return { level: Math.round(league.rep / 100), from: 'league' }
  if (row[27]) return { level: Math.round(row[27] / 100), from: 'club' }
  return null
}

/** The strongest league's level, for weighing (the top league counts in full). */
export function topLevel(file: WorldFile): number {
  const reps = Object.values(file.leagues ?? {}).map((l) => l.rep ?? 0)
  return reps.length ? Math.round(Math.max(...reps) / 100) : 100
}

/**
 * A league's name, led by the country it is based in: "Italy – Serie A". The name is the one
 * set in Settings > FM names (competitions), else the save's, else FM's id ("Italy – #32").
 */
export function leagueName(
  id: number | string,
  info: LeagueInfo | undefined,
  competitions: Record<string, CompetitionInfo>,
): string {
  const named = competitions[String(id)]?.name || info?.name || `#${id}`
  return info?.nation != null ? `${fmNation(info.nation)} – ${named}` : named
}
