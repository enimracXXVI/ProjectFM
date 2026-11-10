/**
 * Default codes for FM's "Inf" column. Only confirmed meanings are listed.
 * Users add and edit codes in the app under Settings → Statuses.
 */

export const STATUS_TONES = ['gray', 'red', 'amber', 'emerald', 'sky', 'violet'] as const
export type StatusTone = (typeof STATUS_TONES)[number]

export interface StatusInfo {
  label: string
  tone: StatusTone
}

export const DEFAULT_STATUSES: Record<string, StatusInfo> = {
  Inj: {
    label: 'Injured',
    tone: 'red',
  },
}

export const TONE_CLASSES: Record<StatusTone, string> = {
  gray: 'bg-surface-2 text-muted',
  red: 'bg-red-500/15 text-red-300',
  amber: 'bg-amber-500/15 text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  sky: 'bg-sky-500/15 text-sky-300',
  violet: 'bg-violet-500/15 text-violet-300',
}
