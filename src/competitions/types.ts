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
  /** Matchday squads (Unique IDs) of the club's played games, from FM's match reports. */
  squads?: {
    date: string
    home: number
    away: number
    homeSquad: number[]
    awaySquad: number[]
    homeStats?: RawTeamStats | null
    awayStats?: RawTeamStats | null
    /** Starting XI and bench (Unique IDs) from the match report; names of both squads. */
    homeXI?: number[]
    homeBench?: number[]
    awayXI?: number[]
    awayBench?: number[]
    names?: Record<string, string | null>
  }[]
  /** Injuries recorded for the club's players (no duration in the save). */
  injuries?: {
    uniqueId: number
    date: string | null
    cause: string | null
    severity: string | null
    type: string | null
  }[]
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

/** A team's statistics block from FM's match report, as stored (decoded in matchStats.ts). */
export interface RawTeamStats {
  xg: number
  /** 24 four-byte counts. */
  u: number[]
  /** 36 one-byte counts. */
  b: number[]
  /** 8 two-byte counts, starting with passes attempted and completed. */
  h: number[]
  /** 10 two-byte counts, 96 bytes after h. */
  h104: number[]
}
