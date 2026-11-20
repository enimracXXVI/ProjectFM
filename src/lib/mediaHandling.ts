/**
 * FM's media handling style, worked out from the hidden personality values.
 *
 * The logic is the community "Ultimate Personality / Media Handling Guide" (SI forums, by
 * Noxuous and JAwtunes, updated by BlueZero; the "Hidden Attribute Revealer" sheet), adapted to
 * FM27: FM27 shows the old Volatile and Short-tempered styles as Outspoken and no longer shows
 * Confrontational. Checked on 93 players in FM27 (the user's squad and 65 others, Nov 2026):
 * all 93 exact.
 *
 * In order:
 * 1. Controversy 15+: Outspoken (plus Unflappable with Temperament and Pressure 15+).
 * 2. Pressure and Professionalism 15+: Evasive, plus Reserved (Controversy 5 or less and
 *    Temperament 7–14), Unflappable (Temperament 15+), Outspoken (Temperament 6 or less).
 * 3. Otherwise the extras: Unflappable (Temperament and Pressure 15+), Outspoken (Temperament
 *    6 or less), Reserved (Controversy 5 or less, Professionalism 15+, Temperament 7+). A
 *    "steady" player (Loyalty 11+ and Sportsmanship 12+ or Professionalism 13+) shows only
 *    them; anyone else shows Media-friendly with them.
 * 4. No extras: Level-headed when steady, else Media-friendly.
 * Every threshold is editable in Settings > Media handling.
 */
export interface MediaThresholds {
  /** Controversy from which a player is Outspoken. */
  outspokenControversy: number
  /** Temperament up to which a player is (also) Outspoken (FM's old Volatile / Short-tempered). */
  outspokenTemperament: number
  /** Pressure and Professionalism from which a player is Evasive. */
  evasivePressure: number
  evasiveProfessionalism: number
  /** Controversy up to which, with Professionalism from, a player is Reserved. */
  reservedControversy: number
  reservedProfessionalism: number
  /** Temperament from which a Reserved or Level-headed player must be (below: Outspoken). */
  calmTemperament: number
  /** Temperament for which an Evasive player is also Reserved (up to this). */
  evasiveReservedTemperament: number
  /** Temperament and Pressure from which a player is Unflappable. */
  unflappableTemperament: number
  unflappablePressure: number
  /** Steady (Level-headed, or the extras alone): Loyalty from, and Sportsmanship or Professionalism from. */
  steadyLoyalty: number
  steadySportsmanship: number
  steadyProfessionalism: number
}

export const DEFAULT_MEDIA_THRESHOLDS: MediaThresholds = {
  outspokenControversy: 15,
  outspokenTemperament: 6,
  evasivePressure: 15,
  evasiveProfessionalism: 15,
  reservedControversy: 5,
  reservedProfessionalism: 15,
  calmTemperament: 7,
  evasiveReservedTemperament: 14,
  unflappableTemperament: 15,
  unflappablePressure: 15,
  steadyLoyalty: 11,
  steadySportsmanship: 12,
  steadyProfessionalism: 13,
}

/** What each threshold means, for Settings. */
export const MEDIA_THRESHOLD_TEXT: Record<keyof MediaThresholds, string> = {
  outspokenControversy: 'Outspoken: Controversy from',
  outspokenTemperament: 'Outspoken (FM’s old Volatile / Short-tempered): Temperament up to',
  evasivePressure: 'Evasive: Pressure from',
  evasiveProfessionalism: 'Evasive: Professionalism from',
  reservedControversy: 'Reserved: Controversy up to',
  reservedProfessionalism: 'Reserved: Professionalism from',
  calmTemperament: 'Reserved / Level-headed: Temperament from',
  evasiveReservedTemperament: 'Evasive and Reserved: Temperament up to',
  unflappableTemperament: 'Unflappable: Temperament from',
  unflappablePressure: 'Unflappable: Pressure from',
  steadyLoyalty: 'Level-headed (steady): Loyalty from',
  steadySportsmanship: 'Level-headed (steady): Sportsmanship from (or Professionalism below)',
  steadyProfessionalism: 'Level-headed (steady): Professionalism from (or Sportsmanship above)',
}

/**
 * The player's style(s), from his hidden values by name ("Pressure" → 15).
 * Null when the values are not known (imported before they were kept).
 */
export function mediaHandling(
  value: (label: string) => number | null | undefined,
  t: MediaThresholds = DEFAULT_MEDIA_THRESHOLDS,
): string | null {
  const get = (k: string) => value(k) ?? null
  const con = get('Controversy')
  const tem = get('Temperament')
  const pre = get('Pressure')
  const pro = get('Professionalism')
  if (con === null || tem === null || pre === null || pro === null) return null
  const spo = get('Sportsmanship') ?? 0
  const loy = get('Loyalty') ?? 0
  const unflappable = tem >= t.unflappableTemperament && pre >= t.unflappablePressure
  const hot = tem <= t.outspokenTemperament

  if (con >= t.outspokenControversy)
    return ['Outspoken', ...(unflappable ? ['Unflappable'] : [])].join(', ')
  if (pre >= t.evasivePressure && pro >= t.evasiveProfessionalism) {
    const out = ['Evasive']
    if (
      con <= t.reservedControversy &&
      tem >= t.calmTemperament &&
      tem <= t.evasiveReservedTemperament
    )
      out.push('Reserved')
    if (tem >= t.unflappableTemperament) out.push('Unflappable')
    if (hot) out.push('Outspoken')
    return out.join(', ')
  }
  const extras = [
    ...(unflappable ? ['Unflappable'] : []),
    ...(hot ? ['Outspoken'] : []),
    ...(con <= t.reservedControversy && pro >= t.reservedProfessionalism && tem >= t.calmTemperament
      ? ['Reserved']
      : []),
  ]
  const steady =
    loy >= t.steadyLoyalty && (spo >= t.steadySportsmanship || pro >= t.steadyProfessionalism)
  if (extras.length) return (steady ? extras : ['Media-friendly', ...extras]).join(', ')
  return steady ? 'Level-headed' : 'Media-friendly'
}

/** Settings saved before the thresholds (a list of rules): use the defaults. */
export function isMediaThresholds(v: unknown): v is MediaThresholds {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'outspokenControversy' in v
}
