import type { AttributeValue } from '../import/parse'

/** Row shapes of the Supabase tables (see supabase/migrations). */

export interface Career {
  id: string
  name: string
  club: string
  nation: string | null
  start_season: string | null
  current_season: string | null
  notes: string | null
  crest_url: string | null
  kit_home_url: string | null
  kit_away_url: string | null
  kit_third_url: string | null
  scouting: ScoutingNetwork
  created_at: string
}

/** Scouting network of a career (careers.scouting). */
export interface ScoutingNetwork {
  /** Scouts allowed by the board, per season. */
  limits?: Record<string, number>
  /** Head of each region: region id → staff id. */
  heads?: Record<string, string>
  /** Scouts: staff id → region and the countries they focus on. */
  scouts?: Record<string, { region: string; countries: string[] }>
}

export interface KnowledgeEntry {
  nation: string
  level: string
}

export interface StaffRow {
  id: string
  career_id: string
  fm_uid: number | null
  name: string
  role: string | null
  age: number | null
  nation: string | null
  personality: string | null
  reputation: string | null
  attributes: Record<string, string>
  knowledge: KnowledgeEntry[]
  notes: string | null
  created_at: string
  /** From the FM save (migration 0007): team, job code and extras such as last name. */
  team?: string | null
  job_code?: number | null
  extra?: Record<string, string>
}

export interface PlayerRow {
  id: string
  career_id: string
  fm_uid: number | null
  name: string
  positions: string | null
  squad_number: number | null
  age: number | null
  nation: string | null
  second_nation: string | null
  height_cm: number | null
  left_foot: string | null
  right_foot: string | null
  personality: string | null
  attributes: Record<string, AttributeValue>
  extra: Record<string, string>
  in_squad: boolean
  updated_at: string
}

export interface SnapshotRow {
  id: string
  player_id: string
  season: string | null
  age: number | null
  attributes: Record<string, AttributeValue>
  extra?: Record<string, string>
  created_at: string
}

export interface ImportRow {
  id: string
  career_id: string
  view_type: string
  file_name: string | null
  season: string | null
  row_count: number
  created_at: string
}
