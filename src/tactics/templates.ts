/**
 * FM's template tactics: nine per tactical style (shape in and out of possession, roles,
 * player and team instructions), read from FM27's match data (simatch.fmf, tactics folder).
 */
import templates from './fm-templates.json'
import type { RoleDef } from '../data/roles'
import { fromSave, type FmCodes } from './fm'
import { styleText, type TacticalStyle } from './styles'
import type { SaveTactics } from './types'

export interface FmTemplate {
  /** Code of the tactical style it belongs to. */
  style: string
  /** Shape in possession / out of possession, as FM names the file. */
  label: string
  /** FM's 19 team instruction bytes (mentality is byte 2, the instructions 6–17). */
  codes: number[]
  slots: {
    mask?: number
    maskOop?: number
    role?: string
    roleOop?: string
    pi?: string
    piOop?: string
    markOop?: number
  }[]
}

export const FM_TEMPLATES = templates as FmTemplate[]

/** A template as a new tactic in the app's terms. */
export function templateTactic(
  t: FmTemplate,
  styles: TacticalStyle[],
  roles: RoleDef[],
  codes: FmCodes,
) {
  const save: SaveTactics['tactics'][number] = {
    index: -1,
    name: t.label,
    style: null,
    mentality: null,
    instructionCodes: t.codes,
    slots: t.slots.map((s, number) => ({
      number,
      position: null,
      positionOop: null,
      mask: s.mask ?? null,
      maskOop: s.maskOop ?? null,
      role: s.role ?? null,
      roleOop: s.roleOop ?? null,
      pi: s.pi ?? null,
      piOop: s.piOop ?? null,
      markOop: s.markOop ?? null,
    })),
  }
  const read = fromSave(save, roles, codes)
  const style = styles.find((s) => s.code === t.style) ?? null
  const team = read.team ?? []
  return {
    name: style ? `${style.name} ${t.label.split(' / ')[0]}` : t.label,
    style: style ? styleText(style, read.mentality, team) : null,
    mentality: read.mentality,
    slots: read.slots,
    team,
  }
}
