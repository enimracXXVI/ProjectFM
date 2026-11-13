import { useAllCompetitions } from '../competitions/hooks'
import { fixtureKey, myFixtures } from '../competitions/view'
import { useCurrentCareer } from '../lib/career'
import { byLastName } from '../lib/names'
import { usePlayers, useStaff } from '../data/hooks'
import { matchLinkHref, matchLinkKey, type NoteLink } from '../data/notes'

export interface LinkTarget {
  link: NoteLink
  label: string
  href: string
}

/** Everything a note can link to in the current career, and how to show a link. */
export function useNoteTargets() {
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { data: staff } = useStaff(career.id)
  const { data: files } = useAllCompetitions(career.id)

  const playerTargets: LinkTarget[] = [...(players ?? [])]
    .filter((p) => p.in_squad)
    .sort(byLastName)
    .map((p) => ({ link: { kind: 'player', id: p.id }, label: p.name, href: `/squad/${p.id}` }))
  const staffTargets: LinkTarget[] = [...(staff ?? [])].sort(byLastName).map((s) => ({
    link: { kind: 'staff', id: s.id },
    label: `${s.name}${s.role ? ` (${s.role})` : ''}`,
    href: `/staff/${s.id}`,
  }))
  const matchTargets: LinkTarget[] = files
    .flatMap((file) =>
      file.competitions.flatMap((comp) =>
        myFixtures(file, comp).map((f) => {
          const key = matchLinkKey(comp.databaseId, fixtureKey(f), file.season)
          const score = f.played && f.hg !== null ? `${f.hg}–${f.ag}` : 'v'
          return {
            link: { kind: 'match' as const, id: key },
            label: `${f.date ?? ''} ${f.homeShort ?? f.homeName} ${score} ${f.awayShort ?? f.awayName}`,
            href: matchLinkHref(key),
            date: f.date ?? '',
          }
        }),
      ),
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  // Links to someone or something no longer listed still show, with what is known
  const describe = (link: NoteLink): LinkTarget => {
    const list =
      link.kind === 'player' ? playerTargets : link.kind === 'staff' ? staffTargets : matchTargets
    const found = list.find((t) => t.link.id === link.id)
    if (found) return found
    const p = link.kind === 'player' ? players?.find((x) => x.id === link.id) : undefined
    return {
      link,
      label:
        p?.name ??
        (link.kind === 'match' ? (link.id.split('|')[1]?.slice(0, 10) ?? 'Match') : 'Unknown'),
      href:
        link.kind === 'player'
          ? `/squad/${link.id}`
          : link.kind === 'staff'
            ? `/staff/${link.id}`
            : matchLinkHref(link.id),
    }
  }
  return { players: playerTargets, staff: staffTargets, matches: matchTargets, describe }
}
