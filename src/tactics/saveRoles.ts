/**
 * Roles and instructions of tactics read from the FM save.
 *
 * FM27 stores each position's role as a code plus a few settings; one tactic is not enough
 * to decode every role, so a role is recognised by that exact signature. Signatures the user
 * confirmed (their tactic screen) are built in; any role the user sets on a save tactic is
 * remembered for its signature, so it is filled in automatically from then on.
 * Team instructions are 19 codes with no published meaning: the words are kept per set of
 * codes the user confirmed, and a tactic whose codes change is flagged to check in FM.
 */
import known from './known-roles.json'

export interface SaveRole {
  bits: number | null
  trail: number | null
  settings: number[][]
}

export const roleSignature = (phase: 'ip' | 'oop', r: SaveRole) =>
  `${phase}:${r.bits}:${r.trail}:${JSON.stringify(r.settings)}`

const KNOWN_ROLES = known as Record<string, string>

/** Role id for a signature: the user's own choice first, then the built-in ones. */
export function roleFor(sig: string, learned: Record<string, string> | undefined): string | null {
  return learned?.[sig] ?? KNOWN_ROLES[sig] ?? null
}

export interface Instructions {
  /** The save's 19 team instruction codes, to spot changes. */
  codes?: string
  ip?: [string, string][]
  oop?: [string, string][]
  /** True when the codes changed in FM since the words were last confirmed. */
  changed?: boolean
}

/** Team instructions confirmed from the user's tactic screens, by code set. */
export const KNOWN_INSTRUCTIONS: Record<string, Pick<Instructions, 'ip' | 'oop'>> = {
  '4,1,4,7,2,3,128,0,0,0,10,64,80,34,98,144,0,0,255': {
    ip: [
      ['Passing Directness', 'Standard'],
      ['Tempo', 'Much Higher'],
      ['Attacking Width', 'Narrower'],
      ['Attacking Transition', 'Counter-Attack'],
      ['Creative Freedom', 'Balanced'],
      ['Time Wasting', 'Standard'],
      ['Play for Set Pieces', 'Keep Ball in Play'],
      ['Patience', 'Standard'],
      ['Shots from Distance', 'Balanced'],
      ['Crossing Style', 'Balanced'],
      ['Dribbling', 'Balanced'],
      ['Supporting Runs', 'Balanced'],
      ['Progress Through', 'Balanced'],
      ['Pass Reception', 'Balanced'],
      ['Build-Up Strategy', 'Play Through Press'],
      ['Goal Kicks', 'Mixed'],
      ['GK Distribution (Speed)', 'Balanced'],
      ['GK Distribution', 'Centre-Backs'],
    ],
    oop: [
      ['Line of Engagement', 'High Press'],
      ['Defensive Line', 'Higher'],
      ['Defensive Line Behaviour', 'Step Up More'],
      ['Trigger Press', 'Much More Often'],
      ['Defensive Transition', 'Counter-Press'],
      ['Tackling', 'Standard'],
      ['Short Goalkeeper Distribution', 'Yes'],
      ['Pressing Trap', 'Balanced'],
      ['Cross Engagement', 'Balanced'],
    ],
  },
}

/** Instructions for a save tactic: known words for its codes, else the previous words flagged. */
export function instructionsFor(
  codes: number[] | undefined,
  previous: Instructions | undefined,
  learned: Record<string, Pick<Instructions, 'ip' | 'oop'>> | undefined,
): Instructions {
  const key = (codes ?? []).join(',')
  const words = learned?.[key] ?? KNOWN_INSTRUCTIONS[key]
  if (words) return { codes: key, ...words }
  if (previous?.codes === key) return previous
  return { codes: key, ip: previous?.ip ?? [], oop: previous?.oop ?? [], changed: true }
}
