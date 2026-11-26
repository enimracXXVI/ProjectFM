import type { CSSProperties } from 'react'
import type { LoanColors } from '../data/config'

/**
 * Inline styles for a player on loan at the club, by Settings > Colours: a tinted row (opaque,
 * so frozen table cells match) and/or a coloured name.
 */
export const loanRowStyle = (c: LoanColors): CSSProperties | undefined =>
  c.mode === 'row'
    ? { backgroundColor: `color-mix(in srgb, ${c.color} 16%, var(--color-surface))` }
    : undefined

export const loanNameStyle = (c: LoanColors): CSSProperties | undefined =>
  c.mode === 'off' ? undefined : { color: c.color }
