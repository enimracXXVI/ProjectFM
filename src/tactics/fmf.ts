/**
 * Writes a tactic as an FM tactic file (.fmf) that FM loads from its tactics screen.
 *
 * The layout follows the exporter of the user's own FM Tactic Generator, whose files FM27
 * loads: an archive of two members, the tactic (.tac) and its details (.aom), each in a
 * Zstandard frame made of raw (uncompressed) blocks, and a directory frame at the end.
 * The codes inside (mentality, positions, roles, instructions) come from Settings.
 */
import type { AppConfig } from '../data/config'
import type { RoleDef, RolePhase } from '../data/roles'
import {
  conflictsIn,
  fmPositions,
  posOf,
  roleIdOf,
  rolesAt,
  shapeOf,
  teamCodes,
  type FmPosition,
} from './fm'
import { POSITION_TEXT, formationLabel } from './positions'
import type { TacticRow, TacticSlot } from './types'

const ARCHIVE = hex('0201666d662e080000')
const PLAN = hex('2244001b00010001')
const SLOT = hex('440002')
/** Order of the out-of-possession blocks, with the index byte FM reads to pair them up. */
const PHASE_ORDER = [0, 1, 2, 3, 4, 9, 5, 6, 7, 8, 10]
/** First entry key of each slot block, as FM's own files store them. */
const LEGACY_IP = [1n, 4n, 2n, 2n, 4n, 16n, 32n, 4n, 2n, 2n, 4n]
const LEGACY_OOP = [1n, 512n, 8n, 8n, 512n, 32768n, 2048n, 8n, 8n, 134217728n, 1024n]
/** FM's default preferences block that ends every tactic. */
const PREFERENCES = hex(
  '01000000000000000000000000010000009524491008601500050509070525494a10086015000a0a09090a952449100860190005050907059524491008601900050509070525494a10086015000a0a09090a95484910086019000505090a0525514a10086015000a0a090a0a45524a10086015000f0f090c0f25524c10088815000a0f090c0a25524c10088815000a0f090e0a25494a10086016000f11090e0f49204a420a0a0b0a0a0a0a090a0409000700070009010700070009010f09000700070007000700070007000f',
)
/** Player instruction FM sets only in a match (mark a named opponent): never written. */
const MARK_PLAYER = 34

type Config = Pick<AppConfig, 'roles' | 'fmCodes' | 'teamInstructions' | 'playerInstructions'>

interface PhaseSlot {
  position: FmPosition
  role: RoleDef
  code: bigint
  bits: bigint
  mark: number
}

/** What stops a tactic from being exported, in plain words (empty when it can be). */
export function exportProblems(t: TacticRow, config: Config): string[] {
  return build(t, config).problems
}

/** The tactic as an .fmf file's bytes (throws with the problems when it cannot be built). */
export function tacticFile(t: TacticRow, config: Config, now = new Date()): Uint8Array {
  const { problems, plan } = build(t, config)
  if (!plan) throw new Error(problems.join(' '))
  const title = fileTitle(t.name)
  const describe = `${t.mentality} mentality. ${formationLabel(t.slots.map((s) => posOf(s, 'ip')))} in possession, ${formationLabel(t.slots.map((s) => posOf(s, 'oop')))} out of possession. Made with ProjectFM.`
  const content = concat(hex('03016361742e2200'), plan(title))
  return archive(title, describe, content, now)
}

/** A safe tactic name for FM and for the file name. */
export function fileTitle(name: string): string {
  const clean = [...name]
    .filter((c) => c >= ' ' && !'\\/:*?"<>|'.includes(c))
    .slice(0, 100)
    .join('')
    .replace(/^[ .]+|[ .]+$/g, '')
  return clean || 'Tactic'
}

function build(t: TacticRow, config: Config) {
  const problems: string[] = []
  const codes = config.fmCodes
  const mentality =
    codes.mentalities.findIndex((m) => m.toLowerCase() === (t.mentality ?? '').toLowerCase()) + 1
  if (!mentality) problems.push('Pick a mentality.')
  if (t.slots.length !== 11) problems.push('The tactic needs eleven positions.')
  // Goalkeeper first, the rest in their order
  const order = t.slots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(posOf(a.s, 'ip') !== 'GK') - Number(posOf(b.s, 'ip') !== 'GK'))
    .map((x) => x.s)
  const phase = (ph: RolePhase): PhaseSlot[] | null => {
    const where = ph === 'ip' ? 'in possession' : 'out of possession'
    const at = fmPositions(order, ph, codes)
    const shape = shapeOf(order, ph)
    if (posOf(order[0], ph) !== 'GK' || order.filter((s) => posOf(s, ph) === 'GK').length !== 1)
      problems.push(`Use exactly one goalkeeper ${where}.`)
    const ids = at.map((p) => p?.id)
    if (at.some((p) => !p) || new Set(ids).size !== ids.length) {
      problems.push(`Every position ${where} must be one FM has, and used once.`)
      return null
    }
    const out: PhaseSlot[] = []
    order.forEach((s, i) => {
      const position = at[i]!
      const name = POSITION_TEXT[position.position]
      const role = config.roles.find((r) => r.id === roleIdOf(s, ph)) ?? null
      if (!role) return void problems.push(`Pick a role for ${name} ${where}.`)
      const allowed = rolesAt(config.roles, ph, position, shape, (p) => POSITION_TEXT[p])
      if (!allowed.includes(role)) problems.push(`FM does not offer ${role.name} at ${name}.`)
      if (!role.fm?.code)
        return void problems.push(`${role.name} has no save code (Settings > Roles).`)
      const instr = playerBits(s, ph, role, position, config, problems, name)
      out.push({ position, role, code: BigInt(role.fm.code), ...instr })
    })
    return out.length === 11 ? out : null
  }
  const ip = phase('ip')
  const oop = phase('oop')
  const team = teamCodes(t.instructions, config.teamInstructions)
  const conflicts = conflictsIn(team, config.teamInstructions, codes)
  if (conflicts.length) problems.push(`FM does not allow ${conflicts.join('; ')}.`)
  if (team.some((c) => c < 0 || c >= 96)) problems.push('A team instruction code is out of range.')
  if (problems.length || !ip || !oop) return { problems, plan: null }

  const plan = (title: string) => {
    const w = new Writer()
    w.bytes(PLAN)
    w.text(title)
    w.bytes(new Uint8Array(12))
    w.bytes(Uint8Array.of(4, 2, mentality, 7, 2, 3))
    const bits = new Uint8Array(12)
    for (const c of team) if (c > 0) bits[c >> 3] |= 1 << (c & 7)
    w.bytes(bits)
    w.u8(0xff)
    w.u32(0)
    w.bytes(hex('4c4c554e'))
    for (let i = 0; i < 11; i++) {
      // A plain goalkeeper needs no role entry of its own
      const override = !(i === 0 && ip[i].code === LEGACY_IP[0])
      slot(w, ip[i], LEGACY_IP[i], override)
      slot(w, oop[PHASE_ORDER.indexOf(i)], LEGACY_OOP[i], true)
      w.u8(PHASE_ORDER[i])
    }
    w.bytes(PREFERENCES)
    return w.done()
  }
  return { problems, plan }
}

/** A slot's player instruction bits and marked position, checked against the role's rules. */
function playerBits(
  s: TacticSlot,
  ph: RolePhase,
  role: RoleDef,
  position: FmPosition,
  config: Config,
  problems: string[],
  name: string,
) {
  const rule = role.fm?.instructions?.[position.id]
  const picked = (ph === 'ip' ? s.pi : s.piOop) ?? []
  let bits = 0n
  let mark = 0
  for (const c of picked) {
    // Forced options are the role's own: FM sets them, the file does not
    if (rule?.forced.includes(c) || c === MARK_PLAYER) continue
    if (!rule?.allowed.includes(c)) {
      const def = config.playerInstructions.find((d) => d.options.some((o) => o.code === c))
      const label = def?.options.find((o) => o.code === c)?.label ?? String(c)
      problems.push(`${name}: ${label} is not available for ${role.name}.`)
      continue
    }
    bits |= 1n << BigInt(c)
    const target = config.playerInstructions
      .flatMap((d) => d.options)
      .find((o) => o.code === c)?.target
    if (target === 'position') {
      const p = config.fmCodes.positions.find((x) => x.id === s.markOop)
      if (p) mark = p.mask
      else problems.push(`${name}: pick the position to mark.`)
    }
  }
  return { bits, mark }
}

function slot(w: Writer, s: PhaseSlot, legacy: bigint, override: boolean) {
  w.bytes(SLOT)
  w.u32(s.position.mask)
  w.bytes(Uint8Array.of(0, 1, 1))
  w.u32(override ? 2 : 1)
  w.u64(legacy)
  instructions(w, override && legacy !== s.code ? null : s)
  if (override) {
    w.u64(s.code)
    instructions(w, s)
  }
  w.u32(0)
  w.u64(s.code)
}

function instructions(w: Writer, s: PhaseSlot | null) {
  w.bytes(Uint8Array.of(2, 2, 2))
  w.u64(s?.bits ?? 0n)
  w.u8(0xff)
  w.u32(s?.mark ?? 0)
}

function archive(title: string, description: string, content: Uint8Array, now: Date) {
  const d = new Writer()
  d.bytes(hex('03016d6f612e0400'))
  d.text('TACTICS_TYPE_HANDLER')
  d.text(title)
  d.text(description)
  d.bytes(new Uint8Array(6))
  d.u64(0xffffffffffffffffn)
  d.u64(0xffffffffffffffffn)
  d.text('ProjectFM')
  d.bytes(hex('020001000281490d03010010'))
  d.bytes(crypto.getRandomValues(new Uint8Array(10)))
  const details = d.done()
  const tacticFrame = frame(content)
  const detailsFrame = frame(details)
  const time = BigInt(Math.floor(now.getTime() / 1000))
  const entry = (
    w: Writer,
    name: string,
    ext: string,
    offset: number,
    packed: number,
    raw: number,
  ) => {
    w.text(name)
    w.text(ext)
    w.u64(BigInt(offset))
    w.u64(BigInt(packed))
    w.u64(BigInt(raw))
    w.u64(time)
    w.u64(time)
  }
  const toc = new Writer()
  toc.text(title)
  toc.u32(1)
  entry(toc, title, '.tac', 0, tacticFrame.length, content.length)
  toc.u32(1)
  toc.text('_data')
  toc.u32(1)
  entry(toc, 'details', '.aom', tacticFrame.length, detailsFrame.length, details.length)
  toc.u32(0)
  const w = new Writer()
  w.bytes(ARCHIVE)
  w.u64(BigInt(17 + tacticFrame.length + detailsFrame.length))
  w.u64(17n)
  w.u8(3)
  w.bytes(tacticFrame)
  w.bytes(detailsFrame)
  w.bytes(ARCHIVE)
  w.bytes(frame(toc.done()))
  return w.done()
}

/** A Zstandard frame of raw blocks (no compression), with the content size. */
export function frame(value: Uint8Array): Uint8Array {
  const w = new Writer()
  w.bytes(hex('28b52ffda0'))
  w.u32(value.length)
  let at = 0
  do {
    const size = Math.min(65536, value.length - at)
    const head = (size << 3) | (at + size === value.length ? 1 : 0)
    w.u8(head & 0xff)
    w.u8((head >> 8) & 0xff)
    w.u8((head >> 16) & 0xff)
    w.bytes(value.subarray(at, at + size))
    at += size
  } while (at < value.length)
  return w.done()
}

/** Little-endian byte writer. */
class Writer {
  private parts: Uint8Array[] = []
  bytes(b: Uint8Array) {
    this.parts.push(b)
  }
  u8(n: number) {
    this.parts.push(Uint8Array.of(n & 0xff))
  }
  u32(n: number) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, n >>> 0, true)
    this.parts.push(b)
  }
  u64(n: bigint) {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setBigUint64(0, BigInt.asUintN(64, n), true)
    this.parts.push(b)
  }
  text(t: string) {
    const b = new TextEncoder().encode(t)
    this.u32(b.length)
    this.bytes(b)
  }
  done() {
    return concat(...this.parts)
  }
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

function hex(t: string) {
  return Uint8Array.from(t.match(/../g)!, (h) => parseInt(h, 16))
}
