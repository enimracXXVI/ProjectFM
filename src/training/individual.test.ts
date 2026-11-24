import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import {
  DEFAULT_TRAINING_ROLE_CODES as codes,
  focusOf,
  ipTrainingRole,
  oopTrainingRole,
  restDaysLeft,
  trainingFields,
} from './individual'
import { focusesForRole } from './focus'

const roles = DEFAULT_CONFIG.roles
const ip = (raw: number) => ipTrainingRole(String(raw), codes, roles)?.role?.name
const oop = (raw: number) => oopTrainingRole(String(raw), codes, roles)

// Values read from the user's FM27 saves, with what FM's training screen showed
describe('individual training from the save', () => {
  it('names the in-possession role trained', () => {
    expect(ip(0x18b5)).toBe('Centre-Back') // Ranieri, Pongračić
    expect(ip(0x1d75)).toBe('Ball-Playing Centre-Back') // Viery, changed in game
    expect(ip(0x1c89)).toBe('Target Forward') // Pellegrino, Beto
    expect(ip(0x1938)).toBe('Wing-Back') // Dodô
    expect(ip(0x04bf)).toBe('Channel Midfielder') // Atta
    expect(ip(0x1bfa)).toBe('Deep-Lying Playmaker') // Fagioli
    expect(ipTrainingRole(String(0x1c49), codes, roles)).toMatchObject({ role: null, code: 113 })
  })

  it('names the out-of-possession role trained, in FM’s own role order', () => {
    expect(oop(-28)?.role?.name).toBe('Centre-Back')
    expect(oop(-26)?.role?.name).toBe('Covering Centre-Back') // Pongračić, changed in game
    expect(oop(-22)?.role?.name).toBe('Full-Back')
    expect(oop(-21)?.role?.name).toBe('Pressing Full-Back')
    expect(oop(-16)?.role?.name).toBe('Defensive Midfielder')
    expect(oop(-10)?.role?.name).toBe('Pressing Central Midfielder')
    expect(oop(4)?.role?.name).toBe('Centre Forward')
    expect(oop(-31)?.role?.name).toBe('Goalkeeper')
    expect(oop(50)?.none).toBe(true) // Atta, set to None in game
  })

  it('reads focus, intensity and rest', () => {
    const f = trainingFields(
      { ipRole: 0x1938, oopRole: -21, focus: 18, intensity: 'auto', restUntil: '2026-12-22' },
      '2026-12-19',
    )
    expect(focusOf(f['Training focus'], DEFAULT_CONFIG.trainingFocuses)?.name).toBe('Containment')
    expect(focusOf('', DEFAULT_CONFIG.trainingFocuses)).toBeNull()
    // Two days without pitch or gym work set on 19 Dec: back on 22 Dec
    expect(restDaysLeft(f['Training rest until'], f['Training as of'])).toBe(2)
    expect(restDaysLeft('', '2026-12-19')).toBeNull()
  })
})

describe('which focus for the role he trains', () => {
  it('puts the focus for his weakest key attributes first', () => {
    const focuses = DEFAULT_CONFIG.trainingFocuses.filter((f) => f.who !== 'goalkeeper')
    const role = { key: ['Acceleration', 'Pace', 'Stamina'], preferred: ['Agility'] }
    const values: Record<string, number> = { Acceleration: 9, Pace: 10, Stamina: 16, Agility: 8 }
    const list = focusesForRole(focuses, role, (a) => values[a] ?? null)
    expect(list[0].focus.name).toBe('Quickness') // key Acc 9 and Pace 10
    expect(list[0].key.map((k) => k.attribute)).toEqual(['Acceleration', 'Pace'])
    expect(list.find((x) => x.focus.name === 'Agility and Balance')?.preferred).toEqual([
      { attribute: 'Agility', value: 8 },
    ])
    expect(list.at(-1)?.gain).toBe(0)
  })
})
