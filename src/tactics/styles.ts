/**
 * FM's tactical styles (Control Possession, Gegenpress…): the mentality and team instructions
 * each sets, the code FM stores with a tactic, and FM's own descriptions. Read from FM27's
 * match data (simatch.fmf: tactics/styles.xml and one .stra file per style). Editable in
 * Settings > Tactical styles.
 */
import styles from './fm-styles.json'

export interface TacticalStyle {
  /** The 4 letters FM stores with a tactic (NULL for no style). */
  code: string
  name: string
  mentality: string
  /** Team instruction codes the style sets (null: FM's standard ones). */
  team: number[] | null
  about: string
  /** FM's short points under the name. */
  summary: string[]
  /** FM's features of play. */
  features: string[]
  /** Attributes the style favours. */
  favoured: string[]
}

export const DEFAULT_TACTICAL_STYLES = styles as TacticalStyle[]

/** FM names a preset style it has changed "Custom <style>". */
const CUSTOM = /^custom\s+/i

/** The style a tactic's style text names (also its "Custom …" version). */
export function styleOf(text: string | null | undefined, list: TacticalStyle[]) {
  const name = (text ?? '').trim().replace(CUSTOM, '').toLowerCase()
  return name ? (list.find((s) => s.name.toLowerCase() === name) ?? null) : null
}

/** The style code FM stores for a tactic's style text (NULL when it names no style). */
export const styleCode = (text: string | null | undefined, list: TacticalStyle[]) =>
  styleOf(text, list)?.code ?? 'NULL'

/** The style's text for a tactic: its name, or "Custom <name>" once its instructions differ. */
export function styleText(style: TacticalStyle, mentality: string | null, team: number[]) {
  const same =
    (mentality ?? '').toLowerCase() === style.mentality.toLowerCase() &&
    (style.team === null ||
      (team.length === style.team.length && style.team.every((c) => team.includes(c))))
  return same ? style.name : `Custom ${style.name}`
}
