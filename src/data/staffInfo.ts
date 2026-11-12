/**
 * Staff (scout) attributes as shown on FM27's staff Scouting tab.
 * FM27 shows staff ratings as words; the scale and knowledge levels are editable
 * in the app (Settings → Staff ratings).
 */
import { wordOf } from '../lib/valueWord'

export interface StaffSection {
  label: string
  attributes: string[]
}

const MENTAL: StaffSection = {
  label: 'Mental Attributes',
  attributes: ['Adaptability', 'Authority', 'Determination', 'Motivating', 'People Management'],
}
const KNOWLEDGE: StaffSection = {
  label: 'Knowledge',
  attributes: [
    'Judging Player Ability',
    'Judging Player Potential',
    'Judging Staff Ability',
    'Negotiating',
    'Tactical Knowledge',
  ],
}
const COACHING: StaffSection = {
  label: 'Coaching Attributes',
  attributes: [
    'Attacking',
    'Defending',
    'Fitness',
    'Goalkeeping',
    'Possession',
    'Set Pieces',
    'Tactical',
    'Technical',
    'Working With Youngsters',
  ],
}

export type StaffTab = 'managerial' | 'coaching' | 'scouting' | 'medical'

/** FM27's four staff tabs: each has its own attributes, plus Mental and Knowledge. */
export const STAFF_TABS: [StaffTab, string, StaffSection[]][] = [
  ['managerial', 'Managerial', [COACHING, MENTAL, KNOWLEDGE]],
  ['coaching', 'Coaching', [COACHING, MENTAL, KNOWLEDGE]],
  [
    'scouting',
    'Scouting',
    [{ label: 'Scouting Attributes', attributes: ['Analysing Data'] }, MENTAL, KNOWLEDGE],
  ],
  [
    'medical',
    'Medical',
    [
      { label: 'Medical Attributes', attributes: ['Physiotherapy', 'Sports Science'] },
      MENTAL,
      KNOWLEDGE,
    ],
  ],
]

/** The scouting tab's sections (used where only scouts are shown). */
export const STAFF_SECTIONS: StaffSection[] = STAFF_TABS[2][2]

/** FM's "Key Attributes" for a job, as highlighted on the user's FM staff screens. */
export const KEY_ATTRIBUTES_BY_JOB: Record<string, string[]> = {
  Manager: [
    'Motivating',
    'People Management',
    'Judging Player Ability',
    'Judging Player Potential',
    'Tactical Knowledge',
  ],
  Coach: [
    'Attacking',
    'Defending',
    'Fitness',
    'Tactical',
    'Technical',
    'Authority',
    'Determination',
    'Motivating',
  ],
  'Director of Football': ['Judging Player Ability', 'Judging Player Potential', 'Negotiating'],
  Scout: ['Adaptability', 'Judging Player Ability', 'Judging Player Potential'],
  Physio: ['Physiotherapy'],
}

/** Highlighted as Key Attributes for a scout in FM. */
export const SCOUT_KEY_ATTRIBUTES = KEY_ATTRIBUTES_BY_JOB.Scout

/** The tab FM opens for a job. */
export function tabForJob(job: string | null): StaffTab {
  if (job === 'Manager' || job === 'Assistant Manager') return 'managerial'
  const coaching = [
    'Head of Youth Development',
    'Coach',
    'Goalkeeping Coach',
    'Fitness Coach',
    'Set Piece Coach',
    'Head Performance Analyst',
    'Performance Analyst',
  ]
  if (job && coaching.includes(job)) return 'coaching'
  const medical = [
    'Head Physio',
    'Chief Doctor',
    'Head of Sports Science',
    'Physio',
    'Doctor',
    'Sports Scientist',
  ]
  if (job && medical.includes(job)) return 'medical'
  return 'scouting'
}

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

/** Lowest 1–20 value of each default rating word (Unsuited 0–3, Reasonable 4–6, …). */
export const DEFAULT_STAFF_SCALE_MIN = [0, 4, 7, 10, 12, 15, 18, 20]

/** Rating word for a 1–20 value with the given words and lowest values. */
export function scaleWord(n: number, words: string[], mins: number[]): string {
  let word = words[0] ?? String(n)
  mins.forEach((m, i) => {
    if (n >= m && words[i]) word = words[i]
  })
  return word
}

/** "4–6" ranges for display, from the lowest values. */
export const scaleRanges = (mins: number[]) =>
  mins.map((m, i) => {
    const next = mins[i + 1]
    return next === undefined
      ? m === 20
        ? '20'
        : `${m}–20`
      : next - 1 === m
        ? String(m)
        : `${m}–${next - 1}`
  })

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
  'Outstanding',
  'Complete',
]

export const STAFF_ROLES = ['Scout', 'Chief Scout'] as const

/** Colour for a rating word by its position on the scale (red → amber → white → green). */
export function ratingColor(word: string | undefined, scale: string[]): string {
  const i = word ? scale.indexOf(wordOf(word)) : -1
  if (i < 0) return 'text-muted'
  const t = scale.length > 1 ? i / (scale.length - 1) : 1
  if (t >= 0.85) return 'text-emerald-400'
  if (t >= 0.6) return 'text-lime-300'
  if (t >= 0.4) return 'text-text'
  if (t >= 0.2) return 'text-amber-400'
  return 'text-red-400'
}

/** Reputation levels seen on FM27 staff so far; the field also accepts any other text. */
export const KNOWN_REPUTATIONS = ['Obscure', 'Local', 'Regional', 'National']
