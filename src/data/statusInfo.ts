/**
 * Default codes for FM's "Inf" column. Only confirmed meanings are listed.
 * Users add and edit codes in the app under Settings → Statuses.
 */

export interface StatusInfo {
  /** Meaning, shown as the tooltip title. */
  label: string
  description: string
  /** Badge background colour (hex). */
  bg: string
  /** Badge text colour (hex). */
  fg: string
}

export const DEFAULT_BADGE = {
  bg: '#18233b',
  fg: '#8a97b3',
}

export const DEFAULT_STATUSES: Record<string, StatusInfo> = {
  Inj: {
    label: 'Injured',
    description: '',
    bg: '#4c1d24',
    fg: '#fca5a5',
  },
}

// Colours used by the first version of the Statuses page, before hex colours
const LEGACY_TONES: Record<string, { bg: string; fg: string }> = {
  gray: DEFAULT_BADGE,
  red: { bg: '#4c1d24', fg: '#fca5a5' },
  amber: { bg: '#4a3517', fg: '#fcd34d' },
  emerald: { bg: '#123d33', fg: '#6ee7b7' },
  sky: { bg: '#123a52', fg: '#7dd3fc' },
  violet: { bg: '#2e2457', fg: '#c4b5fd' },
}

/** Fills in missing fields of a stored status (also upgrades the old colour names). */
export function normalizeStatus(s: Partial<StatusInfo> & { tone?: string }): StatusInfo {
  const legacy = LEGACY_TONES[s.tone ?? ''] ?? DEFAULT_BADGE
  return {
    label: s.label ?? '',
    description: s.description ?? '',
    bg: s.bg ?? legacy.bg,
    fg: s.fg ?? legacy.fg,
  }
}
