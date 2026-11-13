/**
 * FM's tactic codes: how the save and FM's tactic files (.fmf) store mentality, positions,
 * roles, team instructions and player instructions, and which roles and player instructions
 * FM allows where.
 *
 * Every code here is data the user can change in Settings (for a game update or the next FM);
 * the defaults are FM27's, from the user's own FM Tactic Generator (fm-defaults.json).
 */
import defaults from './fm-defaults.json'
import type { RoleDef, RolePhase } from '../data/roles'
import type { PositionCode, SaveTactics, TacticSlot } from './types'

export type Side = 'L' | 'C' | 'R'

/** One option of an instruction and the code FM stores for it (0 = nothing set). */
export interface FmOption {
  label: string
  code: number
  /** The option needs a target: an opposition position (set here) or a player (set in FM). */
  target?: 'position' | 'player'
}

/** A team or player instruction and its options, in FM's order. */
export interface FmInstruction {
  phase: RolePhase
  name: string
  options: FmOption[]
  /** Code of the option a new tactic starts with (team instructions; 0 when not set). */
  default?: number
}

/** One FM tactic position: the app's position, its side when FM has a pair or trio, its code. */
export interface FmPosition {
  id: string
  position: PositionCode
  side: Side | null
  mask: number
}

/** Shape conditions FM puts on some roles at some positions. */
export type RoleCondition = 'back-three' | 'two-dms'

export const CONDITION_TEXT: Record<RoleCondition, string> = {
  'back-three': 'only with three or more centre-backs',
  'two-dms': 'only with two or more DMs',
}

/** FM's codes for one role. */
export interface RoleFm {
  /** The number the save and tactic files store for the role (as text: it is 64-bit). */
  code?: string
  /** FM positions where FM offers the role, with any shape condition. */
  where?: { pos: string; when?: RoleCondition }[]
  /** Player instructions FM offers for the role at each FM position (option codes). */
  instructions?: Record<string, { allowed: number[]; forced: number[] }>
}

/** Game-wide codes: mentalities (in code order 1, 2, …), positions and role code mask. */
export interface FmCodes {
  game: string
  mentalities: string[]
  positions: FmPosition[]
  /** Bits of a stored role number that name the role (the rest are FM's own flags). */
  roleCodeMask: string
  /** Team instruction codes FM does not allow together. */
  conflicts: [number, number][]
}

type Defaults = {
  game: string
  mentalities: string[]
  roleCodeMask: string
  positions: FmPosition[]
  teamInstructions: FmInstruction[]
  playerInstructions: FmInstruction[]
  roles: Record<string, RoleFm>
}
const D = defaults as unknown as Defaults

export const DEFAULT_FM_CODES: FmCodes = {
  game: D.game,
  mentalities: D.mentalities,
  positions: D.positions,
  roleCodeMask: D.roleCodeMask,
  // Overlap and underlap on the same flank (from the user's FM Tactic Generator)
  conflicts: [
    [25, 28],
    [25, 29],
    [25, 30],
    [26, 28],
    [26, 29],
    [27, 28],
    [27, 30],
  ],
}
export const DEFAULT_TEAM_INSTRUCTIONS: FmInstruction[] = D.teamInstructions
export const DEFAULT_PLAYER_INSTRUCTIONS: FmInstruction[] = D.playerInstructions
export const DEFAULT_ROLE_FM: Record<string, RoleFm> = D.roles

/** Is this a list of instructions in the current shape (options with codes)? */
export function isInstructionList(v: unknown): v is FmInstruction[] {
  return (
    Array.isArray(v) &&
    v.every(
      (d) =>
        d &&
        typeof d.name === 'string' &&
        Array.isArray(d.options) &&
        d.options.every((o: unknown) => !!o && typeof (o as FmOption).code === 'number'),
    )
  )
}

/** Positions that FM splits into left / centre / right when two or three are used. */
const PAIRED: PositionCode[] = ['DC', 'DM', 'MC', 'AMC', 'ST']

/**
 * Side of each slot in one phase: the side read from the save when there is one, otherwise
 * by order (two: left, right; three: left, centre, right; one: centre).
 */
export function slotSides(
  positions: (PositionCode | null)[],
  stored: (Side | null | undefined)[] = [],
): (Side | null)[] {
  const out: (Side | null)[] = positions.map(() => null)
  for (const base of PAIRED) {
    const idx = positions.flatMap((p, i) => (p === base ? [i] : []))
    if (!idx.length) continue
    const fromSave = idx.map((i) => stored[i] ?? null)
    if (fromSave.every(Boolean) && new Set(fromSave).size === idx.length) {
      idx.forEach((i, k) => (out[i] = fromSave[k]))
      continue
    }
    const order: Side[] = idx.length === 1 ? ['C'] : idx.length === 2 ? ['L', 'R'] : ['L', 'C', 'R']
    idx.forEach((i, k) => (out[i] = order[k] ?? null))
  }
  return out
}

export const posOf = (s: TacticSlot, phase: RolePhase) =>
  phase === 'ip' ? s.position : (s.positionOop ?? s.position)
export const sideOf = (s: TacticSlot, phase: RolePhase) =>
  phase === 'ip' ? s.side : (s.sideOop ?? s.side)
export const roleIdOf = (s: TacticSlot, phase: RolePhase) => (phase === 'ip' ? s.role : s.roleOop)

/** The FM position of every slot in one phase (null when FM has no such position). */
export function fmPositions(slots: TacticSlot[], phase: RolePhase, codes: FmCodes) {
  const positions = slots.map((s) => posOf(s, phase))
  const sides = slotSides(
    positions,
    slots.map((s) => sideOf(s, phase)),
  )
  return positions.map(
    (p, i) =>
      codes.positions.find((f) => f.position === p && (f.side ?? null) === sides[i]) ?? null,
  )
}

/** Shape facts FM's role conditions depend on, for one phase. */
export function shapeOf(slots: TacticSlot[], phase: RolePhase) {
  const positions = slots.map((s) => posOf(s, phase))
  return {
    backThree: positions.filter((p) => p === 'DC').length >= 3,
    dms: positions.filter((p) => p === 'DM').length,
  }
}

const meets = (when: RoleCondition | undefined, shape: ReturnType<typeof shapeOf>) =>
  !when || (when === 'back-three' ? shape.backThree : shape.dms >= 2)

/**
 * Roles FM offers at an FM position in this shape. A role without FM positions set falls back
 * to the positions on its role card.
 */
export function rolesAt(
  roles: RoleDef[],
  phase: RolePhase,
  position: FmPosition | null,
  shape: ReturnType<typeof shapeOf>,
  text: (p: PositionCode) => string,
): RoleDef[] {
  if (!position) return []
  return roles.filter((r) => {
    if (r.phase !== phase) return false
    if (r.fm?.where?.length)
      return r.fm.where.some((w) => w.pos === position.id && meets(w.when, shape))
    return r.positions.includes(text(position.position))
  })
}

/** The option of an instruction that a set of codes selects (else its unset option). */
export function chosen(def: FmInstruction, codes: number[] | undefined): FmOption | null {
  return (
    def.options.find((o) => o.code !== 0 && codes?.includes(o.code)) ??
    def.options.find((o) => o.code === (def.default ?? 0)) ??
    def.options.find((o) => o.code === 0) ??
    def.options[0] ??
    null
  )
}

/** Sets one instruction's option in a list of codes (other instructions untouched). */
export function choose(def: FmInstruction, codes: number[] | undefined, code: number): number[] {
  const mine = new Set(def.options.map((o) => o.code))
  const rest = (codes ?? []).filter((c) => !mine.has(c))
  return code ? [...rest, code].sort((a, b) => a - b) : rest
}

/** Team instruction codes a new tactic starts with. */
export const defaultTeamCodes = (defs: FmInstruction[]) =>
  defs.flatMap((d) => (d.default ? [d.default] : []))

/** Player instruction options FM offers for a role at an FM position: forced ones only. */
export function playerChoices(
  def: FmInstruction,
  role: RoleDef | null,
  position: FmPosition | null,
): { options: FmOption[]; forced: boolean } {
  const rule = position ? role?.fm?.instructions?.[position.id] : undefined
  if (!rule) return { options: [], forced: false }
  const forced = def.options.find((o) => o.code && rule.forced.includes(o.code))
  if (forced) return { options: [forced], forced: true }
  return {
    options: def.options.filter((o) => o.code === 0 || rule.allowed.includes(o.code)),
    forced: false,
  }
}

/** Codes set in a little-endian bit field given as bytes. */
export function bitsOfBytes(bytes: number[]): number[] {
  const out: number[] = []
  bytes.forEach((b, i) => {
    for (let k = 0; k < 8; k++) if ((b >> k) & 1) out.push(i * 8 + k)
  })
  return out
}

/** Codes set in a 64-bit number (given as text). */
export function bitsOfText(text: string | null | undefined): number[] {
  if (!text) return []
  const n = BigInt(text)
  const out: number[] = []
  for (let k = 0; k < 64; k++) if ((n >> BigInt(k)) & 1n) out.push(k)
  return out
}

/** The role a stored role number names, for one phase. */
export function roleForCode(
  roles: RoleDef[],
  phase: RolePhase,
  stored: string | null | undefined,
  codes: FmCodes,
): RoleDef | null {
  if (!stored) return null
  const value = BigInt(stored) & BigInt(codes.roleCodeMask)
  return roles.find((r) => r.phase === phase && r.fm?.code && BigInt(r.fm.code) === value) ?? null
}

/** The FM position a stored position number names. */
export const positionForMask = (codes: FmCodes, mask: number | null | undefined) =>
  mask == null ? null : (codes.positions.find((p) => p.mask === mask) ?? null)

/** Conflicting pairs among a tactic's team instruction codes, as option labels. */
export function conflictsIn(codes: number[], defs: FmInstruction[], fm: FmCodes): string[] {
  const label = (c: number) => {
    for (const d of defs) {
      const o = d.options.find((x) => x.code === c)
      if (o) return `${d.name}: ${o.label}`
    }
    return String(c)
  }
  return fm.conflicts
    .filter(([a, b]) => codes.includes(a) && codes.includes(b))
    .map(([a, b]) => `${label(a)} and ${label(b)}`)
}

/**
 * A tactic's team instruction codes. Older tactics kept words ([name, option] by phase): they
 * are matched to the instruction list by name and option, ignoring case.
 */
export function teamCodes(instructions: Record<string, unknown> | null, defs: FmInstruction[]) {
  const stored = instructions as {
    team?: number[]
    ip?: [string, string][]
    oop?: [string, string][]
  } | null
  if (Array.isArray(stored?.team)) return stored.team
  const words = [...(stored?.ip ?? []), ...(stored?.oop ?? [])]
  if (!words.length) return defaultTeamCodes(defs)
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '')
  let codes = defaultTeamCodes(defs)
  for (const [name, value] of words) {
    const def = defs.find((d) => norm(d.name) === norm(name))
    const option = def?.options.find((o) => norm(o.label) === norm(value))
    if (def && option) codes = choose(def, codes, option.code)
  }
  return codes
}

/** One tactic from the save in the app's terms (positions, sides, roles, instructions). */
export function fromSave(t: SaveTactics['tactics'][number], roles: RoleDef[], codes: FmCodes) {
  const slots: TacticSlot[] = t.slots.map((s) => {
    const at = positionForMask(codes, s.mask)
    const atOop = positionForMask(codes, s.maskOop)
    const role = roleForCode(roles, 'ip', s.role, codes)
    const roleOop = roleForCode(roles, 'oop', s.roleOop, codes)
    return {
      position: at?.position ?? s.position,
      positionOop: atOop?.position ?? s.positionOop ?? s.position,
      side: at?.side ?? null,
      sideOop: atOop?.side ?? null,
      role: role?.id ?? null,
      roleOop: roleOop?.id ?? null,
      unknownRole: s.role && !role ? s.role : null,
      unknownRoleOop: s.roleOop && !roleOop ? s.roleOop : null,
      pi: bitsOfText(s.pi),
      piOop: bitsOfText(s.piOop),
      markOop: positionForMask(codes, s.markOop || null)?.id ?? null,
    }
  })
  const bytes = t.instructionCodes ?? []
  return {
    slots,
    // Byte 2 is the mentality's code (1 = the first mentality in Settings > FM codes)
    mentality:
      codes.mentalities[(bytes[2] ?? 0) - 1] ??
      (t.mentality
        ? t.mentality.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : null),
    // Bytes 6 to 17 are the team instruction bits
    team: bytes.length >= 18 ? bitsOfBytes(bytes.slice(6, 18)) : null,
  }
}
