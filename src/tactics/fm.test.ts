import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import { roleShort } from '../data/roles'
import tactic from './fixtures/save-tactic.json'
import {
  chosen,
  fmPositions,
  fromSave,
  playerChoices,
  rolesAt,
  shapeOf,
  slotSides,
  teamCodes,
} from './fm'
import { exportProblems, fileTitle, tacticFile } from './fmf'
import { readFmf as readTacticFile } from './fmfRead'
import { POSITION_TEXT } from './positions'
import type { SaveTactics, TacticRow } from './types'

const config = DEFAULT_CONFIG
const saved = tactic as unknown as SaveTactics['tactics'][number]
const read = fromSave(saved, config.roles, config.fmCodes)
const short = (id: string | null | undefined) => {
  const r = config.roles.find((x) => x.id === id)
  return r ? roleShort(r) : null
}
const row: TacticRow = {
  id: 't',
  career_id: 'c',
  name: 'Counter-Attack High-Press',
  style: null,
  mentality: read.mentality,
  slots: read.slots,
  instructions: { team: read.team },
  notes: null,
  save_index: 0,
  created_at: '',
  updated_at: '',
}

describe('tactic from the save', () => {
  it('names every role as the user’s FM tactic screen shows them', () => {
    expect(read.slots.map((s) => short(s.role))).toEqual([
      'BGK',
      'WB',
      'CB',
      'CB',
      'WB',
      'DLP',
      'WCM',
      'CM',
      'PW',
      'IF',
      'P',
    ])
    expect(read.slots.map((s) => short(s.roleOop))).toEqual([
      'SK',
      'PFB',
      'CB',
      'CB',
      'FB',
      'DM',
      'WCM',
      'PCM',
      'IOW',
      'W',
      'CFD',
    ])
  })

  it('reads mentality and the team instructions the user confirmed', () => {
    expect(read.mentality).toBe('Balanced')
    const pick = (name: string) =>
      chosen(
        config.teamInstructions.find((d) => d.name === name)!,
        read.team!,
      )?.label
    expect(pick('Tempo')).toBe('Much higher')
    expect(pick('Attacking width')).toBe('Narrower')
    expect(pick('Attacking transition')).toBe('Counter-attack')
    expect(pick('Build-up strategy')).toBe('Play through the press')
    expect(pick('Goalkeeper distribution')).toBe('Centre-back')
    expect(pick('Line of engagement')).toBe('High press')
    expect(pick('Defensive line height')).toBe('Higher')
    expect(pick('Defensive line behaviour')).toBe('Step up more')
    expect(pick('Trigger press')).toBe('Much more often')
    expect(pick('Defensive transition')).toBe('Counter-press')
    expect(pick('Prevent short GK distribution')).toBe('Yes')
    expect(pick('Passing directness')).toBe('Standard')
  })

  it('turns older word-based instructions into codes', () => {
    const codes = teamCodes(
      { ip: [['Tempo', 'Much Higher']], oop: [['Line of Engagement', 'High Press']] },
      config.teamInstructions,
    )
    expect(codes).toContain(46)
    expect(codes).toContain(61)
    expect(codes).not.toContain(62)
  })
})

describe('FM rules', () => {
  it('splits pairs and trios into left, centre and right', () => {
    expect(slotSides(['GK', 'DC', 'DC', 'DM', 'ST'])).toEqual([null, 'L', 'R', 'C', 'C'])
    expect(slotSides(['DC', 'DC', 'DC'])).toEqual(['L', 'C', 'R'])
    expect(slotSides(['DC', 'DC'], ['R', 'L'])).toEqual(['R', 'L'])
  })

  it('offers wide centre-back roles only on the sides of a back three', () => {
    const back = (n: number) =>
      Array.from({ length: n }, () => ({ position: 'DC' as const, role: null }))
    const names = (n: number, i: number) => {
      const slots = back(n)
      const at = fmPositions(slots, 'ip', config.fmCodes)
      return rolesAt(config.roles, 'ip', at[i], shapeOf(slots, 'ip'), (p) => POSITION_TEXT[p]).map(
        (r) => r.name,
      )
    }
    expect(names(3, 0)).toContain('Wide Centre-Back')
    expect(names(3, 1)).not.toContain('Wide Centre-Back')
    expect(names(2, 0)).not.toContain('Wide Centre-Back')
  })

  it('locks player instructions a role forces', () => {
    const nn = config.roles.find((r) => r.id === 'ngk')!
    const gk = config.fmCodes.positions.find((p) => p.id === 'GK')!
    const risk = config.playerInstructions.find((d) => d.name === 'Passing risk')!
    expect(playerChoices(risk, nn, gk)).toMatchObject({
      forced: true,
      options: [{ label: 'Take fewer risks' }],
    })
  })
})

describe('FM tactic file', () => {
  it('has no problems for the save tactic', () => {
    expect(exportProblems(row, config)).toEqual([])
  })

  it('writes a file that reads back as the same tactic', () => {
    const file = tacticFile(row, config)
    const back = readFmf(file)
    expect(back.name).toBe('Counter-Attack High-Press')
    expect(back.mentality).toBe(4)
    expect(back.team).toEqual([...read.team!].sort((a, b) => a - b))
    const codeOf = (id: string | null | undefined) =>
      config.roles.find((r) => r.id === id)!.fm!.code
    expect(back.ip.map((s) => s.role)).toEqual(row.slots.map((s) => codeOf(s.role)))
    expect(back.oop.map((s) => s.role)).toEqual(row.slots.map((s) => codeOf(s.roleOop)))
    const at = fmPositions(row.slots, 'ip', config.fmCodes)
    expect(back.ip.map((s) => s.mask)).toEqual(at.map((p) => p!.mask))
  })

  it('uploads back into the same tactic', async () => {
    const back = await readTacticFile(tacticFile(row, config), async () => {
      throw new Error('raw blocks need no unpacking')
    })
    const again = fromSave(back, config.roles, config.fmCodes)
    expect(back.name).toBe(row.name)
    expect(again.mentality).toBe('Balanced')
    expect([...again.team!].sort((a, b) => a - b)).toEqual([...read.team!].sort((a, b) => a - b))
    expect(again.slots.map((s) => [s.position, s.side, s.role, s.roleOop])).toEqual(
      fmPositions(row.slots, 'ip', config.fmCodes).map((p, i) => [
        p!.position,
        p!.side,
        row.slots[i].role,
        row.slots[i].roleOop,
      ]),
    )
  })

  it('refuses files that are not FM tactics', async () => {
    await expect(readTacticFile(new Uint8Array(100), async (b) => b)).rejects.toThrow(
      'not an FM tactic file',
    )
  })

  it('reports what FM would refuse', () => {
    const bad = { ...row, mentality: null, slots: row.slots.map((s) => ({ ...s, role: null })) }
    const problems = exportProblems(bad, config)
    expect(problems).toContain('Pick a mentality.')
    expect(problems.some((p) => p.startsWith('Pick a role for'))).toBe(true)
  })

  it('cleans the tactic name', () => {
    expect(fileTitle(' My: tactic? ')).toBe('My tactic')
    expect(fileTitle('...')).toBe('Tactic')
  })
})

/**
 * Reads an .fmf the way FM's own tactic files are laid out (the reader of the user's FM
 * Tactic Generator): archive directory, then the tactic's plan.
 */
function readFmf(file: Uint8Array) {
  const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)
  const unframe = (b: Uint8Array) => {
    expect([...b.subarray(0, 5)]).toEqual([0x28, 0xb5, 0x2f, 0xfd, 0xa0])
    const size = view(b).getUint32(5, true)
    const parts: Uint8Array[] = []
    let at = 9
    for (;;) {
      const head = b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)
      const n = head >> 3
      parts.push(b.subarray(at + 3, at + 3 + n))
      at += 3 + n
      if (head & 1) break
    }
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
    let k = 0
    for (const p of parts) {
      out.set(p, k)
      k += p.length
    }
    expect(out.length).toBe(size)
    return { out, end: at }
  }
  const dir = 9 + Number(view(file).getBigUint64(9, true))
  // The tactic member is the first frame after the 26-byte header
  const tac = unframe(file.subarray(26)).out
  unframe(file.subarray(dir + 9))
  const d = view(tac)
  let at = 11 + 1 + 4 // header "03 01 cat. 22 00 22 44 00", 0x1b, a word
  const text = () => {
    const n = d.getUint32(at, true)
    const t = new TextDecoder().decode(tac.subarray(at + 4, at + 4 + n))
    at += 4 + n
    return t
  }
  const name = text()
  at += 14
  const mentality = tac[at]
  at += 4
  const team: number[] = []
  for (let i = 0; i < 96; i++) if ((tac[at + (i >> 3)] >> (i & 7)) & 1) team.push(i)
  at += 13
  text()
  at += 4
  const block = () => {
    at += 3
    const mask = d.getUint32(at, true)
    at += 7
    const count = d.getUint32(at, true)
    at += 4 + count * 24 + 4
    const role = d.getBigUint64(at, true).toString()
    at += 8
    return { mask, role }
  }
  const ip: { mask: number; role: string }[] = []
  const stored: { mask: number; role: string }[] = []
  const index: number[] = []
  for (let i = 0; i < 11; i++) {
    ip.push(block())
    stored.push(block())
    index.push(tac[at++])
  }
  return { name, mentality, team, ip, oop: index.map((i) => stored[i]) }
}
