/**
 * FM's media handling style, worked out from the hidden personality values. Rules found by
 * matching 93 players' styles in FM27 (the user's squad and 65 others, Nov 2026) with their
 * values in the save. Each rule that fits adds a style (FM can show two).
 * Level-headed and Media-friendly: Level-headed needs Loyalty 11+, so a player matching no
 * rule with Loyalty 10 or less is Media-friendly; above that the save cannot tell them apart.
 * Editable in Settings > Media handling.
 */
export const MEDIA_KEYS = [
  'pressure',
  'professionalism',
  'temperament',
  'controversy',
  'sportsmanship',
  'ambition',
  'loyalty',
  'adaptability',
] as const
export type MediaKey = (typeof MEDIA_KEYS)[number]

/** The hidden value each key reads (as stored with players). */
export const MEDIA_KEY_LABELS: Record<MediaKey, string> = {
  pressure: 'Pressure',
  professionalism: 'Professionalism',
  temperament: 'Temperament',
  controversy: 'Controversy',
  sportsmanship: 'Sportsmanship',
  ambition: 'Ambition',
  loyalty: 'Loyalty',
  adaptability: 'Adaptability',
}

export interface MediaRule {
  name: string
  /** Value ranges (inclusive) the player needs; keys left out do not matter. */
  ranges: Partial<Record<MediaKey, [number, number]>>
  /** False while a rule rests on too few players: shown with (?). */
  confirmed: boolean
}

export const DEFAULT_MEDIA_RULES: MediaRule[] = [
  // 4 of 93 players, no exceptions
  { name: 'Evasive', ranges: { pressure: [15, 20], professionalism: [15, 20] }, confirmed: true },
  // 10 of 93 players, no exceptions
  {
    name: 'Reserved',
    ranges: { professionalism: [15, 20], controversy: [1, 5] },
    confirmed: true,
  },
  // 3 of 93 players, no exceptions
  { name: 'Outspoken', ranges: { temperament: [1, 7] }, confirmed: true },
  // One player only (Harry Amass): needs more examples
  { name: 'Unflappable', ranges: { pressure: [15, 20], temperament: [15, 20] }, confirmed: false },
]

/** Shown when no rule fits and Loyalty does not settle it. */
export const MEDIA_FALLBACK = 'Level-headed or Media-friendly'

/**
 * Level-headed needs Loyalty 11 or more (all 36 Level-headed players of the 93 checked, and
 * the Steam guide's FM26 ranges): with no rule fitting, Loyalty 10 or less means Media-friendly.
 */
export const LEVEL_HEADED_MIN_LOYALTY = 11

/**
 * The player's style(s), from his hidden values by name ("Pressure" → 15).
 * Null when the values are not known (imported before they were kept).
 */
export function mediaHandling(
  value: (label: string) => number | null | undefined,
  rules: MediaRule[],
): string | null {
  const v = Object.fromEntries(
    MEDIA_KEYS.map((k) => [k, value(MEDIA_KEY_LABELS[k]) ?? null]),
  ) as Record<MediaKey, number | null>
  if (v.pressure === null && v.professionalism === null && v.temperament === null) return null
  const styles = rules
    .filter((r) =>
      Object.entries(r.ranges).every(([k, range]) => {
        const x = v[k as MediaKey]
        return x !== null && range && x >= range[0] && x <= range[1]
      }),
    )
    .map((r) => (r.confirmed ? r.name : `${r.name} (?)`))
  if (styles.length) return styles.join(', ')
  return v.loyalty !== null && v.loyalty < LEVEL_HEADED_MIN_LOYALTY
    ? 'Media-friendly'
    : MEDIA_FALLBACK
}
