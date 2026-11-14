import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRAINING_SESSIONS,
  blankSchedule,
  readScheduleFile,
  scheduleFile,
  scheduleProblems,
} from './schedule'

describe('training schedules', () => {
  it('writes an FM schedule file that reads back the same week', async () => {
    const s = blankSchedule('Match week')
    s.sessions[0] = 0 // Monday: Passing Style
    s.sessions[4] = 106 // Tuesday: Corners
    s.sessions[20] = 401 // Sunday: Community Outreach
    expect(scheduleProblems(s, DEFAULT_TRAINING_SESSIONS)).toEqual([])
    const back = await readScheduleFile(scheduleFile(s), async () => {
      throw new Error('raw blocks need no unpacking')
    })
    expect(back).toEqual(s.sessions)
  })

  it('names the sessions FM schedules cannot hold', () => {
    const s = blankSchedule('Youth')
    s.sessions[2] = 222 // Attacking - Direct (youth)
    expect(scheduleProblems(s, DEFAULT_TRAINING_SESSIONS)).toEqual([
      'Monday session 3: FM schedules cannot hold Attacking - Direct.',
    ])
  })

  it('carries FM’s own session descriptions', () => {
    const corners = DEFAULT_TRAINING_SESSIONS.find((x) => x.code === 106)!
    expect(corners.name).toBe('Corners')
    expect(corners.about).toMatch(
      /^Focuses on optimising our offensive and defensive setup at corners/,
    )
  })
})
