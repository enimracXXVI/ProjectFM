/**
 * Staff (scout) attributes as shown on FM27's staff Scouting tab.
 * FM27 shows staff ratings as words; the scale and knowledge levels are editable
 * in the app (Settings → Staff ratings).
 */

export interface StaffSection {
  label: string
  attributes: string[]
}

export const STAFF_SECTIONS: StaffSection[] = [
  {
    label: 'Scouting Attributes',
    attributes: ['Analysing Data'],
  },
  {
    label: 'Mental Attributes',
    attributes: ['Adaptability', 'Authority', 'Determination', 'Motivating', 'People Management'],
  },
  {
    label: 'Knowledge',
    attributes: [
      'Judging Player Ability',
      'Judging Player Potential',
      'Judging Staff Ability',
      'Negotiating',
      'Tactical Knowledge',
    ],
  },
]

/** Highlighted as Key Attributes for a scout in FM. */
export const SCOUT_KEY_ATTRIBUTES = [
  'Adaptability',
  'Judging Player Ability',
  'Judging Player Potential',
]

/**
 * Rating words, worst to best. Only the words seen in FM so far; the order is
 * unconfirmed and can be fixed in Settings → Staff ratings.
 */
export const DEFAULT_STAFF_SCALE = [
  'Unsuited',
  'Average',
  'Reasonable',
  'Competent',
  'Good',
  'Very Good',
  'Outstanding',
]

/** Scouting knowledge levels, lowest to highest. Only "Complete" is confirmed so far. */
export const DEFAULT_KNOWLEDGE_LEVELS = ['Complete']

export const STAFF_ROLES = ['Scout', 'Chief Scout'] as const

/** Colour for a rating word by its position on the scale (red → amber → white → green). */
export function ratingColor(word: string | undefined, scale: string[]): string {
  const i = word ? scale.indexOf(word) : -1
  if (i < 0) return 'text-muted'
  const t = scale.length > 1 ? i / (scale.length - 1) : 1
  if (t >= 0.85) return 'text-emerald-400'
  if (t >= 0.6) return 'text-lime-300'
  if (t >= 0.4) return 'text-text'
  if (t >= 0.2) return 'text-amber-400'
  return 'text-red-400'
}
