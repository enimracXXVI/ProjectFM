import { describe, expect, it } from 'vitest'
import { linkColumns, linkOf, linkValue, parseLinkValue, sameLink, type NoteLink } from './notes'

describe('note links', () => {
  it('keeps a world player link in the match key, with the name', () => {
    const link: NoteLink = { kind: 'world', id: '12345', name: 'Arthur Atta' }
    const cols = linkColumns(link)
    expect(cols).toEqual({ player_id: null, staff_id: null, match_key: 'world:12345|Arthur Atta' })
    expect(linkOf(cols)).toEqual(link)
    expect(parseLinkValue(linkValue(link))).toEqual(link)
    expect(sameLink(linkOf(cols), { kind: 'world', id: '12345', name: '' })).toBe(true)
  })

  it('still reads match keys as matches', () => {
    const cols = linkColumns({ kind: 'match', id: '32|2026-08-22_1129_1179|2026' })
    expect(linkOf(cols)).toEqual({ kind: 'match', id: '32|2026-08-22_1129_1179|2026' })
  })
})
