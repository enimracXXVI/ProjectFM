import { describe, expect, it } from 'vitest'
import sample from './fixtures/save-extract-sample.json'
import { contractFields, fmEuro, saveUpdates, type SaveData } from './save'

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

describe('contractFields: loans and agreed contracts (reader 27)', () => {
  const base = {
    uniqueId: 1,
    wage: 62603,
    end: '2030-06-30',
    squadStatus: null,
    kind: 'full_time',
    onLoan: false,
    clauses: [],
  }
  it('shows a loan as FM does: owning club, dates and the borrowing club share', () => {
    // Pote on the user's save: owned by Sporting, at Fiorentina, end not in the save
    const out = contractFields({
      ...base,
      start: '2025-10-06',
      club: 'Sporting Clube de Portugal',
      loan: {
        from: 'Sporting Clube de Portugal',
        at: 'A.C.F. Fiorentina',
        start: '2026-07-20',
        end: null,
        wage: 46952,
      },
    })
    expect(out['Loan from']).toBe('Sporting Clube de Portugal')
    expect(out['On loan at']).toBe('A.C.F. Fiorentina')
    expect(out.Signed).toBe('6/10/2025')
    expect(out['Loan expires']).toBe('Not in the save')
    expect(out['Loan wage paid']).toMatch(/\(75%\)$/)
  })
  it('lists contracts agreed to start later', () => {
    const out = contractFields({
      ...base,
      future: [{ club: 'A.C.F. Fiorentina', start: '2027-06-30', end: '2031-06-30', wage: 56720 }],
    })
    expect(out['Agreed contract']).toMatch(/^A\.C\.F\. Fiorentina from 30\/6\/2027 to 30\/6\/2031/)
  })
  it('takes the latest agreed contract, leaving out talks that failed', () => {
    // Dodo: Flamengo is the agreed move (in game); a Juventus record is also in the save
    const out = contractFields({
      ...base,
      future: [
        { club: 'Juventus F.C.', start: '2027-07-01', end: '2031-06-30', wage: 31377 },
        { club: 'Flamengo', start: '2027-07-20', end: '2030-12-31', wage: 40509 },
      ],
    })
    expect(out['Agreed contract']).toMatch(/^Flamengo from 20\/7\/2027/)
    expect(out['Agreed contract']).not.toContain('Juventus')
  })
})
