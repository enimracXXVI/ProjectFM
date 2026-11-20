import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, mergeConfig } from '../data/config'
import { roleShort } from '../data/roles'
import tactic from './fixtures/save-tactic.json'
import {
  chosen,
  fmPositions,
  fromSave,
  playerChoices,
  rolesAt,
  shapeOf,
  slotSides,
  swapPlaces,
  teamCodes,
} from './fm'
import { exportProblems, fileTitle, tacticFile } from './fmf'
import { briefingText, buildBriefing } from './briefing'
import { roleWarnings } from './warnings'
import { readFmf as readTacticFile, readFmfMember } from './fmfRead'
import { POSITION_TEXT } from './positions'
import type { SaveTactics, TacticRow, TacticSlot } from './types'

const config = DEFAULT_CONFIG
const saved = tactic as unknown as SaveTactics['tactics'][number]
const read = fromSave(saved, config.roles, config.fmCodes)
const short = (id: string | null | undefined) => {
  const r = config.roles.find((x) => x.id === id)
  return r ? roleShort(r) : null
}
const row: TacticRow = {
  id: 't',
  career_id: 'c',
  name: 'Counter-Attack High-Press',
  style: null,
  mentality: read.mentality,
  slots: read.slots,
  instructions: { team: read.team },
  notes: null,
  save_index: 0,
  created_at: '',
  updated_at: '',
}

describe('tactic from the save', () => {
  it('names every role as the user’s FM tactic screen shows them', () => {
    expect(read.slots.map((s) => short(s.role))).toEqual([
      'BGK',
      'WB',
      'CB',
      'CB',
      'WB',
      'DLP',
      'WCM',
      'CM',
      'PW',
      'IF',
      'P',
    ])
    expect(read.slots.map((s) => short(s.roleOop))).toEqual([
      'SK',
      'PFB',
      'CB',
      'CB',
      'FB',
      'DM',
      'WCM',
      'PCM',
      'IOW',
      'W',
      'CFD',
    ])
  })

  it('reads mentality and the team instructions the user confirmed', () => {
    expect(read.mentality).toBe('Balanced')
    const pick = (name: string) =>
      chosen(
        config.teamInstructions.find((d) => d.name === name)!,
        read.team!,
      )?.label
    expect(pick('Tempo')).toBe('Much higher')
    expect(pick('Attacking width')).toBe('Narrower')
    expect(pick('Attacking transition')).toBe('Counter-attack')
    expect(pick('Build-up strategy')).toBe('Play through the press')
    expect(pick('Goalkeeper distribution')).toBe('Centre-back')
    expect(pick('Line of engagement')).toBe('High press')
    expect(pick('Defensive line height')).toBe('Higher')
    expect(pick('Defensive line behaviour')).toBe('Step up more')
    expect(pick('Trigger press')).toBe('Much more often')
    expect(pick('Defensive transition')).toBe('Counter-press')
    expect(pick('Prevent short GK distribution')).toBe('Yes')
    expect(pick('Passing directness')).toBe('Standard')
  })

  it('turns older word-based instructions into codes', () => {
    const codes = teamCodes(
      { ip: [['Tempo', 'Much Higher']], oop: [['Line of Engagement', 'High Press']] },
      config.teamInstructions,
    )
    expect(codes).toContain(46)
    expect(codes).toContain(61)
    expect(codes).not.toContain(62)
  })
})

describe('FM rules', () => {
  it('splits pairs and trios into left, centre and right', () => {
    expect(slotSides(['GK', 'DC', 'DC', 'DM', 'ST'])).toEqual([null, 'L', 'R', 'C', 'C'])
    expect(slotSides(['DC', 'DC', 'DC'])).toEqual(['L', 'C', 'R'])
    expect(slotSides(['DC', 'DC'], ['R', 'L'])).toEqual(['R', 'L'])
  })

  it('swaps two places out of possession only, every other slot staying put', () => {
    // 4-3-3 in possession (DM + two MCs), 4-4-2-ish out of possession, sides by order
    const ip = ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'MC', 'AMR', 'AML', 'ST'] as const
    const oop = ['GK', 'DR', 'DC', 'DC', 'DL', 'MC', 'MC', 'MC', 'MR', 'ML', 'ST'] as const
    const slots: TacticSlot[] = ip.map((position, i) => ({
      position,
      positionOop: oop[i],
      player: `p${i}`,
      role: `r${i}`,
      roleOop: `o${i}`,
    }))
    const ids = (list: typeof slots, ph: 'ip' | 'oop') =>
      fmPositions(list, ph, config.fmCodes).map((p) => p?.id)
    const beforeIp = ids(slots, 'ip')
    const beforeOop = ids(slots, 'oop')
    expect(beforeOop.slice(5, 8)).toEqual(['MCL', 'MC', 'MCR'])
    const next = swapPlaces(slots, 5, 7, 'oop', config.fmCodes)
    // Players and in-possession places untouched
    expect(next.map((s) => s.player)).toEqual(slots.map((s) => s.player))
    expect(ids(next, 'ip')).toEqual(beforeIp)
    // Out of possession: 5 and 7 swap, with their roles; everyone else keeps his spot
    const after = ids(next, 'oop')
    expect(after[5]).toBe('MCR')
    expect(after[7]).toBe('MCL')
    expect(next[5].roleOop).toBe('o7')
    expect(next[7].roleOop).toBe('o5')
    after.forEach((id, k) => k !== 5 && k !== 7 && expect(id).toBe(beforeOop[k]))
  })

  it('does not borrow the in-possession side for another position out of possession', () => {
    const slots = [
      { position: 'DM' as const, side: 'R' as const, positionOop: 'MC' as const },
      { position: 'DM' as const, side: 'L' as const, positionOop: 'MC' as const },
      { position: 'MC' as const, side: 'C' as const, positionOop: 'MC' as const },
    ]
    // Third keeps C (same position); the other two get left and right by order
    expect(fmPositions(slots, 'oop', config.fmCodes).map((p) => p?.id)).toEqual([
      'MCL',
      'MCR',
      'MC',
    ])
  })

  it('offers wide centre-back roles only on the sides of a back three', () => {
    const back = (n: number) =>
      Array.from({ length: n }, () => ({ position: 'DC' as const, role: null }))
    const names = (n: number, i: number) => {
      const slots = back(n)
      const at = fmPositions(slots, 'ip', config.fmCodes)
      return rolesAt(config.roles, 'ip', at[i], shapeOf(slots, 'ip'), (p) => POSITION_TEXT[p]).map(
        (r) => r.name,
      )
    }
    expect(names(3, 0)).toContain('Wide Centre-Back')
    expect(names(3, 1)).not.toContain('Wide Centre-Back')
    expect(names(2, 0)).not.toContain('Wide Centre-Back')
  })

  it('locks player instructions a role forces', () => {
    const nn = config.roles.find((r) => r.id === 'ngk')!
    const gk = config.fmCodes.positions.find((p) => p.id === 'GK')!
    const risk = config.playerInstructions.find((d) => d.name === 'Passing risk')!
    expect(playerChoices(risk, nn, gk)).toMatchObject({
      forced: true,
      options: [{ label: 'Take fewer risks' }],
    })
  })
})

describe('FM tactic file', () => {
  it('has no problems for the save tactic', () => {
    expect(exportProblems(row, config)).toEqual([])
  })

  it('writes a file that reads back as the same tactic', () => {
    const file = tacticFile(row, config)
    const back = readFmf(file)
    expect(back.name).toBe('Counter-Attack High-Press')
    expect(back.mentality).toBe(4)
    expect(back.team).toEqual([...read.team!].sort((a, b) => a - b))
    const codeOf = (id: string | null | undefined) =>
      config.roles.find((r) => r.id === id)!.fm!.code
    // In possession with FM's flag bit, exactly as FM's own save stores the roles
    expect(back.ip.map((s) => s.role)).toEqual(saved.slots.map((s) => s.role))
    expect(back.ip.map((s) => BigInt(s.role) & ~(7n << 21n))).toEqual(
      row.slots.map((s) => BigInt(codeOf(s.role)!)),
    )
    expect(back.oop.map((s) => s.role)).toEqual(row.slots.map((s) => codeOf(s.roleOop)))
    const at = fmPositions(row.slots, 'ip', config.fmCodes)
    expect(back.ip.map((s) => s.mask)).toEqual(at.map((p) => p!.mask))
  })

  it('uploads back into the same tactic', async () => {
    const back = await readTacticFile(tacticFile(row, config), async () => {
      throw new Error('raw blocks need no unpacking')
    })
    const again = fromSave(back, config.roles, config.fmCodes)
    expect(back.name).toBe(row.name)
    expect(again.mentality).toBe('Balanced')
    expect([...again.team!].sort((a, b) => a - b)).toEqual([...read.team!].sort((a, b) => a - b))
    expect(again.slots.map((s) => [s.position, s.side, s.role, s.roleOop])).toEqual(
      fmPositions(row.slots, 'ip', config.fmCodes).map((p, i) => [
        p!.position,
        p!.side,
        row.slots[i].role,
        row.slots[i].roleOop,
      ]),
    )
  })

  it('refuses files that are not FM tactics', async () => {
    await expect(readTacticFile(new Uint8Array(100), async (b) => b)).rejects.toThrow(
      'not an FM file',
    )
  })

  it('reports what FM would refuse', () => {
    const bad = { ...row, mentality: null, slots: row.slots.map((s) => ({ ...s, role: null })) }
    const problems = exportProblems(bad, config)
    expect(problems).toContain('Pick a mentality.')
    expect(problems.some((p) => p.startsWith('Pick a role for'))).toBe(true)
  })

  it('cleans the tactic name', () => {
    expect(fileTitle(' My: tactic? ')).toBe('My tactic')
    expect(fileTitle('...')).toBe('Tactic')
  })
})

/**
 * Reads an .fmf the way FM's own tactic files are laid out (the reader of the user's FM
 * Tactic Generator): archive directory, then the tactic's plan.
 */
function readFmf(file: Uint8Array) {
  const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)
  const unframe = (b: Uint8Array) => {
    expect([...b.subarray(0, 5)]).toEqual([0x28, 0xb5, 0x2f, 0xfd, 0xa0])
    const size = view(b).getUint32(5, true)
    const parts: Uint8Array[] = []
    let at = 9
    for (;;) {
      const head = b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)
      const n = head >> 3
      parts.push(b.subarray(at + 3, at + 3 + n))
      at += 3 + n
      if (head & 1) break
    }
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
    let k = 0
    for (const p of parts) {
      out.set(p, k)
      k += p.length
    }
    expect(out.length).toBe(size)
    return { out, end: at }
  }
  const dir = 9 + Number(view(file).getBigUint64(9, true))
  // The tactic member is the first frame after the 26-byte header
  const tac = unframe(file.subarray(26)).out
  unframe(file.subarray(dir + 9))
  return parseSlots(tac)
}

/** A tactic member's name, mentality, team instructions and slot blocks. */
function parseSlots(tac: Uint8Array) {
  const d = new DataView(tac.buffer, tac.byteOffset, tac.byteLength)
  let at = 11 + 1 + 4 // header "03 01 cat. 22 00 22 44 00", 0x1b, a word
  const text = () => {
    const n = d.getUint32(at, true)
    const t = new TextDecoder().decode(tac.subarray(at + 4, at + 4 + n))
    at += 4 + n
    return t
  }
  const name = text()
  at += 14
  const mentality = tac[at]
  at += 4
  const team: number[] = []
  for (let i = 0; i < 96; i++) if ((tac[at + (i >> 3)] >> (i & 7)) & 1) team.push(i)
  at += 13
  text()
  at += 4
  const block = () => {
    at += 3
    const mask = d.getUint32(at, true)
    at += 7
    const count = d.getUint32(at, true)
    at += 4
    const entries: [string, string][] = []
    for (let k = 0; k < count; k++) {
      entries.push([
        d.getBigUint64(at + 24 * k, true).toString(),
        d.getBigUint64(at + 24 * k + 11, true).toString(),
      ])
    }
    at += count * 24 + 4
    const role = d.getBigUint64(at, true).toString()
    at += 8
    return { mask, role, entries }
  }
  type Block = ReturnType<typeof block>
  const ip: Block[] = []
  const stored: Block[] = []
  const index: number[] = []
  for (let i = 0; i < 11; i++) {
    ip.push(block())
    stored.push(block())
    index.push(tac[at++])
  }
  return { name, mentality, team, ip, oop: index.map((i) => stored[i]) }
}

describe('briefing', () => {
  it('lists the changed team instructions, roles and forced player instructions', () => {
    const b = buildBriefing(row, [], config)
    expect(b.title).toBe('Counter-Attack High-Press · Balanced')
    expect(b.team.ip).toContain('Tempo: Much higher')
    expect(b.team.oop).toContain('Line of engagement: High press')
    expect(b.team.oop).not.toContain('Line of engagement: Mid block')
    expect(b.slots[0]).toMatchObject({
      where: 'GK',
      roles: 'Ball-Playing Goalkeeper / Sweeper Keeper',
    })
    expect(b.watch).toContain('GK: no player picked.')
    expect(briefingText(b)).toContain('Team instructions in possession')
  })
})

describe('FM texts and warnings', () => {
  it('carries FM’s own texts for mentalities, roles and instructions', () => {
    expect(config.fmCodes.mentalityTexts.Cautious.pros).toContain(
      'Useful for when you’re wary of the other team’s attacking threat.',
    )
    const wcb = config.roles.find((r) => r.id === 'wcb-ip')!
    expect(wcb.about).toMatch(/^Alongside providing defensive protection/)
    const loe = config.teamInstructions.find((d) => d.name === 'Line of engagement')!
    expect(loe.options.find((o) => o.label === 'High press')?.about?.short).toContain(
      'Begin engaging opposition during their build-up phase.',
    )
    expect(config.fmCodes.roleTags['Stays Wide']).toMatch(/hold a wide position/)
  })

  it('raises FM’s warnings only when the rule applies', () => {
    const check = (slots: TacticRow['slots']) =>
      roleWarnings(slots, config.roles, config.roleWarnings, config.fmCodes)
    expect(check(row.slots)).toEqual([])
    // The only DM asked to press
    const pressing = row.slots.map((s) => (s.roleOop === 'dm-oop' ? { ...s, roleOop: 'pdm' } : s))
    const warned = check(pressing)
    expect(warned).toHaveLength(2)
    expect(warned[0]).toMatch(/^We have too many pressing roles/)
    expect(warned[1]).toMatch(/^Asking our only defensive midfielder to press/)
    // A Half Back with a back three in possession
    const three = row.slots.map((s, i) =>
      i === 1
        ? { ...s, position: 'DC' as const, side: null }
        : s.role === 'dlp'
          ? { ...s, role: 'hb' }
          : s,
    )
    expect(check(three).join(' ')).toMatch(/^The Half Back role looks to drop in/)
  })
})

describe('FM’s own tactic files', () => {
  // The same tactic saved in FM three times, only Time wasting changed (encrypted files)
  it.each([
    ['less', 'Less often'],
    ['standard', 'Standard'],
    ['more', 'More often'],
  ])('reads Time wasting %s', async (file, label) => {
    // Node's own modules (tests run in Node; the app's types do not include Node)
    const node = (name: string) => import(/* @vite-ignore */ `node:${name}`)
    const { readFileSync } = (await node('fs')) as { readFileSync: (p: string) => Uint8Array }
    const { zstdDecompressSync } = (await node('zlib')) as {
      zstdDecompressSync: (b: Uint8Array) => Uint8Array
    }
    const bytes = new Uint8Array(readFileSync(`src/tactics/fixtures/time-wasting-${file}.fmf`))
    const t = await readTacticFile(bytes, async (f) => new Uint8Array(zstdDecompressSync(f)))
    const team = fromSave(t, config.roles, config.fmCodes).team!
    const def = config.teamInstructions.find((d) => d.name === 'Time wasting')!
    expect(chosen(def, team)?.label).toBe(label)
  })
})

describe('player instructions in an exported tactic', () => {
  it('writes every slot as FM itself does', async () => {
    // A tactic FM saved (the user's, with player instructions set in game): read it, export it,
    // and the in-possession blocks must be FM's own: the role with FM's flag bit, and the
    // instructions under every role FM offers at the position
    const node = (name: string) => import(/* @vite-ignore */ `node:${name}`)
    const { readFileSync } = (await node('fs')) as { readFileSync: (p: string) => Uint8Array }
    const { zstdDecompressSync } = (await node('zlib')) as {
      zstdDecompressSync: (b: Uint8Array) => Uint8Array
    }
    const unzstd = async (f: Uint8Array) => new Uint8Array(zstdDecompressSync(f))
    const bytes = new Uint8Array(readFileSync('src/tactics/fixtures/fm-saved-instructions.fmf'))
    const t = await readTacticFile(bytes, unzstd)
    const tac = await readFmfMember(bytes, '.tac', unzstd)
    const fm = parseSlots(tac)
    const app = fromSave(t, config.roles, config.fmCodes)
    const mine = readFmf(
      tacticFile(
        {
          ...row,
          name: t.name,
          mentality: app.mentality,
          slots: app.slots,
          instructions: { team: app.team },
        },
        config,
      ),
    )
    expect(mine.ip.map((b) => b.role)).toEqual(fm.ip.map((b) => b.role))
    // FM also spreads the entries of a player whose instructions were touched in game and
    // cleared again; that is not in the tactic, so only players with instructions are compared
    const set = (b: { entries: [string, string][] }) => b.entries.some(([, bits]) => bits !== '0')
    const withPi = fm.ip.flatMap((b, i) => (set(b) ? [i] : []))
    expect(withPi.length).toBe(7)
    expect(withPi.map((i) => mine.ip[i].entries)).toEqual(withPi.map((i) => fm.ip[i].entries))
    expect(mine.oop).toEqual(fm.oop)
  })
})

describe('free positions on the pitch', () => {
  it('moves players anywhere FM allows, keeping the other phase', async () => {
    const { moveSlot, fmPositions } = await import('./fm')
    const { FORMATIONS } = await import('./positions')
    const text = (p: keyof typeof POSITION_TEXT) => POSITION_TEXT[p]
    const codes = config.fmCodes
    const at = (id: string) => codes.positions.find((p) => p.id === id)!
    let slots: TacticRow['slots'] = FORMATIONS['4-3-3'].map((position) => ({ position }))
    const before = fmPositions(slots, 'ip', codes).map((p) => p?.id)
    // Every defender goes forward, as in the user's FM tactic with no defenders
    const forward = ['WBL', 'DML', 'DMR', 'WBR']
    const defenders = before.flatMap((id, i) => (id && /^D[LCR]/.test(id) ? [i] : []))
    expect(defenders).toHaveLength(4)
    defenders.forEach((i, k) => {
      slots = moveSlot(slots, i, at(forward[k]), 'ip', codes, config.roles, text)
    })
    const ip = fmPositions(slots, 'ip', codes).map((p) => p?.id)
    expect(ip.filter((id) => id && /^D[LCR]/.test(id))).toHaveLength(0)
    expect(new Set(ip).size).toBe(11)
    // Out of possession is still the 4-3-3
    expect(fmPositions(slots, 'oop', codes).map((p) => p?.id)).toEqual(before)
    // A taken spot is refused
    expect(moveSlot(slots, 1, at(ip[2]!), 'ip', codes, config.roles, text)).toBe(slots)
    // A lone centre-back keeps his side, as on FM's pitch (no re-centring)
    let two: TacticRow['slots'] = FORMATIONS['4-3-3'].map((position) => ({ position }))
    const start = fmPositions(two, 'oop', codes).map((p) => p?.id)
    const dcs = start.flatMap((id, i) => (id?.startsWith('DC') ? [i] : []))
    expect(dcs).toHaveLength(2)
    two = moveSlot(two, dcs[0], at('WBL'), 'oop', codes, config.roles, text)
    expect(fmPositions(two, 'oop', codes)[dcs[0]]?.id).toBe('WBL')
    expect(fmPositions(two, 'oop', codes)[dcs[1]]?.id).toBe(start[dcs[1]])
  })
})

describe('FM tactical styles', () => {
  it('has FM27 styles as FM shows them', async () => {
    const { DEFAULT_TACTICAL_STYLES } = await import('./styles')
    const cp = DEFAULT_TACTICAL_STYLES.find((s) => s.name === 'Control Possession')!
    expect(cp.code).toBe('CONT')
    expect(cp.mentality).toBe('Positive')
    // FM's list: Shorter Passing, Play Through Press, GK Distribute to CB, Short Goal Kicks, Lower Tempo
    const label = (c: number) =>
      config.teamInstructions.flatMap((d) =>
        d.options.filter((o) => o.code === c).map((o) => `${d.name}: ${o.label}`),
      )[0]
    const labels = cp.team!.map(label)
    for (const l of [
      'Passing directness: Shorter passes',
      'Build-up strategy: Play through the press',
      'Goalkeeper distribution: Centre-back',
      'Goal kicks: Shorter passes',
      'Tempo: Lower',
    ])
      expect(labels).toContain(l)
    expect(DEFAULT_TACTICAL_STYLES.map((s) => s.code)).toContain('GEGE')
  })

  it('names a changed style "Custom …" and exports its code', async () => {
    const { DEFAULT_TACTICAL_STYLES, styleText, styleCode } = await import('./styles')
    const gp = DEFAULT_TACTICAL_STYLES.find((s) => s.code === 'GEGE')!
    expect(styleText(gp, gp.mentality, gp.team!)).toBe('Gegenpress')
    expect(styleText(gp, 'Attacking', gp.team!)).toBe('Custom Gegenpress')
    expect(styleText(gp, gp.mentality, gp.team!.slice(1))).toBe('Custom Gegenpress')
    expect(styleCode('Custom Gegenpress', DEFAULT_TACTICAL_STYLES)).toBe('GEGE')
    expect(styleCode('My own', DEFAULT_TACTICAL_STYLES)).toBe('NULL')
    const file = tacticFile({ ...row, style: 'Custom Gegenpress' }, config)
    const back = await readTacticFile(file, async () => {
      throw new Error('raw blocks need no unpacking')
    })
    expect(back.style).toBe('Custom Gegenpress')
    const text = new TextDecoder('latin1').decode(file)
    expect(text).toContain('Custom GegenpressEGEG')
  })
})

describe('FM template tactics', () => {
  it('turns all of FM27s templates into tactics that export cleanly', async () => {
    const { FM_TEMPLATES, templateTactic } = await import('./templates')
    expect(FM_TEMPLATES).toHaveLength(90)
    const problems: string[] = []
    for (const tpl of FM_TEMPLATES) {
      const t = templateTactic(tpl, config.tacticalStyles, config.roles, config.fmCodes)
      expect(t.slots).toHaveLength(11)
      const unknown = t.slots.filter((s) => s.unknownRole || s.unknownRoleOop)
      if (unknown.length) problems.push(`${tpl.style} ${tpl.label}: unknown roles`)
      const p = exportProblems(
        {
          ...row,
          name: t.name,
          style: t.style,
          mentality: t.mentality,
          slots: t.slots,
          instructions: { team: t.team },
        },
        config,
      )
      if (p.length) problems.push(`${tpl.style} ${tpl.label}: ${p.join(' ')}`)
    }
    expect(problems).toEqual([])
  })
})

describe('FM match data', () => {
  it('counts complexity points as FM lists them', async () => {
    const { tacticComplexity } = await import('./complexity')
    const { DEFAULT_TACTICAL_STYLES } = await import('./styles')
    const gp = DEFAULT_TACTICAL_STYLES.find((s) => s.code === 'GEGE')!
    const c = tacticComplexity(row.slots, gp.team!, config)
    // Much higher tempo 2, narrower 1, counter 2, play through press 3, GK to CB 1,
    // high press 2, higher line 2, step up (hold line) 2, much more pressing 3,
    // prevent short GK 1, counter-press 3, time wasting standard 1
    expect(c.team.points).toBe(23)
    expect(c.team.max).toBe(49)
    expect(c.players).toHaveLength(11)
    const f9 = config.roles.find((r) => r.name === 'False Nine')!
    expect(f9.fm?.complexity).toBe(3)
  })

  it('finds the rating set of every in-possession role', async () => {
    const { ratingSet, DEFAULT_MATCH_DATA } = await import('./matchData')
    const ip = config.roles.filter((r) => r.phase === 'ip')
    const missing = ip.filter((r) => !ratingSet(r, DEFAULT_MATCH_DATA, config.fmCodes.roleCodeMask))
    expect(missing.map((r) => r.id)).toEqual([])
    const gk = ratingSet(
      config.roles.find((r) => r.id === 'gk-ip')!,
      DEFAULT_MATCH_DATA,
      config.fmCodes.roleCodeMask,
    )!
    expect(gk.find(([n]) => n === 'Saves')?.[1]).toBeGreaterThan(0)
    expect(DEFAULT_MATCH_DATA.ratings.start).toBe(6700)
  })

  it('matches style roles to FM27 roles by name, leaving older ones unmatched', async () => {
    const { DEFAULT_TACTICAL_STYLES, matchRoles } = await import('./styles')
    const cp = DEFAULT_TACTICAL_STYLES.find((s) => s.code === 'CONT')!
    const m = matchRoles(cp, config.roles)
    expect(m.find((x) => x.name === 'Sweeper Keeper')?.roles.map((r) => r.id)).toEqual(['sk'])
    expect(m.find((x) => x.name === 'Ball-Playing Defender')?.roles).toEqual([])
  })
})

describe('goalkeeper distribution: specific teammate', () => {
  it('is an option, also in instruction lists saved before it was found', async () => {
    const { fillAbout } = await import('./fm')
    const gk = config.teamInstructions.find((d) => d.name === 'Goalkeeper distribution')!
    expect(gk.options.find((o) => o.code === 41)?.label).toBe('Specific teammate')
    const old = [{ ...gk, options: gk.options.filter((o) => o.code !== 41) }]
    const filled = fillAbout(old, config.teamInstructions)
    expect(filled[0].options.some((o) => o.code === 41)).toBe(true)
  })
})

describe('player instruction codes', () => {
  it('stores Cross from deep as 7 and Cross from byline as 8 (checked in FM27)', () => {
    // FM showed the app's 7 as Cross from deep, and saved its own Cross from byline as 8
    const d = DEFAULT_CONFIG.playerInstructions.find((x) => x.name === 'Cross from')!
    expect(d.options.find((o) => o.code === 7)?.label).toBe('Cross from deep')
    expect(d.options.find((o) => o.code === 8)?.label).toBe('Cross from byline')
    // A list saved while the two were swapped is corrected
    const old = [
      {
        ...d,
        options: [
          { label: 'Cross from deep', code: 8 },
          { label: 'Cross from byline', code: 7 },
          { label: 'Standard', code: 0 },
        ],
      },
    ]
    const merged = mergeConfig({ playerInstructions: old } as never).playerInstructions
    const fixed = merged.find((x) => x.name === 'Cross from')!
    expect(fixed.options.find((o) => o.code === 8)?.label).toBe('Cross from byline')
  })

  it('locks what FM does not let a role change (FM Scout, as seen in game)', () => {
    const rule = (id: string, pos: string) =>
      config.roles.find((r) => r.id === id)!.fm!.instructions![pos]
    const def = (name: string) => config.playerInstructions.find((x) => x.name === name)!
    const at = (id: string) => config.fmCodes.positions.find((p) => p.id === id)!
    const role = (id: string) => config.roles.find((r) => r.id === id)!
    // Centre-Back: Forward runs fixed on Make fewer runs; Attacking width free at DCR
    expect(playerChoices(def('Forward runs'), role('cb-ip'), at('DCR'))).toMatchObject({
      forced: true,
      options: [{ label: 'Make fewer runs' }],
    })
    expect(rule('cb-ip', 'DCR').allowed).toContain(25)
    // Deep-Lying Playmaker: Passing risk fixed on Take more risks, Forward runs fixed too
    expect(playerChoices(def('Passing risk'), role('dlp'), at('DMC'))).toMatchObject({
      forced: true,
      options: [{ label: 'Take more risks' }],
    })
    expect(playerChoices(def('Forward runs'), role('dlp'), at('DMC')).forced).toBe(true)
  })
})
