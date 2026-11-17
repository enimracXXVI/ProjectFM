import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, mergeConfig, withHiddenColumn } from './config'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

describe('mergeConfig', () => {
  it('upgrades statuses saved with the old colour names to hex colours', () => {
    const c = mergeConfig({
      statuses: { PR: { label: 'Example', tone: 'red' } as never },
    })
    expect(c.statuses.PR).toEqual({
      label: 'Example',
      description: '',
      bg: '#4c1d24',
      fg: '#fca5a5',
    })
  })

  it('keeps defaults for parts the user has not saved', () => {
    const c = mergeConfig({})
    expect(c.views).toEqual(DEFAULT_CONFIG.views)
    expect(c.statuses.Inj.label).toBe('Injured')
  })

  it('applies saved column settings per view', () => {
    const stats = { label: 'Stats', columns: [{ key: 'Goals', short: 'Gls' }] }
    const c = mergeConfig({ views: { stats } as never })
    expect(c.views.stats).toEqual(stats)
    expect(c.views.contract).toEqual(DEFAULT_CONFIG.views.contract)
  })
})

describe('older roles', () => {
  it('stay out of the app until shown', async () => {
    const { mergeConfig } = await import('./config')
    const hidden = mergeConfig({})
    expect(hidden.roles.some((r) => r.id.startsWith('old-'))).toBe(false)
    expect(hidden.olderRoles.length).toBe(10)
    const shown = mergeConfig({
      olderRoles: hidden.olderRoles.map((r) => (r.id === 'old-reg' ? { ...r, show: true } : r)),
    })
    expect(shown.roles.filter((r) => r.id.startsWith('old-')).map((r) => r.name)).toEqual([
      'Regista',
    ])
  })
})

describe('hidden values column', () => {
  it('adds the Hidden column to layouts saved before it existed', () => {
    const old = {
      outfield: [[{ label: 'Technical', attributes: ['Crossing'] }]],
      goalkeepers: [[{ label: 'Goalkeeping', attributes: ['Handling'] }]],
    }
    const out = withHiddenColumn(old)
    expect(out.outfield).toHaveLength(2)
    expect(out.outfield[1][0].attributes).toContain('Consistency')
    // Left alone once hidden values are placed somewhere
    expect(withHiddenColumn(out).outfield).toHaveLength(2)
  })
})
