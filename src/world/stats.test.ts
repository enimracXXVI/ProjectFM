import { describe, expect, it } from 'vitest'
import { METRICS, formatMetric, metricValue, statsIndex, type SeasonStatsFile } from './stats'

const file: SeasonStatsFile = {
  kinds: ['overall', 'league', 'cup', 'continental'],
  fields: ['minutes', 'goals', 'shots', 'expected_goals', 'passes_attempted', 'passes_completed'],
  rows: [
    [7, 0, 900, 5, 20, 4.4, 400, 340],
    [7, 1, 450, 2, 10, 2.1, 200, 170],
  ],
}

describe('world season stats', () => {
  it('indexes a competition kind by Unique ID', () => {
    expect(statsIndex(file, 'league').get(7)?.goals).toBe(2)
    expect(statsIndex(file, 'cup').size).toBe(0)
  })

  it('works out per 90, shares and xG per shot', () => {
    const s = statsIndex(file, 'overall').get(7)
    expect(metricValue(s, 'goals/90')).toBe(0.5)
    expect(metricValue(s, 'pass_pct')).toBe(85)
    expect(formatMetric('pass_pct', 85)).toBe('85%')
    expect(metricValue(s, 'xg_per_shot')).toBeCloseTo(0.22)
    expect(metricValue(undefined, 'goals')).toBeNull()
  })

  it('lists every save figure', () => {
    expect(METRICS.some((m) => m.key === 'expected_assists/90')).toBe(true)
  })
})
