const KEY = 'projectfm.compare'

/** The last comparison, so "Compare" on a player page adds to it. */
export function loadCompareIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function saveCompareIds(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable: the comparison still works from the URL
  }
}

/** Adds a player (max 5, newest kept) and returns the URL of the comparison. */
export function compareUrlWith(id: string): string {
  const ids = [...loadCompareIds().filter((x) => x !== id), id].slice(-5)
  saveCompareIds(ids)
  return `/compare?ids=${ids.join(',')}`
}
