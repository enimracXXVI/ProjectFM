import { describe, expect, it } from 'vitest'
import { DEFAULT_TRAIT_NAMES, traitNames } from './traits'

describe('player traits', () => {
  it('names trait bits as the save stores them', () => {
    // fmsave's in-game confirmed bits land on the same names
    expect(traitNames('0,13,22,43,51,59', DEFAULT_TRAIT_NAMES)).toEqual([
      'Runs With Ball Down Left',
      'Likes To Try To Beat Offside Trap',
      'Dictates Tempo',
      'Tries Long Range Passes',
      'Runs With Ball Often',
      'Crosses Early',
    ])
    expect(traitNames('57', DEFAULT_TRAIT_NAMES)).toEqual(['Trait #57'])
    expect(traitNames('', DEFAULT_TRAIT_NAMES)).toEqual([])
  })
})
