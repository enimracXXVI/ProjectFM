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
    /** Every stat of FM's match stats screen, named (reader 11 and later). */
    homeTeam?: TeamStats | null
    awayTeam?: TeamStats | null
    /** Both matchday squads with each player's stats, from FM's match report (reader 12). */
    homePlayers?: ReportPlayer[]
    awayPlayers?: ReportPlayer[]
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
  /** Shoot-out score (home, away) when the match went to penalties. */
  pens?: [number, number]
  /** Goals and shoot-out kicks in order (reader 11 and later). */
  events?: MatchEvent[]
}

/** [side (0 home, 1 away), type, minute, added minutes, scorer, assister]. */
export type MatchEvent = [number, number, number, number, string | null, string | null]

/** Event types as the save stores them. */
export const EVENT = { goal: 0, ownGoal: 1, penalty: 2, notGoal: 3, kickScored: 4, kickMissed: 5 }

/** One player's line in FM's match report. */
export interface ReportPlayer {
  /** FM Unique ID, null when the save does not name the player. */
  id: number | null
  name: string | null
  /** In the starting XI. */
  start: boolean
  rating: number | null
  goals: number
  assists: number
  /** Minute he came on / went off, null when he did not. */
  on: number | null
  off: number | null
  shots: number
  onTarget: number
  xg: number
  passes: number
  passesDone: number
  tackles: number
  tacklesWon: number
  aerials: number
  headersWon: number
  yellow: number
  red: number
  /** Who he came on for / was replaced by (your own team's matches, reader 13). */
  for?: string | null
  replacedBy?: string | null
}

/** A team's match stats as FM's match stats screen shows them. */
export interface TeamStats {
  shots: number
  shots_on_target: number
  blocked_shots: number
  shots_outside_box: number
  clear_cut_chances: number
  woodwork: number
  fouls_made: number
  offsides: number
  yellow_cards: number
  red_cards: number
  crosses_attempted: number
  crosses_completed: number
  tackles_attempted: number
  tackles_completed: number
  aerial_challenges_attempted: number
  headers_won: number
  distance_km: number
  expected_goals: number
  non_penalty_expected_goals: number
  corners: number
  passes_attempted: number
  passes_completed: number
  final_third_passes: number
  progressive_passes: number | null
  possession_percent: number
  ball_distribution_percent: number
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
