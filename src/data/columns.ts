import { HIDDEN_EXTRA_KEYS } from '../import/dump'

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
}

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
  ...HIDDEN_EXTRA_KEYS,
])

/** Coach star ratings shown with the profile. */
export const RATING_KEYS = ['Ability', 'Potential'] as const
