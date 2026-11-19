/**
 * Tactic assistant helpers: the first team, and how well the squad suits each FM style
 * (FM27's favoured attributes). The tactic itself is built in builder.ts.
 */
import type { PlayerRow } from '../data/db'
import { attrNumber } from '../lib/attributes'
import { POSITION_TEXT } from './positions'
import type { TacticalStyle } from './styles'
import type { TacticSlot } from './types'

/** FM's "Set Piece Ability" is no single attribute: the set piece attributes stand in. */
const SET_PIECES = ['Corners', 'Free Kick Taking', 'Long Throws', 'Penalty Taking']

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const attr = (p: PlayerRow, name: string) =>
  name === 'Set Piece Ability'
    ? avg(SET_PIECES.map((a) => attrNumber(p.attributes[a])))
    : attrNumber(p.attributes[name])

/** First-team players the assistant picks from. */
export const firstTeam = (squad: PlayerRow[]) => squad.filter((p) => p.in_squad && !p.extra.team)

/**
 * How well the squad suits each style: the squad's average in the attributes FM says the
 * style favours (best 16 players for each attribute, so a few weak reserves do not count).
 */
export function styleFits(styles: TacticalStyle[], squad: PlayerRow[]) {
  return styles
    .filter((s) => s.favoured.length)
    .map((s) => {
      const per = s.favoured.map((a) => {
        const top = squad
          .map((p) => attr(p, a))
          .filter((x): x is number => x !== null)
          .sort((x, y) => y - x)
          .slice(0, 16)
        return { attribute: a, value: avg(top) }
      })
      return { style: s, score: avg(per.map((x) => x.value)), per }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

/** Position text of a slot, for display. */
export const slotPosition = (s: TacticSlot) => (s.position ? POSITION_TEXT[s.position] : '?')
