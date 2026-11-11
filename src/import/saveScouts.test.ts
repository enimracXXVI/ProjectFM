import { describe, expect, it } from 'vitest'
import {
  dumpFromSave,
  fmNation,
  isSaveDump,
  knowledgeWord,
  mergeKnowledge,
  saveScouts,
  type SaveData,
} from './save'

const data = {
  club: 'A.C.F. Fiorentina',
  gameDate: null,
  players: [],
  contracts: [],
  stats: [],
  scouts: [
    {
      uniqueId: 35010753,
      name: 'Peter Braund',
      age: 60,
      chief: false,
      // As read from the user's save
      attributes: { authority: 8, adaptability: 18, judging_player_ability: 71, motivating: 5 },
      knowledge: [
        { nation: 764, value: 48 },
        { nation: 765, value: 100 },
        { nation: 771, value: 100 },
      ],
    },
  ],
} as SaveData

describe('save scouts', () => {
  it('maps knowledge to FM27 words, matching the staff screen for Peter Braund', () => {
    const [s] = saveScouts(data)
    expect(s.knowledge).toEqual([
      { nation: 'Denmark', level: 'Extensive (48)' },
      { nation: 'England', level: 'Complete (100)' },
      { nation: 'Germany', level: 'Complete (100)' },
    ])
    expect(s.attributes).toEqual({
      Authority: 'Competent (8)',
      Adaptability: 'Outstanding (18)',
      'Judging Player Ability': 'Good (14)',
      Motivating: 'Unsuited (1)',
    })
  })

  it('knows the nations and levels checked so far', () => {
    expect([30, 36, 48, 100].map(knowledgeWord)).toEqual([
      'Very Good (30)',
      'Very Good (36)',
      'Extensive (48)',
      'Complete (100)',
    ])
    expect(knowledgeWord(60)).toBe('Unknown (60)')
    expect([379, 390, 796, 1649, 1651, 1657].map(fmNation)).toEqual([
      'Mexico',
      'United States',
      'Spain',
      'Argentina',
      'Brazil',
      'Uruguay',
    ])
  })

  it('keeps the user word next to the save value where the word is not confirmed yet', () => {
    const merged = mergeKnowledge(
      [
        { nation: 'France', level: 'Unknown (75)' },
        { nation: 'Italy', level: 'Unknown (50)' },
        { nation: 'Germany', level: 'Complete (100)' },
      ],
      [
        { nation: 'France', level: 'Exceptional' },
        { nation: 'Germany', level: 'Very Good' },
      ],
    )
    expect(merged).toEqual([
      { nation: 'France', level: 'Exceptional (75)' },
      { nation: 'Italy', level: 'Unknown (50)' },
      { nation: 'Germany', level: 'Complete (100)' },
    ])
  })
})

describe('save as a dump', () => {
  it('turns nation ids into names and leaves morale out of the save import', () => {
    const dump = dumpFromSave({
      ...data,
      dump: {
        meta: { myClub: 'A.C.F. Fiorentina', source: 'FM save' },
        players: [{ id: 2000183231, name: 'Franco Mastantuono', natDb: [1649, 776] }],
        staff: [],
      },
    })
    expect(dump.players[0].nat).toEqual(['Argentina', 'Italy'])
    expect(isSaveDump(dump.meta)).toBe(true)
  })
})
