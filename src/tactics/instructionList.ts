import { KNOWN_INSTRUCTIONS } from './saveRoles'

export type InstructionPhase = 'ip' | 'oop'

/** One FM team instruction and the options FM offers for it (editable in Settings). */
export interface InstructionDef {
  phase: InstructionPhase
  name: string
  options: string[]
}

/**
 * Starting list: the instructions read from the user's own tactic screen, each with the one
 * option seen there. The user adds FM's other options (and any missing instructions).
 */
export const DEFAULT_INSTRUCTIONS: InstructionDef[] = Object.values(KNOWN_INSTRUCTIONS).flatMap(
  (set) =>
    (['ip', 'oop'] as const).flatMap((phase) =>
      (set[phase] ?? []).map(([name, value]) => ({ phase, name, options: [value] })),
    ),
)

export const PHASE_LABELS: Record<InstructionPhase, string> = {
  ip: 'In possession',
  oop: 'Out of possession',
}
