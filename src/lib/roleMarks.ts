/**
 * How a role's attributes are marked everywhere (profile, compare, tactics, settings).
 * Key: FM27's own look (a dark green row with a bright green bar, as on its staff and role
 * screens). Preferred: a different colour so the two never look alike; FM's own colour for it
 * is not confirmed yet (?).
 */
export const KEY_ROW = 'bg-[#123f27] font-semibold shadow-[inset_3px_0_0_#35d07f]'
export const PREFERRED_ROW = 'bg-amber-400/10 shadow-[inset_3px_0_0_rgb(251_191_36/0.7)]'
/** For cells that must keep their own background (sticky table columns). */
export const KEY_LABEL = 'font-semibold text-[#5ee39b] shadow-[inset_3px_0_0_#35d07f]'
export const PREFERRED_LABEL = 'text-amber-200 shadow-[inset_3px_0_0_rgb(251_191_36/0.7)]'
/** Legend swatches. */
export const KEY_SWATCH = 'bg-[#35d07f]'
export const PREFERRED_SWATCH = 'bg-amber-400/70'
/** Chips (Settings > Roles, tactic slot panel). */
export const KEY_CHIP = 'border-[#35d07f] bg-[#123f27] text-[#5ee39b]'
export const PREFERRED_CHIP = 'border-amber-400/70 bg-amber-400/10 text-amber-200'
