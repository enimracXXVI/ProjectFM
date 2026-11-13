import type { Side } from './fm'

/** FM position codes used for tactic slots. */
export type PositionCode =
  | 'GK'
  | 'DL'
  | 'DC'
  | 'DR'
  | 'WBL'
  | 'WBR'
  | 'DM'
  | 'ML'
  | 'MC'
  | 'MR'
  | 'AML'
  | 'AMC'
  | 'AMR'
  | 'ST'

export interface TacticSlot {
  /** Position in possession. */
  position: PositionCode | null
  /** Position out of possession (same as in possession when not set). */
  positionOop?: PositionCode | null
  /** In-possession role id from Settings → Roles. */
  role?: string | null
  /** Out-of-possession role id. */
  roleOop?: string | null
  /** Side of a paired position (two or three DCs, DMs…) as the save stores it. */
  side?: Side | null
  sideOop?: Side | null
  /** Player instruction codes in possession and out of possession. */
  pi?: number[]
  piOop?: number[]
  /** FM position (id) to mark, for "Mark specific position". */
  markOop?: string | null
  /** Role numbers from the save that match no role in Settings (to check in game). */
  unknownRole?: string | null
  unknownRoleOop?: string | null
  /** Preferred player (ProjectFM player id). */
  player?: string | null
}

export interface TacticRow {
  id: string
  career_id: string
  name: string
  style: string | null
  mentality: string | null
  slots: TacticSlot[]
  /** Team instructions: { team: option codes } (older tactics: words by phase). */
  instructions: Record<string, unknown>
  notes: string | null
  save_index: number | null
  created_at: string
  updated_at: string
}

export interface MatchLogRow {
  id: string
  career_id: string
  match_key: string
  competition_db_id: number | null
  season: number | null
  tactic_id: string | null
  opponent_formation: string | null
  opponent_style: string | null
  opponent_mentality: string | null
  notes: string | null
}

/** Tactics and selection read from the save. */
export interface SaveTactics {
  tactics: {
    index: number
    name: string
    style: string | null
    mentality: string | null
    /** The save's 19 team instruction bytes (mentality is byte 2, the instructions 6–17). */
    instructionCodes?: number[]
    slots: {
      number: number
      position: PositionCode | null
      positionOop: PositionCode | null
      /** Stored position numbers (with the side flags). */
      mask?: number | null
      maskOop?: number | null
      /** Stored role numbers and player instruction bits (64-bit, as text). */
      role?: string | null
      roleOop?: string | null
      pi?: string | null
      piOop?: string | null
      markOop?: number | null
    }[]
  }[]
  selection: { slot: number; substitute: boolean; uniqueId: number | null; name: string | null }[]
}
