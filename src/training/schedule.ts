/**
 * Training schedules: a week of 7 days × 3 sessions, as FM's weekly schedule files (.fmf)
 * store them, and the sessions FM offers (names, codes and FM's own descriptions, editable in
 * Settings > Training sessions).
 *
 * The file layout follows the schedule exporter of the user's own FM Tactic Generator: an
 * archive with the schedule (.tsc), its details (.aom) and an image member, each in a
 * Zstandard frame. Day 1 is Monday.
 */
import sessions from './fm-sessions.json'
import { concat, frame, hex, Writer } from '../tactics/fmf'
import { bad, readFmfMember, type Unzstd } from '../tactics/fmfRead'

export interface TrainingSession {
  code: number
  name: string
  category: string
  /** FM's description of the session. */
  about: string
  /** FM accepts it in a weekly schedule file. */
  fm: boolean
  /** Attributes the session works on, by unit (attacking, midfield, defensive, goalkeeping). */
  attributes?: Record<string, string[]>
}

export interface TrainingSchedule {
  id: string
  name: string
  notes?: string
  /** 21 session codes: Monday's three, then Tuesday's… */
  sessions: number[]
}

export const DEFAULT_TRAINING_SESSIONS = sessions as TrainingSession[]
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const SLOTS = 3
/** FM's Rest session: an empty week is all rest. */
export const REST = 300

export const blankSchedule = (name: string): TrainingSchedule => ({
  id: crypto.randomUUID(),
  name,
  sessions: new Array(DAYS.length * SLOTS).fill(REST),
})

/** What stops a schedule from being exported, in plain words (empty when it can be). */
export function scheduleProblems(s: TrainingSchedule, list: TrainingSession[]): string[] {
  if (s.sessions.length !== DAYS.length * SLOTS) return ['The week needs 21 sessions.']
  return s.sessions.flatMap((code, i) => {
    const session = list.find((x) => x.code === code)
    const where = `${DAYS[Math.floor(i / SLOTS)]} session ${(i % SLOTS) + 1}`
    if (!session) return [`${where}: unknown session ${code}.`]
    return session.fm ? [] : [`${where}: FM schedules cannot hold ${session.name}.`]
  })
}

/** A schedule as an FM weekly schedule file (.fmf). */
export function scheduleFile(s: TrainingSchedule, now = new Date()): Uint8Array {
  const title = s.name.trim() || 'Schedule'
  const describe = 'Weekly training schedule - Made with ProjectFM'
  const c = new Writer()
  c.bytes(hex('03016373742e0300050100000001'))
  for (let d = 0; d < DAYS.length; d++) {
    c.u8(4)
    for (let k = 0; k < SLOTS; k++) {
      const code = s.sessions[d * SLOTS + k]
      c.bytes(Uint8Array.of(code & 0xff, (code >> 8) & 0xff))
    }
    // As FM's own files: set on the first day when it does not start with rest
    c.u8(d === 0 && s.sessions[0] !== REST ? 1 : 0)
  }
  c.text(describe)
  c.u64(0n)
  const content = c.done()
  const det = new Writer()
  det.bytes(hex('03016d6f612e0400'))
  det.text('SCHEDULE_TYPE_HANDLER')
  det.text(title)
  det.text(describe)
  det.bytes(new Uint8Array(6))
  det.u64(0xffffffffffffffffn)
  det.u64(0xffffffffffffffffn)
  det.text('ProjectFM')
  det.bytes(hex('020001000207c31b03010010'))
  det.bytes(crypto.getRandomValues(new Uint8Array(10)))
  const details = det.done()
  const preview = Uint8Array.of(1, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  const scheduleFrame = frame(content)
  const detailsFrame = frame(details)
  const imageFrame = frame(preview)
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
  toc.u32(2)
  entry(toc, 'image', '.img', detailsFrame.length, imageFrame.length, preview.length)
  entry(
    toc,
    title,
    '.tsc',
    detailsFrame.length + imageFrame.length,
    scheduleFrame.length,
    content.length,
  )
  toc.u32(1)
  toc.text('_data')
  toc.u32(1)
  entry(toc, 'details', '.aom', 0, detailsFrame.length, details.length)
  toc.u32(0)
  const w = new Writer()
  const header = hex('0201666d662e080000')
  w.bytes(header)
  w.u64(BigInt(17 + detailsFrame.length + imageFrame.length + scheduleFrame.length))
  w.u64(17n)
  w.u8(3)
  w.bytes(concat(detailsFrame, imageFrame, scheduleFrame))
  w.bytes(header)
  w.bytes(frame(toc.done()))
  return w.done()
}

/** The 21 session codes of an FM weekly schedule file. */
export async function readScheduleFile(file: Uint8Array, unzstd: Unzstd): Promise<number[]> {
  const tsc = await readFmfMember(file, '.tsc', unzstd)
  const head = hex('03016373742e')
  if (tsc.length < 14 + 7 * 8 || !head.every((b, i) => tsc[i] === b)) throw bad('schedule layout')
  const out: number[] = []
  let at = 14
  for (let d = 0; d < DAYS.length; d++) {
    // Each day: a lead byte (4 in FM's files), three session codes, a flag byte
    for (let k = 0; k < SLOTS; k++) out.push(tsc[at + 1 + k * 2] | (tsc[at + 2 + k * 2] << 8))
    at += 2 + SLOTS * 2
  }
  return out
}
