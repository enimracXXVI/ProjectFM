import { supabase } from '../lib/supabase'
import {
  ATTRIBUTE_INFO,
  PROFILE_COLUMNS,
  type AttributeInfo,
  type AttributeSection,
  type Role,
} from './attributeInfo'
import type { CompetitionInfo } from '../competitions/types'
import { DEFAULT_VIEWS, type ExtraView, type ExtraViewKey } from './columns'
import { DEFAULT_ROLE_WEIGHTS, type RoleWeights } from '../lib/roleFit'
import { DEFAULT_REGIONS, type Region } from './regions'
import { DEFAULT_ROLES, type RoleDef } from './roles'
import {
  DEFAULT_KNOWLEDGE_LEVELS,
  DEFAULT_STAFF_SCALE,
  DEFAULT_STAFF_SCALE_MIN,
  KEY_ATTRIBUTES_BY_JOB,
  STAFF_TABS,
  type StaffSection,
  type StaffTab,
} from './staffInfo'
import { DEFAULT_PERSONALITY_RULES, type PersonalityRule } from '../lib/personality'
import { DEFAULT_FOOT_MINS, DEFAULT_FOOT_WORDS } from '../import/dump'
import { DEFAULT_JOB_GROUPS, DEFAULT_STAFF_SHORT, type StaffGroup } from './staffJobs'
import { DEFAULT_INSTRUCTIONS, type InstructionDef } from '../tactics/instructionList'
import { DEFAULT_STATUSES, normalizeStatus, type StatusInfo } from './statusInfo'

export type Layout = Record<Role, AttributeSection[][]>

/** Everything the user can customise in Settings. */
export interface AppConfig {
  statuses: Record<string, StatusInfo>
  attributes: Record<string, AttributeInfo>
  layout: Layout
  views: Record<ExtraViewKey, ExtraView>
  regions: Region[]
  /** Staff rating words, worst to best. */
  staffScale: string[]
  /** Lowest 1–20 value of each staff rating word (same order as staffScale). */
  staffScaleMin: number[]
  /** FM's staff profile tabs: the attribute sections of each tab. */
  staffTabs: Record<StaffTab, StaffSection[]>
  /** FM's Key Attributes for each staff job. */
  staffKeyAttrs: Record<string, string[]>
  /** Staff category of each job title. */
  staffGroups: Record<string, StaffGroup>
  /** Short column header of each staff attribute. */
  staffShort: Record<string, string>
  /** Scouting knowledge levels, lowest to highest. */
  knowledgeLevels: string[]
  roles: RoleDef[]
  roleWeights: RoleWeights
  /** Show values FM keeps hidden (CA/PA, hidden attributes, personality values). */
  showHidden: boolean
  /** FM words the user taught for values the app could not name (value → word). */
  learned: Learned
  /** Competitions by FM database id: name and type. */
  competitions: Record<string, CompetitionInfo>
  /** Sections in the phone bottom bar (paths, up to 5, in order). */
  mobileBar: string[]
  /** Personality ranges and overlap rules, used to name personalities at import. */
  personalityRules: PersonalityRule[]
  /** Foot strength words, weakest to strongest. */
  footWords: string[]
  /** Lowest 1–20 value of each foot word (same order as footWords). */
  footMins: number[]
  /** FM's team instructions and their options, by phase. */
  teamInstructions: InstructionDef[]
}

export interface Learned {
  morale: Record<string, string>
  knowledge: Record<string, string>
  /** Cup round names by FM round code. */
  rounds?: Record<string, string>
  /** Staff job titles by the save's job code. */
  jobs?: Record<string, string>
  /** Tactic role ids by the save's role signature. */
  roles?: Record<string, string>
  /** Team instruction words by the save's instruction codes. */
  instructions?: Record<string, { ip?: [string, string][]; oop?: [string, string][] }>
}

export type ConfigKey = keyof AppConfig

export const DEFAULT_CONFIG: AppConfig = {
  statuses: DEFAULT_STATUSES,
  attributes: ATTRIBUTE_INFO,
  layout: PROFILE_COLUMNS,
  views: DEFAULT_VIEWS,
  regions: DEFAULT_REGIONS,
  staffScale: DEFAULT_STAFF_SCALE,
  staffScaleMin: DEFAULT_STAFF_SCALE_MIN,
  staffTabs: Object.fromEntries(STAFF_TABS.map(([t, , sections]) => [t, sections])) as Record<
    StaffTab,
    StaffSection[]
  >,
  staffKeyAttrs: KEY_ATTRIBUTES_BY_JOB,
  staffGroups: DEFAULT_JOB_GROUPS,
  staffShort: DEFAULT_STAFF_SHORT,
  knowledgeLevels: DEFAULT_KNOWLEDGE_LEVELS,
  roles: DEFAULT_ROLES,
  roleWeights: DEFAULT_ROLE_WEIGHTS,
  showHidden: false,
  learned: { morale: {}, knowledge: {}, rounds: {} },
  // Confirmed by the user from FM
  competitions: {
    '32': { name: 'Serie A', kind: 'league' },
    '1301412': { name: 'Coppa Italia', kind: 'cup' },
    '104551': { name: 'Friendlies', kind: 'friendlies' },
  },
  mobileBar: ['/', '/squad', '/development', '/scouting', '/world'],
  personalityRules: DEFAULT_PERSONALITY_RULES,
  footWords: DEFAULT_FOOT_WORDS,
  footMins: DEFAULT_FOOT_MINS,
  teamInstructions: DEFAULT_INSTRUCTIONS,
}

type Stored = Partial<{ [K in ConfigKey]: AppConfig[K] }>

/** Applies the user's saved settings on top of the defaults. */
export function mergeConfig(stored: Stored): AppConfig {
  return {
    statuses: Object.fromEntries(
      Object.entries(stored.statuses ?? DEFAULT_CONFIG.statuses).map(([k, v]) => [
        k,
        normalizeStatus(v),
      ]),
    ),
    // Per attribute, so new defaults (e.g. a new attribute) still appear
    attributes: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.attributes).map(([k, v]) => [
        k,
        { ...v, ...stored.attributes?.[k] },
      ]),
    ),
    layout: stored.layout ?? DEFAULT_CONFIG.layout,
    views: { ...DEFAULT_CONFIG.views, ...stored.views },
    regions: stored.regions ?? DEFAULT_CONFIG.regions,
    staffScale: stored.staffScale ?? DEFAULT_CONFIG.staffScale,
    staffScaleMin: stored.staffScaleMin ?? DEFAULT_CONFIG.staffScaleMin,
    staffTabs: { ...DEFAULT_CONFIG.staffTabs, ...stored.staffTabs },
    staffKeyAttrs: stored.staffKeyAttrs ?? DEFAULT_CONFIG.staffKeyAttrs,
    staffGroups: { ...DEFAULT_CONFIG.staffGroups, ...stored.staffGroups },
    staffShort: { ...DEFAULT_CONFIG.staffShort, ...stored.staffShort },
    knowledgeLevels: withOutstanding(stored.knowledgeLevels) ?? DEFAULT_CONFIG.knowledgeLevels,
    roles: stored.roles ?? DEFAULT_CONFIG.roles,
    roleWeights: { ...DEFAULT_CONFIG.roleWeights, ...stored.roleWeights },
    showHidden: stored.showHidden ?? DEFAULT_CONFIG.showHidden,
    learned: { ...DEFAULT_CONFIG.learned, ...stored.learned },
    competitions: { ...DEFAULT_CONFIG.competitions, ...stored.competitions },
    mobileBar: stored.mobileBar ?? DEFAULT_CONFIG.mobileBar,
    personalityRules: stored.personalityRules ?? DEFAULT_CONFIG.personalityRules,
    footWords: stored.footWords ?? DEFAULT_CONFIG.footWords,
    footMins: stored.footMins ?? DEFAULT_CONFIG.footMins,
    teamInstructions: stored.teamInstructions ?? DEFAULT_CONFIG.teamInstructions,
  }
}

export async function loadStoredConfig(): Promise<Stored> {
  const { data, error } = await supabase.from('app_settings').select('key, value')
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Stored
}

export async function saveConfig<K extends ConfigKey>(key: K, value: AppConfig[K]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'user_id,key' })
  if (error) throw new Error(error.message)
}

export async function resetConfig(key: ConfigKey): Promise<void> {
  const { error } = await supabase.from('app_settings').delete().eq('key', key)
  if (error) throw new Error(error.message)
}

/** Table columns: the layout's sections, left to right. */
export function tableSections(layout: Layout, role: Role): AttributeSection[] {
  return layout[role].flat()
}

export function attributeLabel(config: AppConfig, name: string): string {
  return config.attributes[name]?.label || name
}

/** FM27 has "Outstanding" between Exceptional and Complete (seen on Tomás Amaral's screen). */
function withOutstanding(levels: string[] | undefined) {
  if (!levels || levels.includes('Outstanding')) return levels
  const i = levels.indexOf('Complete')
  return i < 0 ? levels : [...levels.slice(0, i), 'Outstanding', ...levels.slice(i)]
}
