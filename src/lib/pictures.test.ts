import { describe, expect, it } from 'vitest'
import { DEFAULT_PICTURES } from '../data/config'
import { nationId, pictureUrl } from './pictures'

describe('pictures', () => {
  it('builds sortitoutsi addresses by FM Unique ID', () => {
    expect(pictureUrl(DEFAULT_PICTURES, 'face', 2000024341)).toBe(
      'https://sortitoutsi.b-cdb.net/uploads/face/face_2000024341.png',
    )
    expect(pictureUrl(DEFAULT_PICTURES, 'club', 1000)).toBe(
      'https://sortitoutsi.b-cdb.net/uploads/team/club_1000.png',
    )
    expect(pictureUrl(DEFAULT_PICTURES, 'flag', nationId('France'))).toBe(
      'https://sortitoutsi.b-cdb.net/uploads/flags/flag_769.png',
    )
  })

  it('gives nothing when off or without an id', () => {
    expect(pictureUrl({ ...DEFAULT_PICTURES, enabled: false }, 'face', 1)).toBeNull()
    expect(pictureUrl(DEFAULT_PICTURES, 'face', null)).toBeNull()
    expect(nationId('Atlantis')).toBeNull()
  })
})
