/**
 * What each player trait does (FM27's own tooltip) and what suits it, from FM27's staff advice rules (media.fmf, backroom advice
 * on player traits): the strengths (or weaknesses) that make staff advise teaching a trait, and
 * their lack that makes them advise dropping it. FM does not say what counts as "good".
 * Editable in Settings > Trait guide.
 */
import guide from './fm-trait-guide.json'

export interface TraitGuideEntry {
  trait: string
  /** FM's own tooltip for the trait. */
  about?: string
  suits: string[]
}

export const DEFAULT_TRAIT_GUIDE = guide as TraitGuideEntry[]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** A trait's guide entry, by its name (FM's own text when saved before it was kept). */
export function guideFor(trait: string, list: TraitGuideEntry[]): TraitGuideEntry | null {
  const own = list.find((g) => norm(g.trait) === norm(trait))
  const fm = DEFAULT_TRAIT_GUIDE.find((g) => norm(g.trait) === norm(trait))
  if (!own && !fm) return null
  return { trait, suits: own?.suits ?? fm?.suits ?? [], about: own?.about ?? fm?.about }
}

/** What suits a trait, by its name. */
export const suitsFor = (trait: string, list: TraitGuideEntry[]) =>
  guideFor(trait, list)?.suits ?? null
