import { classifyHeader, type ColumnTarget, type CoreField } from './fields'

export interface ParsedCell {
  text: string
  /** Sort value FM View Exporter puts in `data-s`, e.g. "195" or "11|14" for a range. */
  sort: string | null
}

export interface ParsedTable {
  title: string
  viewType: string
  headers: string[]
  rows: ParsedCell[][]
}

/** Attribute value: a number, or a [min, max] range when only partly scouted. */
export type AttributeValue = number | [number, number]

export interface ImportedPlayer {
  fm_uid: number | null
  name: string
  positions: string | null
  squad_number: number | null
  age: number | null
  nation: string | null
  second_nation: string | null
  height_cm: number | null
  left_foot: string | null
  right_foot: string | null
  personality: string | null
  attributes: Record<string, AttributeValue>
  extra: Record<string, string>
}

export interface ParseResult {
  table: ParsedTable
  columns: { header: string; target: ColumnTarget }[]
  players: ImportedPlayer[]
  warnings: string[]
}

export class ImportError extends Error {}

/** Reads the first table of an FM HTML export (Print Screen → Web Page, or FM View Exporter). */
export function parseHtmlTable(html: string): ParsedTable {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) throw new ImportError('No table found in this file. Is it an FM web page export?')

  const headerRow = table.querySelector('thead tr') ?? table.querySelector('tr')
  if (!headerRow) throw new ImportError('The table has no header row.')
  const headers = [...headerRow.querySelectorAll('th, td')].map((c) => clean(c.textContent))

  const bodyRows = [...table.querySelectorAll('tr')].filter((r) => r !== headerRow)
  const rows = bodyRows
    .map((r) =>
      [...r.querySelectorAll('td')].map((c) => ({
        text: clean(c.textContent),
        sort: c.getAttribute('data-s'),
      })),
    )
    .filter((cells) => cells.some((c) => c.text !== ''))

  const title = clean(doc.querySelector('h1')?.textContent ?? doc.title)
  return { title, viewType: detectViewType(title), headers, rows }
}

function detectViewType(title: string): string {
  // "Football Manager 27 - squad" -> "squad"
  const m = title.match(/-\s*([^-]+)$/)
  return (m ? m[1] : title).trim().toLowerCase() || 'unknown'
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

const EMPTY = new Set(['', '-', '–', '—'])

function toInt(cell: ParsedCell): number | null {
  const raw = cell.sort ?? cell.text
  if (EMPTY.has(raw)) return null
  const n = parseInt(raw.split('|')[0], 10)
  return Number.isFinite(n) ? n : null
}

function toText(cell: ParsedCell): string | null {
  return EMPTY.has(cell.text) ? null : cell.text
}

function toAttribute(cell: ParsedCell): AttributeValue | null {
  if (EMPTY.has(cell.text)) return null
  const source = cell.sort ?? cell.text
  const parts = source
    .split(/[|-]/)
    .map((p) => parseInt(p, 10))
    .filter(Number.isFinite)
  if (parts.length === 0) return null
  const [min, max] = [parts[0], parts[parts.length - 1]]
  return min === max ? min : [min, max]
}

const INT_FIELDS = new Set<CoreField>(['fm_uid', 'squad_number', 'age', 'height_cm'])

/** Parses an FM squad/player export into players ready to save. */
export function parsePlayers(html: string): ParseResult {
  const table = parseHtmlTable(html)
  const columns = table.headers.map((header) => ({ header, target: classifyHeader(header) }))
  const warnings: string[] = []

  const nameCol = columns.findIndex((c) => c.target.kind === 'core' && c.target.field === 'name')
  if (nameCol === -1) throw new ImportError('No "Player" or "Name" column found.')
  if (!columns.some((c) => c.target.kind === 'core' && c.target.field === 'fm_uid')) {
    warnings.push(
      'No "Unique ID" column: players will be matched by name, which can create duplicates. Add Unique ID to the view in FM.',
    )
  }

  const players = table.rows.map((cells) => {
    const p: ImportedPlayer = {
      fm_uid: null,
      name: '',
      positions: null,
      squad_number: null,
      age: null,
      nation: null,
      second_nation: null,
      height_cm: null,
      left_foot: null,
      right_foot: null,
      personality: null,
      attributes: {},
      extra: {},
    }
    columns.forEach(({ target }, i) => {
      const cell = cells[i]
      if (!cell) return
      if (target.kind === 'core') {
        const value = INT_FIELDS.has(target.field) ? toInt(cell) : toText(cell)
        ;(p as unknown as Record<string, unknown>)[target.field] = value
      } else if (target.kind === 'attribute') {
        const value = toAttribute(cell)
        if (value !== null) p.attributes[target.name] = value
      } else {
        const value = toText(cell)
        if (value !== null) p.extra[target.key] = value
      }
    })
    return p
  })

  return { table, columns, players: players.filter((p) => p.name), warnings }
}
