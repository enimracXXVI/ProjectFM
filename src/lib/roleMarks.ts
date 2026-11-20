/**
 * How a role's attributes are marked everywhere (profile, compare, tactics, settings): key
 * attributes green and preferred ones blue, as FM27 does, or the colours set in Settings >
 * Colours (applied as the CSS variables --role-key and --role-pref).
 */
export const DEFAULT_ROLE_COLORS = { key: '#35d07f', preferred: '#4aa3ff' }

export const KEY_ROW =
  'bg-[color-mix(in_srgb,var(--role-key)_22%,transparent)] font-semibold shadow-[inset_3px_0_0_var(--role-key)]'
export const PREFERRED_ROW =
  'bg-[color-mix(in_srgb,var(--role-pref)_16%,transparent)] shadow-[inset_3px_0_0_var(--role-pref)]'
/** For cells that must keep their own background (sticky table columns). */
export const KEY_LABEL =
  'font-semibold text-[var(--role-key)] shadow-[inset_3px_0_0_var(--role-key)]'
export const PREFERRED_LABEL = 'text-[var(--role-pref)] shadow-[inset_3px_0_0_var(--role-pref)]'
/** Legend swatches. */
export const KEY_SWATCH = 'bg-[var(--role-key)]'
export const PREFERRED_SWATCH = 'bg-[var(--role-pref)]'
/** Chips (Settings > Roles, tactic slot panel). */
export const KEY_CHIP =
  'border-[var(--role-key)] bg-[color-mix(in_srgb,var(--role-key)_18%,transparent)] text-[var(--role-key)]'
export const PREFERRED_CHIP =
  'border-[var(--role-pref)] bg-[color-mix(in_srgb,var(--role-pref)_14%,transparent)] text-[var(--role-pref)]'
/** Text only. */
export const KEY_TEXT = 'text-[var(--role-key)]'
export const PREFERRED_TEXT = 'text-[var(--role-pref)]'

/** Applies the role colours to the page. */
export function applyRoleColors(c: { key: string; preferred: string }) {
  const root = document.documentElement.style
  root.setProperty('--role-key', c.key || DEFAULT_ROLE_COLORS.key)
  root.setProperty('--role-pref', c.preferred || DEFAULT_ROLE_COLORS.preferred)
}
