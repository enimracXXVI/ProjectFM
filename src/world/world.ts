/**
 * World database: every player from an FMSuperScout dump in a compact, compressed file
 * (one row per player, attributes in a fixed order) stored in Supabase Storage and cached
 * on each device.
 */
import { ATTRIBUTE_INFO } from '../data/attributeInfo'
import type { Region } from '../data/regions'
import {
  HIDDEN_PLAYER_ATTRS,
  playerFromDump,
  type Dump,
  type DumpMeta,
  type DumpPerson,
} from '../import/dump'
import type { AttributeValue } from '../import/parse'

export const WORLD_VERSION = 1

/** Attribute order of each row's `attrs` array. */
export const WORLD_ATTRS = Object.keys(ATTRIBUTE_INFO)
export const WORLD_HIDDEN = HIDDEN_PLAYER_ATTRS

// Row layout (positions in the array)
export type WorldRow = [
  id: number,
  name: string,
  age: number | null,
  nation: string | null,
  secondNation: string | null,
  club: string | null,
  division: string | null,
  positions: string | null,
  height: number | null,
  ca: number | null,
  pa: number | null,
  /** In the dump's currency (GBP). */
  value: number | null,
  /** Weekly, in the dump's currency (GBP). */
  wage: number | null,
  expires: string | null,
  listed: 0 | 1,
  attrs: number[],
  hidden: number[],
]

export interface WorldFile {
  version: number
  meta: DumpMeta
  attrs: string[]
  hidden: string[]
  rows: WorldRow[]
}

/** FM's "not set" marker for reputation. */
const UNSET_REP = 0xffff

/**
 * Leaves out people FM has generated but not brought into the game yet: no club and an
 * unset reputation (their names are not readable, the dump shows "?"). FMSuperScout's own
 * app hides the same players.
 */
export function isActivePlayer(p: DumpPerson): boolean {
  const rep = (p as unknown as { worldRep?: number }).worldRep
  if (!p.club && rep === UNSET_REP) return false
  return p.name !== '?'
}

/** Builds the world file from a parsed dump. */
export function buildWorld(dump: Dump): WorldFile {
  const rows: WorldRow[] = dump.players.filter(isActivePlayer).map((p) => {
    const ip = playerFromDump(p)
    const num = (v: AttributeValue | undefined) => (typeof v === 'number' ? v : 0)
    const raw = p as unknown as Record<string, unknown>
    return [
      p.id,
      p.name,
      p.age ?? null,
      ip.nation,
      ip.second_nation,
      p.club || null,
      (raw.div as string) || null,
      ip.positions,
      p.height ?? null,
      p.ca ?? null,
      p.pa ?? null,
      typeof raw.value === 'number' ? raw.value : null,
      typeof raw.wage === 'number' ? raw.wage : null,
      (raw.expires as string) || null,
      raw.listed ? 1 : 0,
      WORLD_ATTRS.map((a) => num(ip.attributes[a])),
      WORLD_HIDDEN.map((h) => Number(ip.extra[h] ?? 0)),
    ]
  })
  return { version: WORLD_VERSION, meta: dump.meta, attrs: WORLD_ATTRS, hidden: WORLD_HIDDEN, rows }
}

export interface WorldPlayer {
  id: number
  name: string
  age: number | null
  nation: string | null
  secondNation: string | null
  club: string | null
  division: string | null
  positions: string | null
  height: number | null
  ca: number | null
  pa: number | null
  value: number | null
  wage: number | null
  expires: string | null
  listed: boolean
  attributes: Record<string, AttributeValue>
  hidden: Record<string, number>
}

/** Expands a row into a player object (done on demand: the file holds tens of thousands). */
export function rowToPlayer(file: WorldFile, r: WorldRow): WorldPlayer {
  const attributes: Record<string, AttributeValue> = {}
  file.attrs.forEach((a, i) => {
    if (r[15][i]) attributes[a] = r[15][i]
  })
  const hidden: Record<string, number> = {}
  file.hidden.forEach((h, i) => {
    if (r[16][i]) hidden[h] = r[16][i]
  })
  return {
    id: r[0],
    name: r[1],
    age: r[2],
    nation: r[3],
    secondNation: r[4],
    club: r[5],
    division: r[6],
    positions: r[7],
    height: r[8],
    ca: r[9],
    pa: r[10],
    value: r[11],
    wage: r[12],
    expires: r[13],
    listed: r[14] === 1,
    attributes,
    hidden,
  }
}

// --- Nations ↔ regions ---

const ALIASES: Record<string, string> = {
  ireland: 'republic of ireland',
  uae: 'united arab emirates',
  'timor leste': 'east timor',
}

/** Loose key so "Bosnia & Herzegovina", "St. Barthélemy" and "The Bahamas" match the region lists. */
export function nationKey(name: string): string {
  const k = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^st\.?\s/, 'saint ')
    .replace(/^the\s/, '')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ALIASES[k] ?? k
}

/** Nation (any spelling) → region id. */
export function regionLookup(regions: Region[]): (nation: string | null) => string | null {
  const map = new Map<string, string>()
  for (const r of regions) for (const c of r.countries) map.set(nationKey(c), r.id)
  return (nation) => (nation ? (map.get(nationKey(nation)) ?? null) : null)
}

/** Lower-case text without accents, for searching names. */
export function searchKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
