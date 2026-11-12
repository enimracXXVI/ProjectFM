import type { SaveRole } from './saveRoles'

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
  /** Role signatures from the save (to remember roles the user sets). */
  ipSig?: string | null
  oopSig?: string | null
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
    instructionCodes?: number[]
    slots: {
      number: number
      position: PositionCode | null
      positionOop: PositionCode | null
      rawPosition: number | null
      ipRole?: SaveRole
      oopRole?: SaveRole
    }[]
  }[]
  selection: { slot: number; substitute: boolean; uniqueId: number | null; name: string | null }[]
}
