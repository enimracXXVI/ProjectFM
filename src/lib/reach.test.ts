import { describe, expect, it } from 'vitest'
import { reachBand, reachForHeight } from './reach'

describe('FM reach tables', () => {
  it('gives the jumping reach range for a height', () => {
    expect(reachForHeight('jumping', 184)).toEqual([9, 10, 11, 12, 13])
    expect(reachForHeight('jumping', 210)).toEqual([17, 18, 19, 20, 20])
    expect(reachForHeight('aerial', 190)).toEqual([10, 11, 12, 13, 14])
  })
  it('places a value in its band', () => {
    expect(reachBand(11, [9, 10, 11, 12, 13])).toBe('average')
    expect(reachBand(16, [9, 10, 11, 12, 13])).toBe('above the range')
  })
})
