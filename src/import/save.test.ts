import { describe, expect, it } from 'vitest'
import sample from './fixtures/save-extract-sample.json'
import { fmEuro, saveUpdates, type SaveData } from './save'

const data = sample as unknown as SaveData

describe('save import mapping', () => {
  it('formats money like FM', () => {
    expect(fmEuro(2_840_000)).toBe('€2.84M')
    expect(fmEuro(13_250)).toBe('€13.25K')
  })

  it('maps contracts to the export columns, matching FM', () => {
    const byName = (n: string) =>
      saveUpdates(data, 'overall').find(
        (u) => u.uniqueId === data.players.find((p) => p.name === n)!.uniqueId,
      )!
    const pote = byName('Pote').contract!
    expect(pote['Playing Time']).toBe('Important Player')
    expect(pote['Contract Status']).toBe('Full Time')
    expect(pote.Expires).toBe('30/6/2030')
    // FM shows €80,000,000
    expect(pote['Minimum Fee Release Clause']).toBe('€80M')
    expect(byName('Luca Ranieri').contract!['Optional Contract Extension By Club']).toBe('Yes')
    expect(byName('Federico Matarán').contract!['Contract Status']).toBe('Youth Contract')
    expect(byName('Federico Matarán').contract!['Playing Time']).toBe('Future Prospect')
  })

  it('maps season stats for the chosen competition', () => {
    const id = data.players.find((p) => p.name === 'Mateo Pellegrino')!.uniqueId
    const overall = saveUpdates(data, 'overall').find((u) => u.uniqueId === id)!
    expect(overall.stats).toMatchObject({
      Apps: '2',
      Minutes: '154',
      Goals: '3',
      Assists: '1',
      Rating: '7.90',
      xG: '2.23',
      'Conv %': '33%',
      'Hdr %': '71%',
    })
    expect(overall.leftFoot).toBe('Very Strong (20)')
    const league = saveUpdates(data, 'league').find((u) => u.uniqueId === id)!
    expect(league.stats!.Minutes).toBe('64')
  })
})
