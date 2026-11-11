/**
 * FM personality name from the hidden personality values plus Determination and
 * Leadership. Ranges and overlap rules from a community test published on Reddit
 * (shared by the user); checked against the 24 players of the user's squad export and
 * 6 of the user's scouts (staff have no Leadership, so it is left out for them).
 */
export interface PersonalityValues {
  professionalism?: number
  pressure?: number
  ambition?: number
  temperament?: number
  loyalty?: number
  sportsmanship?: number
  determination?: number
  leadership?: number
}

type Key = keyof PersonalityValues
type Range = [number, number]

/** Columns of the table, in its order: Pro, Pre, Amb, Tem, Loy, Spo, Det, Ldr. */
const COLS: Key[] = [
  'professionalism',
  'pressure',
  'ambition',
  'temperament',
  'loyalty',
  'sportsmanship',
  'determination',
  'leadership',
]

/** One row of the table: ranges in column order, null where the column does not matter. */
const TABLE: [string, (Range | null)[]][] = [
  ['Model Citizen', [[15, 20], [14, 20], [12, 20], [15, 20], [15, 20], [15, 20], [14, 20], null]],
  ['Perfectionist', [[14, 20], null, [14, 20], [1, 9], null, null, [14, 20], null]],
  ['Model Professional', [[20, 20], null, null, [10, 20], null, null, null, [1, 18]]],
  ['Professional', [[18, 20], null, null, [10, 20], null, null, null, [1, 18]]],
  ['Fairly Professional', [[15, 20], null, [6, 20], null, null, null, [1, 14], [1, 18]]],
  ['Resolute', [[15, 20], [1, 16], null, null, null, null, [15, 20], [1, 18]]],
  ['Spirited', [[11, 17], [15, 20], null, [10, 20], null, [1, 14], [1, 17], [1, 18]]],
  ['Driven', [[1, 17], null, [12, 20], null, null, null, [18, 20], [1, 18]]],
  ['Determined', [null, null, [1, 11], null, null, null, [18, 20], [1, 18]]],
  ['Fairly Determined', [[1, 14], [1, 16], null, null, null, null, [15, 17], [1, 18]]],
  ['Iron Willed', [[1, 17], [20, 20], null, null, null, [5, 20], [15, 17], [1, 18]]],
  ['Resilient', [null, [17, 19], null, null, null, null, [15, 17], [1, 18]]],
  ['Charismatic Leader', [null, null, null, [18, 20], null, [18, 20], null, [19, 20]]],
  ['Born Leader', [null, null, null, null, null, null, [20, 20], [20, 20]]],
  ['Leader', [null, null, null, null, null, null, null, [19, 20]]],
  ['Very Ambitious', [null, null, [20, 20], [5, 20], [1, 9], null, [1, 17], null]],
  ['Ambitious', [[1, 17], null, [16, 19], null, [1, 9], null, [1, 17], [1, 18]]],
  ['Fairly Ambitious', [[1, 14], [1, 14], [15, 20], null, null, [1, 17], [1, 17], [1, 18]]],
  ['Fickle', [[1, 17], null, [16, 20], null, [4, 6], null, [1, 17], [1, 18]]],
  ['Mercenary', [[1, 17], null, [16, 20], [5, 20], [1, 3], null, [1, 17], null]],
  ['Jovial', [[1, 10], [15, 20], null, [10, 20], null, [1, 14], [1, 17], null]],
  ['Light-Hearted', [[1, 17], [15, 20], null, [10, 20], null, [15, 20], [1, 17], null]],
  // Devoted (also needs a favourite club and age under 18) is left out: the save does not
  // say which clubs a player favours.
  ['Very Loyal', [[1, 17], null, [6, 7], null, [20, 20], null, [6, 17], [1, 18]]],
  ['Loyal', [[5, 17], null, [6, 7], null, [18, 19], null, [6, 17], null]],
  ['Fairly Loyal', [[1, 14], null, [1, 14], null, [15, 20], null, [1, 14], [1, 18]]],
  ['Balanced', [[1, 14], null, [1, 14], null, [1, 14], [1, 14], [1, 14], [1, 18]]],
  ['Casual', [[2, 4], null, null, [5, 20], null, null, [1, 9], [1, 18]]],
  ['Easily Discouraged', [[5, 17], null, [6, 9], null, null, [1, 17], [1, 1], [1, 18]]],
  ['Honest', [[5, 17], null, null, null, [1, 10], [20, 20], [1, 9], [1, 18]]],
  ['Sporting', [[5, 17], null, [6, 20], null, null, [18, 19], [1, 9], null]],
  ['Fairly Sporting', [[1, 14], null, [1, 14], null, [1, 14], [15, 20], [1, 14], null]],
  ['Low Determination', [[5, 17], null, [6, 9], [5, 20], null, [1, 17], [2, 5], null]],
  ['Low Self-Belief', [[5, 20], [2, 3], [1, 15], [5, 20], null, [1, 17], [1, 9], [1, 18]]],
  ['Realist', [null, null, null, null, null, [2, 4], [11, 17], [1, 18]]],
  ['Slack', [[1, 1], null, null, [5, 20], null, null, [1, 9], null]],
  ['Spineless', [[5, 20], [1, 1], [1, 15], null, null, [1, 17], [1, 9], null]],
  ['Temperamental', [[1, 10], null, null, [1, 4], null, null, null, null]],
  ['Unambitious', [[1, 17], null, [1, 5], null, [11, 20], null, [1, 17], [1, 18]]],
  ['Unsporting', [null, null, null, null, null, [1, 1], [11, 17], [1, 18]]],
]

/** Who overrides whom when values fit more than one personality (from the same test). */
type Rule = { overridesAllExcept: string[] } | { overrides: string[] }
const RULES: Record<string, Rule> = {
  'Model Citizen': { overridesAllExcept: [] },
  Perfectionist: { overridesAllExcept: [] },
  Casual: { overridesAllExcept: [] },
  Temperamental: { overridesAllExcept: [] },
  'Model Professional': { overridesAllExcept: ['Model Citizen'] },
  Professional: { overridesAllExcept: ['Model Citizen', 'Model Professional'] },
  Spirited: {
    overrides: ['Fairly Professional', 'Resolute', 'Fairly Determined', 'Fairly Loyal', 'Balanced'],
  },
  Driven: { overrides: ['Resolute'] },
  Determined: { overrides: ['Resolute'] },
  'Fairly Determined': { overrides: ['Fairly Ambitious'] },
  'Iron Willed': { overrides: ['Spirited', 'Jovial', 'Light-Hearted'] },
  Resilient: { overrides: ['Spirited', 'Jovial', 'Light-Hearted'] },
  'Charismatic Leader': { overridesAllExcept: ['Model Citizen', 'Born Leader', 'Slack'] },
  'Born Leader': { overrides: ['Charismatic Leader', 'Leader'] },
  Leader: {
    overridesAllExcept: [
      'Model Citizen',
      'Perfectionist',
      'Charismatic Leader',
      'Born Leader',
      'Temperamental',
    ],
  },
  'Very Ambitious': { overrides: ambitiousBeats() },
  Ambitious: { overrides: ambitiousBeats() },
  Fickle: { overridesAllExcept: ['Perfectionist', 'Casual', 'Slack', 'Temperamental'] },
  Mercenary: {
    overridesAllExcept: ['Perfectionist', 'Casual', 'Slack', 'Charismatic Leader', 'Leader'],
  },
  Jovial: { overrides: ['Fairly Determined', 'Fairly Loyal', 'Balanced'] },
  'Light-Hearted': {
    overrides: [
      'Fairly Professional',
      'Resolute',
      'Fairly Determined',
      'Fairly Loyal',
      'Fairly Sporting',
    ],
  },
  'Very Loyal': {
    overridesAllExcept: [
      'Devoted',
      'Casual',
      'Sporting',
      'Low Determination',
      'Realist',
      'Slack',
      'Temperamental',
      'Unsporting',
    ],
  },
  Loyal: {
    overridesAllExcept: [
      'Charismatic Leader',
      'Leader',
      'Sporting',
      'Low Determination',
      'Realist',
      'Temperamental',
      'Unsporting',
    ],
  },
  'Easily Discouraged': { overridesAllExcept: ['Temperamental'] },
  Honest: { overrides: ['Fairly Professional', 'Fairly Sporting', 'Light-Hearted'] },
  Sporting: {
    overrides: [
      'Fairly Professional',
      'Light-Hearted',
      'Devoted',
      'Very Loyal',
      'Loyal',
      'Fairly Loyal',
    ],
  },
  'Low Determination': { overridesAllExcept: ['Leader'] },
  'Low Self-Belief': {
    overrides: [
      'Fairly Professional',
      'Fairly Ambitious',
      'Fairly Loyal',
      'Fairly Sporting',
      'Balanced',
    ],
  },
  Realist: {
    overridesAllExcept: [
      'Perfectionist',
      'Model Professional',
      'Professional',
      'Fickle',
      'Mercenary',
      'Temperamental',
      'Unambitious',
    ],
  },
  Slack: { overridesAllExcept: ['Leader'] },
  Unambitious: { overridesAllExcept: ['Casual', 'Slack', 'Temperamental'] },
  Unsporting: {
    overridesAllExcept: ['Perfectionist', 'Model Professional', 'Professional', 'Unambitious'],
  },
}

function ambitiousBeats() {
  return [
    'Fairly Professional',
    'Resolute',
    'Spirited',
    'Fairly Determined',
    'Iron Willed',
    'Resilient',
    'Jovial',
    'Light-Hearted',
    'Honest',
    'Sporting',
  ]
}

function beats(a: string, b: string): boolean {
  const r = RULES[a]
  if (!r) return false
  return 'overrides' in r ? r.overrides.includes(b) : !r.overridesAllExcept.includes(b)
}

/** Every personality whose ranges the values fit. */
export function personalityMatches(v: PersonalityValues): string[] {
  return TABLE.filter(([, ranges]) =>
    ranges.every((r, i) => {
      if (!r) return true
      const x = v[COLS[i]]
      // Staff have no Leadership: treated as not a leader (fits 1–18, not the Leader rows)
      if (x === undefined) return r[0] === 1
      return typeof x === 'number' && x >= r[0] && x <= r[1]
    }),
  ).map(([name]) => name)
}

/** The personality FM shows, or null when the values fit none of the known ones. */
export function personalityName(v: PersonalityValues): string | null {
  const matches = personalityMatches(v)
  if (matches.length <= 1) return matches[0] ?? null
  // Most head-to-head wins; ties keep the table's order
  const score = (a: string) =>
    matches.reduce((s, b) => s + (b !== a && beats(a, b) && !beats(b, a) ? 1 : 0), 0)
  return matches.reduce((best, m) => (score(m) > score(best) ? m : best))
}

/** Every personality name the table knows, plus Devoted. */
export const PERSONALITY_NAMES = [...TABLE.map(([name]) => name), 'Devoted'].sort()

/** The table row for a personality, as [value name, min, max] (for the explainer). */
export function personalityRanges(name: string): [Key, number, number][] {
  const row = TABLE.find(([n]) => n === name)
  if (!row) return []
  return row[1].flatMap((r, i) => (r ? [[COLS[i], r[0], r[1]] as [Key, number, number]] : []))
}
