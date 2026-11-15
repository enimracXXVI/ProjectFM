/**
 * Roles from older FMs that FM27 still defines (FM27's role list in its screen code) but no
 * longer offers in its tactics screens. Kept for reading old tactics and FM's style data;
 * hidden in the app unless switched on in Settings > Older roles.
 */
import type { RoleDef } from './roles'

export type OlderRole = RoleDef & {
  /** Show it in the app like an FM27 role. */
  show: boolean
}

const role = (id: string, name: string, code: string): OlderRole => ({
  id,
  name,
  phase: 'ip',
  group: 'Older roles',
  positions: [],
  key: [],
  preferred: [],
  fm: { code },
  about: 'A role from older FMs. FM27 still defines it but no longer offers it.',
  show: false,
})

// Names and numbers from FM27's in-possession role list (FM.UI InPossessionRole)
export const DEFAULT_OLDER_ROLES: OlderRole[] = [
  role('old-nnfb', 'No-Nonsense Full-Back', '68719476736'),
  role('old-bwm', 'Ball-Winning Midfielder', '268435456'),
  role('old-a', 'Anchor', '8589934592'),
  role('old-eng', 'Enganche', '137438953472'),
  role('old-reg', 'Regista', '549755813888'),
  role('old-mez', 'Mezzala', '140737488355328'),
  role('old-svol', 'Segundo Volante', '1125899906842624'),
  role('old-dw', 'Defensive Winger', '1073741824'),
  role('old-wtf', 'Wide Target Forward', '4398046511104'),
  role('old-cf', 'Complete Forward', '1048576'),
]

/** The older roles switched on, as plain roles. */
export const shownOlderRoles = (list: OlderRole[]): RoleDef[] =>
  list.filter((r) => r.show).map(({ show: _, ...r }) => r)
