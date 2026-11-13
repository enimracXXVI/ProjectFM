import { describe, expect, it } from 'vitest'
import { PALETTE, oklchToRgb } from './palette'

describe('colour palette', () => {
  it('converts Tailwind colours to the RGB a screen shows', () => {
    // Tailwind's own sRGB values for these colours
    expect(oklchToRgb('oklch(76.5% 0.177 163.223)')).toEqual([0, 212, 146])
    expect(oklchToRgb('oklch(70.4% 0.191 22.216)')?.[0]).toBeGreaterThan(240)
  })

  it('lists the identity colours with HEX codes', () => {
    const identity = PALETTE.find((g) => g.title === 'Identity')!
    expect(identity.swatches.find((s) => s.name === 'accent')).toMatchObject({
      hex: '#22C55E',
      rgb: [34, 197, 94],
    })
    for (const g of PALETTE) for (const s of g.swatches) expect(s.hex).toMatch(/^#[0-9A-F]{6}$/)
  })
})
