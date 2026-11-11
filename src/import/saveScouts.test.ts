import { describe, expect, it } from 'vitest'
import { fmNation, knowledgeWord, mergeKnowledge, saveScouts, type SaveData } from './save'

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
      { nation: 'Denmark', level: 'Extensive' },
      { nation: 'England', level: 'Complete' },
      { nation: 'Germany', level: 'Complete' },
    ])
    expect(s.attributes).toEqual({
      Authority: 'Competent',
      Adaptability: 'Outstanding',
      'Judging Player Ability': 'Good',
      Motivating: 'Unsuited',
    })
  })

  it('knows the nations and levels checked so far', () => {
    expect([30, 36, 48, 100].map(knowledgeWord)).toEqual([
      'Very Good',
      'Very Good',
      'Extensive',
      'Complete',
    ])
    expect(knowledgeWord(60)).toBe('60/100')
    expect([379, 390, 796, 1649, 1651, 1657].map(fmNation)).toEqual([
      'Mexico',
      'United States',
      'Spain',
      'Argentina',
      'Brazil',
      'Uruguay',
    ])
  })

  it('keeps the user level where the save value is not confirmed yet', () => {
    const merged = mergeKnowledge(
      [
        { nation: 'France', level: '75/100' },
        { nation: 'Italy', level: '50/100' },
        { nation: 'Germany', level: 'Complete' },
      ],
      [
        { nation: 'France', level: 'Exceptional' },
        { nation: 'Germany', level: 'Very Good' },
      ],
    )
    expect(merged).toEqual([
      { nation: 'France', level: 'Exceptional' },
      { nation: 'Italy', level: '50/100' },
      { nation: 'Germany', level: 'Complete' },
    ])
  })
})
