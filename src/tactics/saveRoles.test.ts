import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLES, roleShort } from '../data/roles'
import tactic from './fixtures/save-tactic.json'
import { instructionsFor, roleFor, roleSignature, type SaveRole } from './saveRoles'

const short = (id: string | null) => {
  const r = DEFAULT_ROLES.find((x) => x.id === id)
  return r ? roleShort(r) : null
}

describe('roles from the save', () => {
  it('matches the user’s FM tactic screen, in and out of possession', () => {
    const ip = tactic.slots.map((s) =>
      short(roleFor(roleSignature('ip', s.ipRole as SaveRole), {})),
    )
    const oop = tactic.slots.map((s) =>
      short(roleFor(roleSignature('oop', s.oopRole as SaveRole), {})),
    )
    expect(ip).toEqual(['BGK', 'WB', 'CB', 'CB', 'WB', 'DLP', 'WCM', 'CM', 'PW', 'IF', 'P'])
    expect(oop).toEqual(['SK', 'PFB', 'CB', 'CB', 'FB', 'DM', 'WCM', 'PCM', 'IOW', 'W', 'CFD'])
  })

  it('knows the instructions for these codes and flags changed codes', () => {
    const known = instructionsFor(tactic.instructionCodes, undefined, {})
    expect(known.ip).toContainEqual(['Tempo', 'Much Higher'])
    expect(known.oop).toContainEqual(['Line of Engagement', 'High Press'])
    const changed = instructionsFor([1, 2, 3], known, {})
    expect(changed).toMatchObject({ changed: true, ip: known.ip })
  })
})
