/** Name search helpers: accent- and case-insensitive. */

/** Lower case without accents, so "dragusin" finds "Drăgușin". */
export const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface SearchItem {
  id: string
  name: string
  /** Small text after the name (positions, club…). */
  detail?: string | null
  /** Folded name, worked out once for long lists. */
  key?: string
  /** Heading of the group this item is listed under (e.g. Your squad, World). */
  group?: string
}

/** Folds names once, for long lists (thousands of players). */
export const searchItems = <T extends SearchItem>(items: T[]) =>
  items.map((i) => ({ ...i, key: i.key ?? fold(i.name) }))
