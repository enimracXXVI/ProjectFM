/**
 * Reads an FM tactic file (.fmf): FM's own saved tactics and the ones ProjectFM exports.
 *
 * Layout from the user's own FM Tactic Generator: a 26-byte header, the members as
 * Zstandard frames, and a directory frame at the end. Some files keep their members
 * encrypted (AES-128-CTR, key and counter stored in front of each member). The tactic member
 * holds the same plan the save stores, so it is turned into the save's shape and read with
 * the same codes (Settings > Roles, Instructions, FM codes).
 */
import type { SaveTactics } from './types'

const ARCHIVE = '0201666d662e080000'
const ENCRYPTED = '02016166652e080000'
const HEADER = 26
const LIMIT = 4 * 1024 * 1024

/** Unpacks a Zstandard frame that is not made of raw blocks (given by the caller). */
export type Unzstd = (frame: Uint8Array) => Promise<Uint8Array>

const hexOf = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
export const bad = (why: string) => new Error(`This is not an FM file this app can read (${why}).`)

/** The tactic in a .fmf, in the save's shape. */
export async function readFmf(
  file: Uint8Array,
  unzstd: Unzstd,
): Promise<SaveTactics['tactics'][number]> {
  return parseTac(await readFmfMember(file, '.tac', unzstd))
}

/** The unpacked content of an .fmf's member with this extension (.tac tactic, .tsc schedule). */
export async function readFmfMember(file: Uint8Array, ext: string, unzstd: Unzstd) {
  if (file.length <= HEADER || file.length > LIMIT) throw bad('size')
  const kind = hexOf(file.subarray(0, 9))
  if (kind !== ARCHIVE && kind !== ENCRYPTED) throw bad('not an .fmf')
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  const dirAt = 9 + Number(view.getBigUint64(9, true))
  if (
    dirAt < HEADER ||
    dirAt >= file.length - 9 ||
    hexOf(file.subarray(dirAt, dirAt + 9)) !== ARCHIVE
  )
    throw bad('no directory')
  const dir = await unframe(file.subarray(dirAt + 9), unzstd)
  const member = findMember(dir, file, dirAt, ext)
  return unframe(kind === ENCRYPTED ? await decrypt(member) : member, unzstd)
}

/** Finds a member (by extension) through the directory. */
function findMember(dir: Uint8Array, file: Uint8Array, dirAt: number, want: string): Uint8Array {
  const d = new DataView(dir.buffer, dir.byteOffset, dir.byteLength)
  let at = 0
  const u32 = () => {
    const v = d.getUint32(at, true)
    at += 4
    return v
  }
  const text = () => {
    const n = u32()
    if (n > 4096) throw bad('directory')
    const t = new TextDecoder().decode(dir.subarray(at, at + n))
    at += n
    return t
  }
  let found: Uint8Array | null = null
  const folder = (depth: number) => {
    if (depth > 8) throw bad('directory')
    text()
    const count = u32()
    if (count > 64) throw bad('directory')
    for (let i = 0; i < count; i++) {
      text()
      const ext = text()
      const offset = Number(d.getBigUint64(at, true))
      const stored = Number(d.getBigUint64(at + 8, true))
      at += 40
      const start = HEADER + offset
      if (!stored || start + stored > dirAt) throw bad('directory')
      if (ext === want) found = file.subarray(start, start + stored)
    }
    const children = u32()
    if (children > 16) throw bad('directory')
    for (let i = 0; i < children; i++) folder(depth + 1)
  }
  folder(0)
  if (!found) throw bad(want === '.tac' ? 'no tactic inside' : 'no schedule inside')
  return found
}

/** AES-128-CTR, key and counter in the member's first 40 bytes. */
async function decrypt(member: Uint8Array): Promise<Uint8Array> {
  if (member.length <= 40 || hexOf(member.subarray(0, 8)) !== '1000000010000000')
    throw bad('unknown encryption')
  const key = await crypto.subtle.importKey('raw', member.slice(8, 24), 'AES-CTR', false, [
    'decrypt',
  ])
  const out = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: member.slice(24, 40), length: 128 },
    key,
    member.slice(40),
  )
  return new Uint8Array(out)
}

/**
 * A Zstandard frame's content: raw blocks (ProjectFM's own files) are read here, anything
 * compressed goes to `unzstd`.
 */
export async function unframe(frame: Uint8Array, unzstd: Unzstd): Promise<Uint8Array> {
  if (hexOf(frame.subarray(0, 4)) !== '28b52ffd') throw bad('packing')
  const fhd = frame[4]
  const single = (fhd >> 5) & 1
  const fcsFlag = fhd >> 6
  const dictBytes = [0, 1, 2, 4][fhd & 3]
  const fcsBytes = fcsFlag === 0 ? single : [1, 2, 4, 8][fcsFlag]
  let at = 5 + (single ? 0 : 1) + dictBytes + fcsBytes
  const parts: Uint8Array[] = []
  for (;;) {
    if (at + 3 > frame.length) throw bad('packing')
    const head = frame[at] | (frame[at + 1] << 8) | (frame[at + 2] << 16)
    const type = (head >> 1) & 3
    const size = head >> 3
    at += 3
    if (type === 0) {
      parts.push(frame.subarray(at, at + size))
      at += size
    } else if (type === 1) {
      parts.push(new Uint8Array(size).fill(frame[at]))
      at += 1
    } else {
      return unzstd(frame.slice())
    }
    if (head & 1) break
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let k = 0
  for (const p of parts) {
    out.set(p, k)
    k += p.length
  }
  return out
}

const MASK = 0xfffffffbf91fffffn

/** The tactic plan (.tac) in the save's shape. */
export function parseTac(tac: Uint8Array): SaveTactics['tactics'][number] {
  const d = new DataView(tac.buffer, tac.byteOffset, tac.byteLength)
  // "03 01 cat. 22 00" then the plan: "22 44 00", a version byte, a word
  if (hexOf(tac.subarray(0, 6)) !== '03016361742e' || hexOf(tac.subarray(8, 11)) !== '224400')
    throw bad('tactic layout')
  let at = 16
  const need = (n: number) => {
    if (at + n > tac.length) throw bad('tactic is cut short')
  }
  const u32 = () => {
    need(4)
    const v = d.getUint32(at, true)
    at += 4
    return v
  }
  const u64 = () => {
    need(8)
    const v = d.getBigUint64(at, true)
    at += 8
    return v
  }
  const text = () => {
    const n = u32()
    if (n > 4096) throw bad('tactic layout')
    need(n)
    const t = new TextDecoder().decode(tac.subarray(at, at + n))
    at += n
    return t
  }
  const name = text()
  need(32)
  const head = [...tac.subarray(at + 12, at + 18)]
  at += 18
  const bits = [...tac.subarray(at, at + 12)]
  at += 13
  const style = text()
  at += 4
  const block = (index: boolean) => {
    need(3)
    if (hexOf(tac.subarray(at, at + 3)) !== '440002') throw bad('position layout')
    at += 3
    const mask = u32()
    at += 3
    const count = u32()
    if (count > 64) throw bad('position layout')
    const entries: { key: bigint; bits: bigint; mark: number }[] = []
    for (let i = 0; i < count; i++) {
      const key = u64()
      at += 3
      const b = u64()
      at += 1
      entries.push({ key, bits: b, mark: u32() })
    }
    // Some FM files keep a short extra map here (count, then 12 bytes each)
    const extra = u32()
    if (extra > 64) throw bad('position layout')
    at += extra * 12
    const role = u64()
    const pick =
      entries.find((e) => (e.key & MASK) === (role & MASK)) ?? entries[entries.length - 1]
    const pos = index ? tac[at++] : null
    return {
      mask,
      role: role.toString(),
      pi: pick ? pick.bits.toString() : null,
      mark: pick?.mark ?? 0,
      pos,
    }
  }
  const ip: ReturnType<typeof block>[] = []
  const stored: ReturnType<typeof block>[] = []
  for (let i = 0; i < 11; i++) {
    ip.push(block(false))
    stored.push(block(true))
  }
  // The index byte pairs each in-possession slot with its out-of-possession block
  const order = stored.map((s, i) => (s.pos === 255 || s.pos === null ? i : s.pos))
  if (new Set(order).size !== 11 || order.some((i) => i > 10)) throw bad('position layout')
  const oop = order.map((i) => stored[i])
  return {
    index: -1,
    name,
    style: style || null,
    mentality: null,
    // The save's 19 bytes: mentality at 2, instruction bits at 6–17
    instructionCodes: [...head, ...bits, 255],
    slots: ip.map((s, i) => ({
      number: i,
      position: null,
      positionOop: null,
      mask: s.mask,
      maskOop: oop[i].mask,
      role: s.role,
      roleOop: oop[i].role,
      pi: s.pi,
      piOop: oop[i].pi,
      markOop: oop[i].mark || null,
    })),
  }
}
