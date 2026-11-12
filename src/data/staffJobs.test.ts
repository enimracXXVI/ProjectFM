import { describe, expect, it } from 'vitest'
import staff from './fixtures/staff-jobs.json'
import { groupOf, jobTitle } from './staffJobs'

describe('staff jobs', () => {
  it('puts every first-team member in one of the four categories', () => {
    const first = staff.filter((s) => s.team === 0)
    const count = (g: string) => first.filter((s) => groupOf(jobTitle(s.job)) === g).length
    expect(count('coaching') + count('scouting') + count('medical') + count('other')).toBe(
      first.length,
    )
    expect(count('medical')).toBe(12)
  })

  it('follows the user’s category choice', () => {
    expect(groupOf('Performance Analyst')).toBe('other')
    expect(groupOf('Performance Analyst', { 'Performance Analyst': 'coaching' })).toBe('coaching')
    expect(groupOf('Unknown job')).toBe('other')
  })
})
