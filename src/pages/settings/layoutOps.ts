import type { AttributeSection } from '../../data/attributeInfo'

/** Columns of sections, as on the FM player screen. Pure helpers for the layout editor. */
export type Columns = AttributeSection[][]

const clone = (c: Columns): Columns => structuredClone(c)

export function hiddenAttributes(columns: Columns, all: string[]): string[] {
  const used = new Set(columns.flat().flatMap((s) => s.attributes))
  return all.filter((a) => !used.has(a))
}

export function renameSection(c: Columns, col: number, sec: number, label: string): Columns {
  const n = clone(c)
  n[col][sec].label = label
  return n
}

export function addSection(c: Columns, col: number): Columns {
  const n = clone(c)
  n[col].push({ label: 'New section', attributes: [] })
  return n
}

export function removeSection(c: Columns, col: number, sec: number): Columns {
  const n = clone(c)
  n[col].splice(sec, 1)
  return n
}

/** Moves a section up/down within its column, or into the previous/next column. */
export function moveSection(
  c: Columns,
  col: number,
  sec: number,
  dir: 'up' | 'down' | 'left' | 'right',
): Columns {
  const n = clone(c)
  const [section] = n[col].splice(sec, 1)
  if (dir === 'up' || dir === 'down') {
    const to = Math.max(0, Math.min(n[col].length, sec + (dir === 'up' ? -1 : 1)))
    n[col].splice(to, 0, section)
  } else {
    const target = Math.max(0, Math.min(n.length - 1, col + (dir === 'left' ? -1 : 1)))
    n[target].push(section)
  }
  return n
}

export function addColumn(c: Columns): Columns {
  return [...clone(c), []]
}

export function removeColumn(c: Columns, col: number): Columns {
  const n = clone(c)
  n.splice(col, 1)
  return n
}

export function moveAttribute(c: Columns, col: number, sec: number, idx: number, delta: -1 | 1) {
  const n = clone(c)
  const list = n[col][sec].attributes
  const to = idx + delta
  if (to < 0 || to >= list.length) return n
  ;[list[idx], list[to]] = [list[to], list[idx]]
  return n
}

/** Removes an attribute from wherever it is and appends it to a section (or hides it). */
export function placeAttribute(
  c: Columns,
  name: string,
  target: { col: number; sec: number } | 'hidden',
): Columns {
  const n = clone(c)
  for (const column of n)
    for (const s of column) s.attributes = s.attributes.filter((a) => a !== name)
  if (target !== 'hidden') n[target.col][target.sec].attributes.push(name)
  return n
}
