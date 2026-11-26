import type { PlayerRow } from './db'

/** Squad teams a player can be assigned to (stored in players.extra.team). */
export const TEAMS = [
  ['first', 'First team'],
  ['u21', 'U20'],
  ['u18', 'U18'],
  // Youth candidates: a youth intake's players until they are offered contracts (FM's 4th team)
  ['yc', 'YC'],
  // The club's players out on loan at other clubs (from the save)
  ['loan', 'On loan'],
] as const

export type Team = (typeof TEAMS)[number][0]

export const teamOf = (p: Pick<PlayerRow, 'extra'>): Team =>
  (TEAMS.some(([t]) => t === p.extra.team) ? p.extra.team : 'first') as Team

export const teamLabel = (t: Team) => TEAMS.find(([k]) => k === t)?.[1] ?? 'First team'
