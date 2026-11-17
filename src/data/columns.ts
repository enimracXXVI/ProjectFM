import { HIDDEN_EXTRA_KEYS, READER_EXTRA_KEYS } from '../import/dump'

/**
 * Default columns for the Contract and Stats tabs. Keys are the FM View Exporter
 * column headers, exactly as they appear in the export.
 */

export interface ExtraColumn {
  /** Column header in the FM export (where the value is stored). */
  key: string
  /** Short header for the squad table. */
  short: string
  /** Full name, shown as the tooltip title (defaults to the FM header). */
  label?: string
  /** Shown in the tooltip under the title. */
  description?: string
  /** Stats only: the box the column is shown in on the player page (General, Attacking…). */
  group?: string
}

/** Default boxes for stats columns on the player page; columns not listed go to Other. */
export const DEFAULT_STAT_GROUPS: Record<string, string> = {
  Apps: 'General',
  Starts: 'General',
  'Sub apps': 'General',
  Minutes: 'General',
  Rating: 'General',
  'Player of the Match': 'General',
  'Pts/Gm': 'General',
  'Tgls/90': 'General',
  'Tcon/90': 'General',
  'Distance (km)': 'General',
  Goals: 'Attacking',
  xG: 'Attacking',
  'xG-OP': 'Attacking',
  'xG/90': 'Attacking',
  'Conv %': 'Attacking',
  Shots: 'Attacking',
  'Shots on target': 'Attacking',
  'Drb/90': 'Attacking',
  Assists: 'Creating',
  xA: 'Creating',
  'xA/90': 'Creating',
  'Key passes': 'Creating',
  'OP-KP/90': 'Creating',
  'Pr passes/90': 'Creating',
  'Pass %': 'Creating',
  'Clear-cut chances': 'Creating',
  'Cr C/A': 'Creating',
  'Crs A/90': 'Creating',
  'Hdr %': 'Defending',
  'Int/90': 'Defending',
  'Tck R': 'Defending',
  'Tck/90': 'Defending',
  'K Tck/90': 'Defending',
  MLG: 'Defending',
  'Clean sheets': 'Defending',
  'xG prevented': 'Defending',
  'Yellow cards': 'Discipline',
  'Red cards': 'Discipline',
}

/** The box a stats column is shown in. */
export const statGroup = (c: ExtraColumn) =>
  c.group?.trim() || DEFAULT_STAT_GROUPS[c.key] || 'Other'

export type ExtraViewKey = 'contract' | 'stats'

export interface ExtraView {
  label: string
  columns: ExtraColumn[]
}

export const CONTRACT_VIEW: ExtraView = {
  label: 'Contract',
  columns: [
    {
      key: 'Contract Status',
      short: 'Contract',
    },
    {
      key: 'Playing Time',
      short: 'Playing Time',
    },
    {
      key: 'Actual Playing Time',
      short: 'Actual PT',
    },
    {
      key: 'Wage',
      short: 'Wage',
    },
    {
      key: 'Expires',
      short: 'Expires',
    },
    {
      key: 'Optional Contract Extension By Club',
      short: 'Opt. Ext.',
    },
    {
      key: 'Transfer Value',
      short: 'Value',
    },
    {
      key: 'Minimum Fee Release Clause',
      short: 'Release Clause',
    },
    {
      key: 'Sell On Fee Percentage',
      short: 'Sell-on %',
    },
    {
      key: 'Yearly Wage Rise',
      short: 'Wage Rise',
    },
  ],
}

export const STATS_VIEW: ExtraView = {
  label: 'Stats',
  columns: [
    'Apps',
    'Minutes',
    'Rating',
    'Goals',
    'xG',
    'xG-OP',
    'xG/90',
    'Conv %',
    'Assists',
    'xA',
    'xA/90',
    'Tgls/90',
    'Pts/Gm',
    'Tcon/90',
    'Drb/90',
    'OP-KP/90',
    'Pr passes/90',
    'Hdr %',
    'MLG',
    'Int/90',
    'Tck R',
    'Tck/90',
    'K Tck/90',
    'Cr C/A',
    'Crs A/90',
  ].map((key) => ({ key, short: key })),
}

export const DEFAULT_VIEWS: Record<ExtraViewKey, ExtraView> = {
  contract: CONTRACT_VIEW,
  stats: STATS_VIEW,
}

/** Extra keys with their own place in the app (not offered as Contract/Stats columns). */
export const RESERVED_EXTRA_KEYS = new Set([
  'selection',
  'status',
  'Ability',
  'Potential',
  'Nation code',
  'team',
  ...HIDDEN_EXTRA_KEYS,
  ...READER_EXTRA_KEYS,
])

/** Coach star ratings shown with the profile. */
export const RATING_KEYS = ['Ability', 'Potential'] as const
