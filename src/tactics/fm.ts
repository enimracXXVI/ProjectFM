/**
 * FM's tactic codes: how the save and FM's tactic files (.fmf) store mentality, positions,
 * roles, team instructions and player instructions, and which roles and player instructions
 * FM allows where.
 *
 * Every code here is data the user can change in Settings (for a game update or the next FM);
 * the defaults are FM27's, from the user's own FM Tactic Generator (fm-defaults.json).
 */
import defaults from './fm-defaults.json'
import texts from './fm-texts.json'
import type { RoleDef, RolePhase } from '../data/roles'
import type { PositionCode, SaveTactics, TacticSlot } from './types'

export type Side = 'L' | 'C' | 'R'

/** FM's own explanation of a choice: short lines, a description, pros and cons. */
export interface FmAbout {
  short?: string[]
  text?: string
  pros?: string[]
  cons?: string[]
}

/** One option of an instruction and the code FM stores for it (0 = nothing set). */
export interface FmOption {
  label: string
  code: number
  /** The option needs a target: an opposition position (set here) or a player (set in FM). */
  target?: 'position' | 'player'
  /** FM's explanation of the option. */
  about?: FmAbout
  /** Points the option adds to the tactic's complexity (FM's match data). */
  complexity?: number
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
  /** Points the role adds to a player's tactical complexity (FM's match data). */
  complexity?: number
  /**
   * The flag bit (21, 22 or 23) FM adds to the in-possession role number in its tactic files.
   * Always the same for a role in every file FM saved; it looks like the old duty (21 defend,
   * 22 support, 23 attack) (?).
   */
  flag?: number
  /** The flag is a guess from the duty pattern, not yet seen in a file FM saved (?). */
  flagGuess?: boolean
  /** Version of the instruction rules (2: which instructions FM lets the role change). */
  rules?: number
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
  /** FM's explanation of each mentality, by name. */
  mentalityTexts: Record<string, FmAbout>
  /** What each role tag means (Holds Position, Stays Wide…). */
  roleTags: Record<string, string>
  /**
   * The game version FM writes into its tactic and schedule files (4 bytes, hex, as in the
   * file). FM ignores files that carry another game's version.
   */
  fileVersion: string
  /**
   * Names for team instruction codes no FM27 screen shows (FM's styles set some). "(?)" marks a
   * name worked out from FM's files but not confirmed.
   */
  hiddenTeamCodes?: Record<string, string>
}

type Defaults = {
  game: string
  mentalities: string[]
  roleCodeMask: string
  positions: FmPosition[]
  teamInstructions: FmInstruction[]
  playerInstructions: FmInstruction[]
  roles: Record<string, RoleFm>
  complexity: { teamMax: number; playerMax: number }
}
const D = defaults as unknown as Defaults

/** FM27's own texts (from the game's English language file), matched to the app's data. */
type Texts = {
  mentalities: Record<string, FmAbout>
  roles: Record<string, { about?: string; tags?: string[] }>
  tags: Record<string, string>
  team: Record<string, Record<string, FmAbout>>
  player: Record<string, Record<string, FmAbout>>
  warnings: Record<string, string>
}
export const FM_TEXTS = texts as unknown as Texts

/** Instructions with FM's explanation on each option (matched by instruction name and option). */
const withTexts = (list: FmInstruction[], about: Texts['team']) =>
  list.map((d) => ({
    ...d,
    options: d.options.map((o) => ({ ...o, about: about[d.name]?.[o.label] ?? o.about })),
  }))

export const DEFAULT_FM_CODES: FmCodes = {
  game: D.game,
  mentalities: D.mentalities,
  positions: D.positions,
  roleCodeMask: D.roleCodeMask,
  // From the user's own FM27 tactic and schedule files
  fileVersion: 'f8186c05',
  // FM27's engine keeps a table of the option for each code (game_plugin.dll): 31–34, 64, 74
  // and 75 hold its empty option, so FM27 has no option for them. FM27's screen code registers
  // its options in code order (GameAssembly.dll): Underlap (28–30), then GK distribution method
  // Rollout, Throwlong, Kickshort, Longkick (31–34), then GK distribution targets (35–41). It has
  // nothing between 63 and 65 or between 73 and 76: those options were removed with no name left.
  hiddenTeamCodes: {
    '31': 'GK distribution method: Roll it out (no FM27 option)',
    '32': 'GK distribution method: Throw it long (no FM27 option)',
    '33': 'GK distribution method: Short kicks (no FM27 option)',
    '34': 'GK distribution method: Long kicks (no FM27 option)',
    '64': 'Removed option, no name left (no FM27 option)',
    '74': 'Removed option, no name left (no FM27 option)',
    '75': 'Removed option, no name left (no FM27 option)',
  },

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
  mentalityTexts: FM_TEXTS.mentalities,
  roleTags: FM_TEXTS.tags,
}
export const DEFAULT_TEAM_INSTRUCTIONS: FmInstruction[] = withTexts(
  D.teamInstructions,
  FM_TEXTS.team,
)
export const DEFAULT_PLAYER_INSTRUCTIONS: FmInstruction[] = withTexts(
  D.playerInstructions,
  FM_TEXTS.player,
)

/**
 * A saved instruction list in FM's order (as in the defaults); ones the defaults do not have
 * keep their place at the end.
 */
export function inFmOrder(list: FmInstruction[], defaults: FmInstruction[]): FmInstruction[] {
  const at = (d: FmInstruction) => {
    const i = defaults.findIndex((x) => x.name === d.name && x.phase === d.phase)
    return i < 0 ? defaults.length : i
  }
  return list
    .map((d, i) => ({ d, i }))
    .sort((a, b) => at(a.d) - at(b.d) || a.i - b.i)
    .map((x) => x.d)
}

/**
 * A saved instruction list with FM's explanations filled in where an option has none
 * (lists saved before the texts existed): matched by instruction name and option code.
 */
export function fillAbout(list: FmInstruction[], defaults: FmInstruction[]): FmInstruction[] {
  return list.map((d) => {
    const def = defaults.find((x) => x.name === d.name && x.phase === d.phase)
    // Time wasting was first listed as Standard / Sometimes / Often; FM's options are
    // Less Often / Standard / More Often (seen in game),
    // and Less Often was then taken for 79; FM stores Less Often as nothing, Standard as 79
    // Specific teammate (code 41) was found later in FM27's own option list
    const add = def?.options.filter(
      (o) => o.code === 41 && !d.options.some((x) => x.code === o.code),
    )
    if (add?.length) d = { ...d, options: [...d.options, ...add] }
    if (
      def &&
      d.name === 'Time wasting' &&
      d.options.some((o) => o.label === 'Sometimes' || (o.code === 79 && o.label !== 'Standard'))
    )
      return def
    return {
      ...d,
      options: d.options.map((o) => {
        // FM27 names some unset options Balanced (seen in game), not Standard / Mixed crosses;
        // and calls Forward runs' 23 Make fewer runs, not Hold position (seen in game)
        const fm = def?.options.find((x) => x.code === o.code)
        const label =
          fm &&
          ((o.code === 0 && /^(Standard|Mixed crosses)$/.test(o.label)) ||
            (d.name === 'Forward runs' && o.label === 'Hold position'))
            ? fm.label
            : o.label
        return {
          ...o,
          label,
          about: o.about ?? fm?.about,
          complexity: o.complexity ?? fm?.complexity,
        }
      }),
    }
  })
}
export const DEFAULT_ROLE_FM: Record<string, RoleFm> = D.roles
/** Most complexity points FM counts for the team's instructions and for one player. */
export const COMPLEXITY_MAX = D.complexity

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
    // Slots with a side of their own keep it (first one wins); the others take what is left,
    // in order, so one unknown side does not move the rest
    const taken = new Set<Side>()
    const keep = fromSave.map((x) =>
      x && !taken.has(x) && idx.length > 1 ? (taken.add(x), x) : null,
    )
    const left = [...order, ...(['L', 'C', 'R'] as Side[])].filter(
      (x, k, a) => a.indexOf(x) === k && !taken.has(x),
    )
    idx.forEach((i, k) => (out[i] = keep[k] ?? left.shift() ?? null))
  }
  return out
}

export const posOf = (s: TacticSlot, phase: RolePhase) =>
  phase === 'ip' ? s.position : (s.positionOop ?? s.position)
/**
 * Side of a slot in one phase. Out of possession a slot with no side of its own takes the
 * in-possession side only when it plays the same position there (a DM's side says nothing
 * about where the same player stands as an MC).
 */
export const sideOf = (s: TacticSlot, phase: RolePhase) =>
  phase === 'ip'
    ? s.side
    : (s.sideOop ?? (s.positionOop == null || s.positionOop === s.position ? s.side : null) ?? null)
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

/** FM's order for listing positions: goalkeeper up to the strikers, right to left in each line. */
export const FM_ORDER = [
  'GK',
  'DR',
  'DCR',
  'DC',
  'DCL',
  'DL',
  'WBR',
  'DMR',
  'DMC',
  'DML',
  'WBL',
  'MR',
  'MCR',
  'MC',
  'MCL',
  'ML',
  'AMR',
  'AMCR',
  'AMC',
  'AMCL',
  'AML',
  'STR',
  'ST',
  'STL',
]

/** Slot numbers in FM's order of their FM positions (unknown positions last). */
export function inFmPositionOrder(at: (FmPosition | null)[]): number[] {
  const rank = (i: number) => {
    const k = FM_ORDER.indexOf(at[i]?.id ?? '')
    return k < 0 ? FM_ORDER.length : k
  }
  return at.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b)
}

/**
 * FM's tactic grid: where each FM position sits (row 0 = goalkeeper … 5 = strikers; column
 * 0 = left … 4 = right), as on FM's pitch.
 */
export const FM_GRID: Record<string, { row: number; col: number }> = {
  GK: { row: 0, col: 2 },
  DL: { row: 1, col: 0 },
  DCL: { row: 1, col: 1 },
  DC: { row: 1, col: 2 },
  DCR: { row: 1, col: 3 },
  DR: { row: 1, col: 4 },
  WBL: { row: 2, col: 0 },
  DML: { row: 2, col: 1 },
  DMC: { row: 2, col: 2 },
  DMR: { row: 2, col: 3 },
  WBR: { row: 2, col: 4 },
  ML: { row: 3, col: 0 },
  MCL: { row: 3, col: 1 },
  MC: { row: 3, col: 2 },
  MCR: { row: 3, col: 3 },
  MR: { row: 3, col: 4 },
  AML: { row: 4, col: 0 },
  AMCL: { row: 4, col: 1 },
  AMC: { row: 4, col: 2 },
  AMCR: { row: 4, col: 3 },
  AMR: { row: 4, col: 4 },
  STL: { row: 5, col: 1 },
  ST: { row: 5, col: 2 },
  STR: { row: 5, col: 3 },
}

/**
 * Moves a slot to another FM position in one phase, as dragging a player on FM's pitch does.
 * Every slot keeps the exact FM position it had (sides are written out), the moved slot keeps
 * its player, and its role and instructions only when FM offers that role at the new place.
 */
export function moveSlot(
  slots: TacticSlot[],
  i: number,
  target: FmPosition,
  phase: RolePhase,
  codes: FmCodes,
  roles: RoleDef[],
  text: (p: PositionCode) => string,
): TacticSlot[] {
  const at = fmPositions(slots, phase, codes)
  if (at.some((p, k) => k !== i && p?.id === target.id)) return slots
  const next = slots.map((s, k) => {
    const place = k === i ? target : at[k]
    const position = (place?.position ?? posOf(s, phase)) as PositionCode | null
    const side = place ? (place.side ?? null) : (sideOf(s, phase) ?? null)
    // Moving in possession leaves the out-of-possession shape where it was
    const oop =
      phase === 'ip' && s.positionOop === undefined
        ? { positionOop: s.position, sideOop: s.sideOop ?? s.side ?? null }
        : {}
    return phase === 'ip'
      ? { ...s, ...oop, position, side }
      : { ...s, positionOop: position, sideOop: side }
  })
  const shape = shapeOf(next, phase)
  const role = roleIdOf(next[i], phase)
  if (role && !rolesAt(roles, phase, target, shape, text).some((r) => r.id === role))
    next[i] =
      phase === 'ip'
        ? { ...next[i], role: null, pi: [] }
        : { ...next[i], roleOop: null, piOop: [], markOop: null }
  return next
}

/**
 * Swaps the places of two slots in one phase only: each keeps its player and its places in the
 * other phase, and takes the other's FM position, role and instructions in this phase. Every
 * other slot keeps the exact FM position it had (sides are written out, so slot order no longer
 * decides left and right).
 */
export function swapPlaces(
  slots: TacticSlot[],
  a: number,
  b: number,
  phase: RolePhase,
  codes: FmCodes,
): TacticSlot[] {
  if (a === b || !slots[a] || !slots[b]) return slots
  const at = fmPositions(slots, phase, codes)
  const atOop = fmPositions(slots, 'oop', codes)
  const placed = slots.map((s, k) => {
    const place = at[k]
    const position = (place?.position ?? posOf(s, phase)) as PositionCode | null
    const side = place ? (place.side ?? null) : (sideOf(s, phase) ?? null)
    if (phase === 'ip') {
      // The out-of-possession shape stays where it was
      const o = atOop[k]
      return {
        ...s,
        position,
        side,
        positionOop: (o?.position ?? posOf(s, 'oop')) as PositionCode | null,
        sideOop: o ? (o.side ?? null) : (sideOf(s, 'oop') ?? null),
      }
    }
    return { ...s, positionOop: position, sideOop: side }
  })
  const next = placed.map((s) => ({ ...s }))
  const keys: (keyof TacticSlot)[] =
    phase === 'ip'
      ? ['position', 'side', 'role', 'pi', 'unknownRole']
      : ['positionOop', 'sideOop', 'roleOop', 'piOop', 'markOop', 'unknownRoleOop']
  for (const k of keys) {
    ;(next[a] as Record<string, unknown>)[k] = placed[b][k]
    ;(next[b] as Record<string, unknown>)[k] = placed[a][k]
  }
  return next
}

/** The option of an instruction that a set of codes selects (else its unset option). */
export function chosen(def: FmInstruction, codes: number[] | undefined): FmOption | null {
  return (
    def.options.find((o) => o.code !== 0 && codes?.includes(o.code)) ??
    // Nothing set: the option FM stores as nothing, else the instruction's default
    def.options.find((o) => o.code === 0) ??
    def.options.find((o) => o.code === def.default) ??
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

/** The option a role is forced to on one instruction (FM sets it; the file does not). */
export function lockedOption(
  def: FmInstruction,
  rule: { allowed: number[]; forced: number[] },
): FmOption | null {
  return def.options.find((o) => o.code && rule.forced.includes(o.code)) ?? null
}

/** Player instruction options FM offers for a role at an FM position: forced ones only. */
export function playerChoices(
  def: FmInstruction,
  role: RoleDef | null,
  position: FmPosition | null,
): { options: FmOption[]; forced: boolean } {
  const rule = position ? role?.fm?.instructions?.[position.id] : undefined
  if (!rule) return { options: [], forced: false }
  const forced = lockedOption(def, rule)
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
