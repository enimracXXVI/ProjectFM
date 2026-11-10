import type { AttributeValue } from '../import/parse'
import { attrNumber } from './attributes'

export interface DevSnapshot {
  player_id: string
  created_at: string
  season: string | null
  attributes: Record<string, AttributeValue>
}

export interface Change {
  name: string
  diff: number
}

export interface DevRow {
  playerId: string
  /** Sum of attribute changes between the first and last import in the window. */
  gain: number
  improved: number
  declined: number
  /** Biggest changes first (gains, then losses). */
  changes: Change[]
  /** Attribute total at each import in the window, oldest first (for the trend line). */
  trend: number[]
  from: string
  to: string
  imports: number
}

const total = (a: Record<string, AttributeValue>, names: string[]) =>
  names.reduce((sum, n) => sum + (attrNumber(a[n]) ?? 0), 0)

/**
 * Development per player over their last `window` imports (all when null).
 * Only attributes present at both ends are compared, so partly scouted or newly
 * added columns don't count as growth.
 */
export function computeDevelopment(snapshots: DevSnapshot[], window: number | null): DevRow[] {
  const byPlayer = new Map<string, DevSnapshot[]>()
  for (const s of snapshots) {
    if (Object.keys(s.attributes).length === 0) continue
    byPlayer.set(s.player_id, [...(byPlayer.get(s.player_id) ?? []), s])
  }

  const rows: DevRow[] = []
  for (const [playerId, list] of byPlayer) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const span = window ? list.slice(-window) : list
    if (span.length < 2) continue
    const first = span[0]
    const last = span[span.length - 1]
    const names = Object.keys(last.attributes).filter((n) => first.attributes[n] !== undefined)
    const changes = names
      .map((name) => ({
        name,
        diff: (attrNumber(last.attributes[name]) ?? 0) - (attrNumber(first.attributes[name]) ?? 0),
      }))
      .filter((c) => c.diff !== 0)
      .sort((a, b) => b.diff - a.diff)
    rows.push({
      playerId,
      gain: changes.reduce((s, c) => s + c.diff, 0),
      improved: changes.filter((c) => c.diff > 0).length,
      declined: changes.filter((c) => c.diff < 0).length,
      changes,
      trend: span.map((s) => total(s.attributes, names)),
      from: first.created_at,
      to: last.created_at,
      imports: span.length,
    })
  }
  return rows.sort((a, b) => b.gain - a.gain)
}
