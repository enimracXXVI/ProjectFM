import { describe, expect, it } from 'vitest'
import { DEFAULT_REGIONS, areContiguous } from './regions'

describe('default regions', () => {
  it('lists every country once', () => {
    const all = DEFAULT_REGIONS.flatMap((r) => r.countries)
    expect(new Set(all).size).toBe(all.length)
    expect(DEFAULT_REGIONS).toHaveLength(24)
  })

  it('has symmetric neighbours that exist', () => {
    const ids = new Set(DEFAULT_REGIONS.map((r) => r.id))
    for (const r of DEFAULT_REGIONS) {
      for (const n of r.neighbours) {
        expect(ids.has(n), `${r.id} -> ${n}`).toBe(true)
        const back = DEFAULT_REGIONS.find((x) => x.id === n)!
        expect(back.neighbours, `${n} should list ${r.id}`).toContain(r.id)
      }
    }
  })

  it('checks whether regions border each other', () => {
    expect(areContiguous(['uk-ireland', 'western-europe'], DEFAULT_REGIONS)).toBe(true)
    expect(areContiguous(['uk-ireland', 'central-europe', 'eastern-europe'], DEFAULT_REGIONS)).toBe(
      true,
    )
    expect(areContiguous(['uk-ireland', 'oceania'], DEFAULT_REGIONS)).toBe(false)
  })
})
