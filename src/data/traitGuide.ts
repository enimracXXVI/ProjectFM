/**
 * What suits each player trait, from FM27's own staff advice rules (media.fmf, backroom advice
 * on player traits): the strengths (or weaknesses) that make staff advise teaching a trait, and
 * their lack that makes them advise dropping it. FM does not say what counts as "good".
 * Editable in Settings > Trait guide.
 */
import guide from './fm-trait-guide.json'

export interface TraitGuideEntry {
  trait: string
  suits: string[]
}

export const DEFAULT_TRAIT_GUIDE = guide as TraitGuideEntry[]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** What suits a trait, by its name. */
export const suitsFor = (trait: string, list: TraitGuideEntry[]) =>
  list.find((g) => norm(g.trait) === norm(trait))?.suits ?? null
