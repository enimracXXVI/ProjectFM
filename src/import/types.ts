import type { ColumnTarget } from './fields'

/** Attribute value: a number, or a [min, max] range when only partly scouted. */
export type AttributeValue = number | [number, number]

/** A player as an import brings him in, before he is merged with what is stored. */
export interface ImportedPlayer {
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
}

/** The fields an import provides; anything else on a stored player is left as it was. */
export type ImportColumns = { header: string; target: ColumnTarget }[]
