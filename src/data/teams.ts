import type { PlayerRow } from './db'

/** Squad teams a player can be assigned to (stored in players.extra.team). */
export const TEAMS = [
  ['first', 'First team'],
  ['u21', 'U21'],
  ['u18', 'U18'],
] as const

export type Team = (typeof TEAMS)[number][0]

export const teamOf = (p: Pick<PlayerRow, 'extra'>): Team =>
  (TEAMS.some(([t]) => t === p.extra.team) ? p.extra.team : 'first') as Team

export const teamLabel = (t: Team) => TEAMS.find(([k]) => k === t)?.[1] ?? 'First team'
