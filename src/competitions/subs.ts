import type { ReportPlayer } from './types'

/**
 * Who replaced whom where the save does not say (it only records the pairs for your own
 * team): a player who came on is paired with the one who went off at the same minute when
 * that minute had a single change. Changes made together at one minute stay unpaired, with
 * the others of that minute listed (FM's save has no record of who replaced whom then).
 */
export function pairSubs(players: ReportPlayer[]): (ReportPlayer & { together?: string[] })[] {
  if (players.some((p) => p.for || p.replacedBy)) return players
  const offAt = new Map<number, ReportPlayer[]>()
  const onAt = new Map<number, ReportPlayer[]>()
  for (const p of players) {
    if (p.off) offAt.set(p.off, [...(offAt.get(p.off) ?? []), p])
    if (p.on) onAt.set(p.on, [...(onAt.get(p.on) ?? []), p])
  }
  return players.map((p) => {
    if (p.on) {
      const offs = offAt.get(p.on) ?? []
      const ons = onAt.get(p.on) ?? []
      if (offs.length === 1 && ons.length === 1) return { ...p, for: offs[0].name }
      if (offs.length > 1) return { ...p, together: offs.map((x) => x.name ?? '?') }
    }
    if (p.off) {
      const ons = onAt.get(p.off) ?? []
      const offs = offAt.get(p.off) ?? []
      if (ons.length === 1 && offs.length === 1) return { ...p, replacedBy: ons[0].name }
      if (ons.length > 1) return { ...p, together: ons.map((x) => x.name ?? '?') }
    }
    return p
  })
}
