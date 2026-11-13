import { describe, expect, it } from 'vitest'
import { readSchema } from './schema'

describe('database schema from the migrations', () => {
  const schema = readSchema()
  const table = (n: string) => schema.find((t) => t.name === n)!

  it('reads every table', () => {
    expect(schema.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'careers',
        'players',
        'player_snapshots',
        'staff',
        'imports',
        'tactics',
        'match_log',
        'app_settings',
      ]),
    )
  })

  it('reads columns, links and later additions', () => {
    const snap = table('player_snapshots')
    expect(snap.columns.find((c) => c.name === 'player_id')).toMatchObject({
      references: 'players',
      notNull: true,
    })
    expect(table('players').unique).toEqual([['career_id', 'fm_uid']])
    expect(table('staff').columns.find((c) => c.name === 'job_code')).toMatchObject({
      type: 'int',
      added: '0007',
    })
    expect(table('careers').columns.map((c) => c.name)).toContain('scouting')
  })
})
