/**
 * FM's individual training focuses and the attributes each one works on, in FM's order.
 * Everything is editable in Settings > Training focuses.
 */
import focuses from './fm-focuses.json'
import { isGoalkeeper } from '../data/attributeInfo'

export type FocusWho = 'all' | 'outfield' | 'goalkeeper'

export interface TrainingFocus {
  /** FM's focus number. */
  code: number
  name: string
  /** Who FM offers it to. */
  who: FocusWho
  /** Attribute names, as in Settings > Attributes. */
  attributes: string[]
}

export const DEFAULT_TRAINING_FOCUSES = focuses as TrainingFocus[]

export const FOCUS_WHO: [FocusWho, string][] = [
  ['all', 'Everyone'],
  ['outfield', 'Outfield players'],
  ['goalkeeper', 'Goalkeepers'],
]

/** Where a player's chosen focus is kept (in the player's extra fields, untouched by imports). */
export const FOCUS_KEY = 'trainingFocus'

/** The focuses FM offers a player, in FM's order. */
export function focusesForPlayer(positions: string | null, list: TrainingFocus[]) {
  const gk = isGoalkeeper(positions)
  return list.filter((f) => f.who === 'all' || f.who === (gk ? 'goalkeeper' : 'outfield'))
}

/** Focuses that work on an attribute. */
export function focusesFor(attribute: string, list: TrainingFocus[]): TrainingFocus[] {
  return list.filter((f) => f.attributes.includes(attribute))
}

/** Lists saved before focuses had `who` (they had a group): fill it in from FM's list. */
export function withWho(list: (Omit<TrainingFocus, 'who'> & { who?: FocusWho })[]) {
  if (list.every((f) => f.who)) return list as TrainingFocus[]
  const order = DEFAULT_TRAINING_FOCUSES.map((f) => f.name)
  return list
    .map((f) => {
      const { category: _, ...rest } = f as typeof f & { category?: string }
      return {
        ...rest,
        who: f.who ?? DEFAULT_TRAINING_FOCUSES.find((d) => d.name === f.name)?.who ?? 'all',
      }
    })
    .sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99))
}

/** What a focus does for a role: the role's key and preferred attributes it works on. */
export interface FocusForRole {
  focus: TrainingFocus
  /** Higher helps the role more: weak key attributes count double, weak preferred ones once. */
  gain: number
  key: { attribute: string; value: number | null }[]
  preferred: { attribute: string; value: number | null }[]
}

/**
 * The focuses a player can take, ranked by how much they help the role he trains: each of the
 * role's key attributes a focus works on adds twice its room to grow (20 minus his value),
 * each preferred one once. Focuses that work on none of them come last (gain 0).
 */
export function focusesForRole(
  focuses: TrainingFocus[],
  role: { key: string[]; preferred: string[] },
  value: (attribute: string) => number | null,
): FocusForRole[] {
  const part = (f: TrainingFocus, list: string[]) =>
    f.attributes
      .filter((a) => list.includes(a))
      .map((attribute) => ({ attribute, value: value(attribute) }))
      .sort((a, b) => (a.value ?? 99) - (b.value ?? 99))
  return focuses
    .map((focus) => {
      const key = part(focus, role.key)
      const preferred = part(focus, role.preferred)
      const room = (x: { value: number | null }) => (x.value === null ? 0 : 20 - x.value)
      const gain =
        key.reduce((t, x) => t + 2 * room(x), 0) + preferred.reduce((t, x) => t + room(x), 0)
      return { focus, gain, key, preferred }
    })
    .sort((a, b) => b.gain - a.gain || a.focus.name.localeCompare(b.focus.name))
}
