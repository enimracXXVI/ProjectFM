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
    const back = await readScheduleFile(scheduleFile(s, 'f8186c05'), async () => {
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

describe('training focuses', () => {
  it('Quickness trains Pace and Acceleration, as FM shows', async () => {
    const { DEFAULT_TRAINING_FOCUSES, focusesFor } = await import('./focus')
    const quick = DEFAULT_TRAINING_FOCUSES.find((f) => f.name === 'Quickness')
    expect(quick?.attributes.sort()).toEqual(['Acceleration', 'Pace'])
    expect(focusesFor('Pace', DEFAULT_TRAINING_FOCUSES).map((f) => f.name)).toEqual(['Quickness'])
  })
  it("offers FM's lists: outfield and goalkeeper", async () => {
    const { DEFAULT_TRAINING_FOCUSES, focusesForPlayer, withWho } = await import('./focus')
    const out = focusesForPlayer('D (C), DM', DEFAULT_TRAINING_FOCUSES).map((f) => f.name)
    expect(out.slice(0, 6)).toEqual([
      'Quickness',
      'Agility and Balance',
      'Resistance',
      'Endurance',
      'Chance Conversion',
      'Chance Creation',
    ])
    expect(out.at(-1)).toBe('Long Throws')
    expect(out).not.toContain('GK Handling')
    const gk = focusesForPlayer('GK', DEFAULT_TRAINING_FOCUSES).map((f) => f.name)
    expect(gk).toHaveLength(12)
    expect(gk[4]).toBe('GK Shot Stopping')
    // Lists saved with the old group field get FM's who
    const old = [{ code: 30, name: 'GK Handling', category: 'Goalkeeping', attributes: [] }]
    expect(withWho(old as never)[0]).toEqual({
      code: 30,
      name: 'GK Handling',
      who: 'goalkeeper',
      attributes: [],
    })
  })
  it('names only attributes the app knows', async () => {
    const { DEFAULT_TRAINING_FOCUSES } = await import('./focus')
    const { ATTRIBUTE_INFO } = await import('../data/attributeInfo')
    const known = new Set([...Object.keys(ATTRIBUTE_INFO), 'Rushing Out (Tendency)'])
    for (const f of DEFAULT_TRAINING_FOCUSES)
      for (const a of f.attributes) expect(known.has(a), `${f.name}: ${a}`).toBe(true)
  })
})

describe('FM file version', () => {
  it('stamps exported schedules with the game version FM27 writes', () => {
    const file = scheduleFile(blankSchedule('Week'), 'f8186c05')
    const hexed = [...file].map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(hexed).toContain('0200010002f8186c05010010')
  })
})

describe('FM file version check', () => {
  it('reads the version FM wrote into a file', async () => {
    const { fileVersionOf } = await import('../lib/fileVersion')
    const unzip = async (frame: Uint8Array) => {
      const { zstdDecompressSync } = (await import('node:zlib' as string)) as {
        zstdDecompressSync: (b: Uint8Array) => Uint8Array
      }
      return new Uint8Array(zstdDecompressSync(frame))
    }
    const ours = scheduleFile(blankSchedule('Week'), 'abcdef01')
    expect(await fileVersionOf(ours, unzip)).toBe('abcdef01')
    // FM's own (encrypted) FM27 tactic file
    const fs = (await import('node:fs' as string)) as {
      readFileSync: (p: string) => Uint8Array
    }
    const fm = new Uint8Array(fs.readFileSync('src/tactics/fixtures/time-wasting-more.fmf'))
    expect(await fileVersionOf(fm, unzip)).toBe('f8186c05')
  })
})
