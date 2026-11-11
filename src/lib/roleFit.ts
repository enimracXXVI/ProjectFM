import { ATTRIBUTE_GROUPS } from '../import/fields'
import type { AttributeValue } from '../import/parse'
import type { RoleDef } from '../data/roles'
import { attrNumber, scoreBarColor } from './attributes'

/**
 * Role fit: how well a player suits a role, 0–100.
 *
 * Each attribute gets a weight = importance tier × role factor (key, preferred or other).
 * The score is the weighted average of the player's attributes, scaled so that a player
 * with 1 everywhere scores 0 and a player with 20 everywhere scores 100.
 * Attributes the player has no value for are left out of the average.
 */

export interface Tier {
  name: string
  weight: number
  attributes: string[]
}

export interface RoleWeights {
  /** Importance tiers for outfield roles; attributes in no tier use `defaultWeight`. */
  outfield: Tier[]
  /** Importance tiers for goalkeeper roles. */
  goalkeeper: Tier[]
  defaultWeight: number
  key: number
  preferred: number
  /** Factor for attributes that are neither key nor preferred for the role. */
  other: number
}

/** Starting point only (not from FM); every number is editable in Settings → Role weights. */
export const DEFAULT_ROLE_WEIGHTS: RoleWeights = {
  outfield: [
    {
      name: 'Very high',
      weight: 5,
      attributes: ['Acceleration', 'Pace'],
    },
    {
      name: 'High',
      weight: 3,
      attributes: [
        'Agility',
        'Anticipation',
        'Balance',
        'Concentration',
        'Decisions',
        'Finishing',
        'Jumping Reach',
      ],
    },
    {
      name: 'Medium',
      weight: 2,
      attributes: [
        'Composure',
        'Determination',
        'Dribbling',
        'First Touch',
        'Passing',
        'Stamina',
        'Strength',
        'Technique',
        'Vision',
        'Work Rate',
      ],
    },
  ],
  goalkeeper: [
    {
      name: 'High',
      weight: 3,
      attributes: ['Aerial Reach', 'Agility', 'Handling', 'Positioning', 'Reflexes'],
    },
    {
      name: 'Medium',
      weight: 2,
      attributes: [
        'Anticipation',
        'Command Of Area',
        'Concentration',
        'Decisions',
        'Kicking',
        'One On Ones',
      ],
    },
  ],
  defaultWeight: 1,
  key: 2,
  preferred: 1.25,
  other: 0.5,
}

const GK_ONLY = new Set<string>(ATTRIBUTE_GROUPS.Goalkeeping)
const OUTFIELD_ONLY = new Set<string>([
  'Corners',
  'Crossing',
  'Dribbling',
  'Finishing',
  'Heading',
  'Long Shots',
  'Long Throws',
  'Marking',
  'Penalty Taking',
  'Tackling',
])

export const isGoalkeeperRole = (role: RoleDef) => role.positions.includes('GK')

/**
 * Score 0–100 for one player in one role, or null when the player has too few of the
 * role's attributes to judge (fewer than half of its key attributes).
 */
export function roleScore(
  attributes: Record<string, AttributeValue>,
  role: RoleDef,
  weights: RoleWeights,
): number | null {
  const gk = isGoalkeeperRole(role)
  const tiers = gk ? weights.goalkeeper : weights.outfield
  const tierOf = new Map(tiers.flatMap((t) => t.attributes.map((a) => [a, t.weight] as const)))
  const key = new Set(role.key)
  const preferred = new Set(role.preferred)

  const knownKeys = role.key.filter((a) => attrNumber(attributes[a]) !== null).length
  if (role.key.length && knownKeys < role.key.length / 2) return null

  let sum = 0
  let total = 0
  for (const [name, value] of Object.entries(attributes)) {
    // Keepers are judged without outfield-only skills and vice versa
    if (gk ? OUTFIELD_ONLY.has(name) : GK_ONLY.has(name)) continue
    const v = attrNumber(value)
    if (v === null) continue
    const factor = key.has(name)
      ? weights.key
      : preferred.has(name)
        ? weights.preferred
        : weights.other
    const w = (tierOf.get(name) ?? weights.defaultWeight) * factor
    sum += w * v
    total += w
  }
  if (total === 0) return null
  return Math.round(((sum / total - 1) / 19) * 100)
}

/** Expands FM position text: "D/WB (RL), M/AM (R)" → D (R), D (L), WB (R), WB (L), M (R), AM (R). */
export function parsePositions(text: string | null | undefined): string[] {
  if (!text) return []
  const out: string[] = []
  for (const part of text.split(/,\s*/)) {
    const m = part.trim().match(/^([A-Z/]+)(?:\s*\(([RLC]+)\))?$/)
    if (!m) continue
    const bases = m[1].split('/')
    const sides = m[2] ? m[2].split('') : ['']
    for (const b of bases) {
      for (const s of sides) out.push(s ? `${b} (${s})` : b)
    }
  }
  return [...new Set(out)]
}

export interface RoleFit {
  role: RoleDef
  score: number
  /** The player can play one of the role's positions. */
  natural: boolean
}

/** Scores for every role (best first). */
export function allRoleFits(
  attributes: Record<string, AttributeValue>,
  positions: string | null | undefined,
  roles: RoleDef[],
  weights: RoleWeights,
): RoleFit[] {
  const mine = new Set(parsePositions(positions))
  return roles
    .map((role) => ({
      role,
      score: roleScore(attributes, role, weights),
      natural: role.positions.some((p) => mine.has(p)),
    }))
    .filter((f): f is RoleFit => f.score !== null)
    .sort((a, b) => b.score - a.score)
}

/** Colour for a 0–100 role score: same colours as attributes (score 0–100 = 1–20). */
export const scoreColor = scoreBarColor
