/**
 * Player names for sorting and short display. The FM save gives first name, last name and
 * nickname ("common name") separately; a player known by a nickname (Pote, Dodo, Beto) is
 * sorted and shown by it, everyone else by last name ("De Gea", "Inao Oulaï").
 * For names without that split (HTML exports, older imports) the last name is guessed:
 * the last word, plus particles in front of it ("De Gea", "van Dijk", "dos Santos").
 */
const PARTICLES = new Set([
  'de',
  'da',
  'di',
  'do',
  'du',
  'del',
  'della',
  'dei',
  'degli',
  'dos',
  'das',
  'van',
  'von',
  'der',
  'den',
  'ter',
  'ten',
  'le',
  'la',
  'el',
  'al',
  'bin',
  'ben',
  'mac',
])

export function guessLastName(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length <= 1) return name.trim()
  let i = words.length - 1
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--
  if (i === 1 && words.length > 2 && PARTICLES.has(words[0].toLowerCase())) i = 0
  return words.slice(i).join(' ')
}

type Named = { name: string; extra?: Record<string, string> }

/** Nickname when the player has one, otherwise last name. */
export function shortName(p: Named): string {
  return p.extra?.['Common name'] || p.extra?.['Last name'] || guessLastName(p.name)
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

/** Alphabetical by last name (or nickname), then full name. */
export function byLastName(a: Named, b: Named): number {
  return collator.compare(shortName(a), shortName(b)) || collator.compare(a.name, b.name)
}

/** Compare two plain names by guessed last name (world database rows). */
export function byLastNameText(a: string, b: string): number {
  return collator.compare(guessLastName(a), guessLastName(b)) || collator.compare(a, b)
}
