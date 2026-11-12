import { describe, expect, it } from 'vitest'
import staff from './fixtures/staff-jobs.json'
import { groupOf, jobTitle } from './staffJobs'

describe('staff jobs', () => {
  it('gives FM’s staff screen numbers for the first team (17 / 19 / 12)', () => {
    const first = staff.filter((s) => s.team === 0)
    const count = (g: string) => first.filter((s) => groupOf(jobTitle(s.job)) === g).length
    // Three people's job codes are not named yet (Set Piece Coach, Head Performance
    // Analyst, Loan Manager per FM's screen): one coaching, one coaching, one recruitment
    const unknown = first.filter((s) => !jobTitle(s.job))
    expect(unknown).toHaveLength(3)
    expect(count('coaching')).toBe(17 - 2)
    expect(count('recruitment')).toBe(19 - 1)
    expect(count('medical')).toBe(12)
  })
})
