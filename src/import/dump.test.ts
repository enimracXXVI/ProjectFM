import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_INFO } from '../data/attributeInfo'
import sample from './fixtures/dump-sample.json'
import {
  readerSquadNumber,
  footWord,
  formatPositions,
  playerFromDump,
  staffWord,
  summarizeDump,
  type Dump,
} from './dump'

const dump = sample as unknown as Dump

describe('formatPositions', () => {
  it('writes positions in FM notation', () => {
    expect(formatPositions(['AMR', 'AMC'])).toBe('AM (RC)')
    expect(formatPositions(['DR', 'WBR', 'MR'])).toBe('D (R), WB (R), M (R)')
    expect(formatPositions(['AML', 'AMC', 'MC', 'AMR'])).toBe('M (C), AM (RLC)')
    expect(formatPositions(['GK'])).toBe('GK')
    expect(formatPositions(['ST'])).toBe('ST (C)')
  })
})

describe('staffWord', () => {
  it('turns 1–20 into FM27 staff words', () => {
    expect([1, 4, 7, 10, 12, 15, 18, 20].map(staffWord)).toEqual([
      'Unsuited',
      'Reasonable',
      'Competent',
      'Average',
      'Good',
      'Very Good',
      'Outstanding',
      'Elite',
    ])
  })
})

describe('ProjectFM Reader fields', () => {
  it('turns foot values into FM words, matching the squad export', () => {
    // (value, FM word) pairs seen for the user's squad
    const seen: [number, string][] = [
      [5, 'Weak'],
      [8, 'Weak'],
      [9, 'Reasonable'],
      [11, 'Reasonable'],
      [12, 'Fairly Strong'],
      [13, 'Fairly Strong'],
      [16, 'Strong'],
      [20, 'Very Strong'],
    ]
    for (const [n, word] of seen) expect(footWord(n), String(n)).toBe(word)
  })

  it('maps feet, condition and morale from a reader dump', () => {
    const base = dump.players.find((p) => p.name === 'Franco Mastantuono')!
    const p = playerFromDump({ ...base, footLeft: 20, footRight: 9, condition: 9600, morale: 17 })
    expect(p.left_foot).toBe('Very Strong (20)')
    expect(p.right_foot).toBe('Reasonable (9)')
    expect(readerSquadNumber({ ...base, squadNo: 30 })).toBe(30)
    expect(readerSquadNumber({ ...base, squadNo: 255 })).toBeNull()
    expect(p.extra).toMatchObject({ Condition: '96%', Morale: 'Excellent (17)' })
    expect(playerFromDump({ ...base, morale: 12 }).extra.Morale).toBe('Unknown (12)')
  })
})

describe('dump import', () => {
  it('maps a player to known attribute names and keeps hidden values apart', () => {
    const raw = dump.players.find((p) => p.name === 'Franco Mastantuono')!
    const p = playerFromDump(raw)
    for (const a of Object.keys(p.attributes)) expect(ATTRIBUTE_INFO[a], a).toBeDefined()
    expect(Object.keys(p.attributes)).toHaveLength(47)
    expect(p.attributes).toMatchObject({
      Dribbling: 17,
      Flair: 18,
      'Free Kick Taking': 16,
      'Team Work': 11,
    })
    expect(p.extra).toMatchObject({ CA: '141', PA: '180', Consistency: '12', Ambition: '13' })
    expect(p.positions).toBe('AM (RC)')
    expect(p.nation).toBe('Argentina')
  })

  it('maps scouts to FM27 words, matching FM for Victor de los Santos', () => {
    const s = summarizeDump(dump, [])
    const victor = s.scouts.find((x) => x.name === 'Victor de los Santos')!
    // Words as shown in FM27 (screenshot), with the dump's value; Authority is not in the dump
    expect(victor.attributes).toEqual({
      'Analysing Data': 'Competent (7)',
      Adaptability: 'Outstanding (18)',
      Determination: 'Average (10)',
      Motivating: 'Unsuited (1)',
      'People Management': 'Reasonable (4)',
      'Judging Player Ability': 'Very Good (17)',
      'Judging Player Potential': 'Very Good (17)',
      'Judging Staff Ability': 'Average (10)',
      Negotiating: 'Competent (8)',
      'Tactical Knowledge': 'Average (11)',
    })
    expect(s.scouts.find((x) => x.name === 'Maurizio Niccolini')!.role).toBe('Chief Scout')
    expect(s.scouts.some((x) => x.name === 'Pepe')).toBe(false)
  })

  it('splits first team from other teams and reports clubs of known players', () => {
    const s = summarizeDump(dump, [352, 43084560])
    expect(s.players.find((x) => x.player.name === 'Federico Matarán')!.level).toBe('other')
    expect(s.players.find((x) => x.player.name === 'Dodo')!.level).toBe('first')
    expect(s.players.some((x) => x.player.name === 'Jari Litmanen')).toBe(false)
    expect(s.clubOf).toEqual({ 352: 'JK Tallinna Kalev', 43084560: 'A.C.F. Fiorentina' })
  })
})
