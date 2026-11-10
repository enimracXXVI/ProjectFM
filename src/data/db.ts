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
  created_at: string
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
