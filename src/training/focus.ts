/**
 * FM's individual training focuses and the attributes each one works on.
 *
 * Read from FM27's engine: its table of attribute → focus (the tooltip on Quickness,
 * "Pace, Acceleration", matches it). Focuses listed with no attributes are named by the game
 * but have none in that table. Everything is editable in Settings > Training focuses.
 */
import focuses from './fm-focuses.json'

export interface TrainingFocus {
  /** FM's focus number. */
  code: number
  name: string
  /** Physical, Goalkeeping, Set pieces, Outfield… */
  category: string
  /** Attribute names, as in Settings > Attributes. */
  attributes: string[]
}

export const DEFAULT_TRAINING_FOCUSES = focuses as TrainingFocus[]

/** Focuses that work on an attribute. */
export function focusesFor(attribute: string, list: TrainingFocus[]): TrainingFocus[] {
  return list.filter((f) => f.attributes.includes(attribute))
}
