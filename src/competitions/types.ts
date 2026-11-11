/** One season of the competitions the first team plays in, as read from the FM save. */
export interface CompetitionsFile {
  version: 1
  /** Managed club (FM club uid in the save) and its name. */
  club: number
  clubName: string
  /** Year the season starts (2026 = 2026/27). */
  season: number | null
  competitions: SaveCompetition[]
  playerMatches: PlayerMatch[]
}

export interface SaveCompetition {
  /** Id inside the save. */
  id: number
  /** FM database id (the in-game ID): stable across saves. */
  databaseId: number | null
  /** True when only the club's own fixtures were kept (very large competitions). */
  onlyMine: boolean
  stages: { id: number; round: number | null; group: number | null; previous: number | null }[]
  fixtures: Fixture[]
}

export interface Fixture {
  stage: number | null
  /** FM round code (cups). */
  round: number | null
  /** Matchday - 1 for leagues; round number for cups. */
  roundIndex: number | null
  date: string | null
  time: string | null
  season: number | null
  home: number | null
  homeName: string | null
  homeShort: string | null
  homeSlot: number | null
  away: number | null
  awayName: string | null
  awayShort: string | null
  awaySlot: number | null
  hg: number | null
  ag: number | null
  played: boolean
  neutral: boolean | null
  stadium: string | null
  leg: number | null
}

export interface PlayerMatch {
  comp: number
  date: string
  uniqueId: number | null
  name: string | null
  /** Player's current club (save uid) and short name. */
  club: number | null
  clubName: string | null
  opponent: number | null
  minutes: number | null
  leftAt: number | null
  goals: number | null
  assists: number | null
  rating: number | null
  position: number | null
  passes: number | null
  passesDone: number | null
}

export type CompetitionKind = 'league' | 'cup' | 'friendlies'

export interface CompetitionInfo {
  name: string
  kind: CompetitionKind
}
