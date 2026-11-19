import type { ReportPlayer } from './types'

/**
 * Who replaced whom where the save does not say (it only records the pairs for your own
 * team). Changes at the same minute are paired by the position played (a substitute takes
 * the position of the player he replaced), then, when one change is left, by elimination.
 * Changes that still cannot be told apart stay unpaired, with the others of that minute listed.
 * Checked on Fiorentina v Atalanta (6 Sep 2026): all five changes paired as in FM.
 */
export function pairSubs(players: ReportPlayer[]): (ReportPlayer & { together?: string[] })[] {
  if (players.some((p) => p.for || p.replacedBy)) return players
  const out = players.map((p) => ({ ...p }) as ReportPlayer & { together?: string[] })
  const minutes = new Set(out.filter((p) => p.on).map((p) => p.on!))
  for (const minute of minutes) {
    const offs = out.filter((p) => p.off === minute)
    const ons = out.filter((p) => p.on === minute)
    const pair = (off: (typeof out)[number], on: (typeof out)[number]) => {
      on.for = off.name
      off.replacedBy = on.name
    }
    // Same position first
    for (const on of ons) {
      const off = offs.find((o) => !o.replacedBy && o.pos && o.pos === on.pos)
      if (off) pair(off, on)
    }
    // One left on each side: they belong together
    const freeOffs = offs.filter((o) => !o.replacedBy)
    const freeOns = ons.filter((o) => !o.for)
    if (freeOffs.length === 1 && freeOns.length === 1) pair(freeOffs[0], freeOns[0])
    else {
      for (const on of freeOns) on.together = freeOffs.map((o) => o.name ?? '?')
      for (const off of freeOffs) off.together = freeOns.map((o) => o.name ?? '?')
    }
  }
  return out
}
