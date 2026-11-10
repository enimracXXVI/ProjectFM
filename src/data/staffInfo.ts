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

/** Rating words, worst to best, as FM27 shows staff attributes. */
export const DEFAULT_STAFF_SCALE = [
  'Unsuited',
  'Reasonable',
  'Competent',
  'Average',
  'Good',
  'Very Good',
  'Outstanding',
  'Elite',
]

/** The 1–20 values behind each default rating word. */
export const STAFF_SCALE_RANGES: Record<string, string> = {
  Unsuited: '0–3',
  Reasonable: '4–6',
  Competent: '7–9',
  Average: '10–11',
  Good: '12–14',
  'Very Good': '15–17',
  Outstanding: '18–19',
  Elite: '20',
}

/** Scouting knowledge levels, lowest to highest. */
export const DEFAULT_KNOWLEDGE_LEVELS = [
  'Minimal',
  'Average',
  'Above Average',
  'Very Good',
  'Extensive',
  'Exceptional',
  'Complete',
]

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
