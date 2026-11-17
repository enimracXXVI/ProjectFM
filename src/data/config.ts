import { supabase } from '../lib/supabase'
import {
  ATTRIBUTE_INFO,
  HIDDEN_INFO,
  HIDDEN_NAMES,
  PROFILE_COLUMNS,
  type AttributeInfo,
  type AttributeSection,
  type Role,
} from './attributeInfo'
import type { CompetitionInfo } from '../competitions/types'
import { DEFAULT_VIEWS, type ExtraView, type ExtraViewKey } from './columns'
import { DEFAULT_ROLE_WEIGHTS, type RoleWeights } from '../lib/roleFit'
import { DEFAULT_REGIONS, type Region } from './regions'
import { DEFAULT_ROLES, withFmCodes, type RoleDef } from './roles'
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
import {
  DEFAULT_FM_CODES,
  DEFAULT_PLAYER_INSTRUCTIONS,
  DEFAULT_TEAM_INSTRUCTIONS,
  fillAbout,
  isInstructionList,
  type FmCodes,
  type FmInstruction,
} from '../tactics/fm'
import { DEFAULT_ROLE_WARNINGS, type RoleWarning } from '../tactics/warnings'
import { DEFAULT_TACTICAL_STYLES, type TacticalStyle } from '../tactics/styles'
import { DEFAULT_MATCH_DATA, type MatchData } from '../tactics/matchData'
import { DEFAULT_OLDER_ROLES, shownOlderRoles, type OlderRole } from './olderRoles'
import { DEFAULT_TRAIT_NAMES } from './traits'
import { DEFAULT_TRAIT_GUIDE, type TraitGuideEntry } from './traitGuide'
import {
  DEFAULT_TRAINING_SESSIONS,
  type TrainingSchedule,
  type TrainingSession,
} from '../training/schedule'
import { DEFAULT_TRAINING_FOCUSES, type TrainingFocus, withWho } from '../training/focus'
import { DEFAULT_NOTE_CATEGORIES, type NoteCategory } from './notes'
import { DEFAULT_STATUSES, normalizeStatus, type StatusInfo } from './statusInfo'

export interface Pictures {
  enabled: boolean
  /** Address the paths below are added to. */
  base: string
  /** Paths with {id} for the FM Unique ID. */
  face: string
  club: string
  flag: string
}

/** sortitoutsi's free picture database (faces, crests and flags by FM Unique ID). */
export const DEFAULT_PICTURES: Pictures = {
  enabled: true,
  base: 'https://sortitoutsi.b-cdb.net/uploads/',
  face: 'face/face_{id}.png',
  club: 'team/club_{id}.png',
  flag: 'flags/flag_{id}.png',
}

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
  /** Faces, club crests and flags from an online picture database, by FM Unique ID. */
  pictures: Pictures
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
  /** FM's team instructions, their options and the code FM stores for each. */
  teamInstructions: FmInstruction[]
  /** FM's player instructions, their options and codes. */
  playerInstructions: FmInstruction[]
  /** FM's codes for mentalities and positions (save and tactic files). */
  fmCodes: FmCodes
  /** Best XI: the match rating a player must beat to add to his score. */
  bestXiBaseline: number
  /** Tactic briefing: a player's fit for his roles below this is flagged (0–100). */
  briefingLowFit: number
  /** FM's role-combination warnings the briefing checks (text, on/off, limits). */
  roleWarnings: RoleWarning[]
  /** FM's training sessions: names, codes, descriptions, whether FM schedules accept them. */
  trainingSessions: TrainingSession[]
  /** FM's tactical styles: mentality and team instructions each sets, and its code. */
  tacticalStyles: TacticalStyle[]
  /** Roles from older FMs that FM27 still defines but no longer offers (hidden unless shown). */
  olderRoles: OlderRole[]
  /** What suits each player trait (FM's staff advice rules). */
  traitGuide: TraitGuideEntry[]
  /** Names of FM's player traits by the bit the save stores them under. */
  traitNames: Record<string, string>
  /** FM's match data: how FM rates players by role, how tactical training adds up. */
  matchData: MatchData
  /** FM's individual training focuses and the attributes each works on. */
  trainingFocuses: TrainingFocus[]
  /** Your weekly training schedules (shared by all careers). */
  trainingSchedules: TrainingSchedule[]
  /** Categories for Dashboard notes, in order. */
  noteCategories: NoteCategory[]
}

export interface Learned {
  morale: Record<string, string>
  knowledge: Record<string, string>
  /** Cup round names by FM round code. */
  rounds?: Record<string, string>
  /** Staff job titles by the save's job code. */
  jobs?: Record<string, string>
}

export type ConfigKey = keyof AppConfig

export const DEFAULT_CONFIG: AppConfig = {
  statuses: DEFAULT_STATUSES,
  attributes: { ...ATTRIBUTE_INFO, ...HIDDEN_INFO },
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
  pictures: DEFAULT_PICTURES,
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
  teamInstructions: DEFAULT_TEAM_INSTRUCTIONS,
  playerInstructions: DEFAULT_PLAYER_INSTRUCTIONS,
  fmCodes: DEFAULT_FM_CODES,
  bestXiBaseline: 6,
  briefingLowFit: 55,
  roleWarnings: DEFAULT_ROLE_WARNINGS,
  trainingSessions: DEFAULT_TRAINING_SESSIONS,
  tacticalStyles: DEFAULT_TACTICAL_STYLES,
  matchData: DEFAULT_MATCH_DATA,
  olderRoles: DEFAULT_OLDER_ROLES,
  traitNames: DEFAULT_TRAIT_NAMES,
  traitGuide: DEFAULT_TRAIT_GUIDE,
  trainingFocuses: DEFAULT_TRAINING_FOCUSES,
  trainingSchedules: [],
  noteCategories: DEFAULT_NOTE_CATEGORIES,
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
    layout: withHiddenColumn(stored.layout ?? DEFAULT_CONFIG.layout),
    views: { ...DEFAULT_CONFIG.views, ...stored.views },
    regions: stored.regions ?? DEFAULT_CONFIG.regions,
    staffScale: stored.staffScale ?? DEFAULT_CONFIG.staffScale,
    staffScaleMin: stored.staffScaleMin ?? DEFAULT_CONFIG.staffScaleMin,
    staffTabs: { ...DEFAULT_CONFIG.staffTabs, ...stored.staffTabs },
    staffKeyAttrs: stored.staffKeyAttrs ?? DEFAULT_CONFIG.staffKeyAttrs,
    staffGroups: { ...DEFAULT_CONFIG.staffGroups, ...stored.staffGroups },
    staffShort: { ...DEFAULT_CONFIG.staffShort, ...stored.staffShort },
    knowledgeLevels: withOutstanding(stored.knowledgeLevels) ?? DEFAULT_CONFIG.knowledgeLevels,
    // Older roles switched on in Settings join the roles the app uses
    roles: [
      ...(stored.roles ? withFmCodes(stored.roles) : DEFAULT_CONFIG.roles).filter(
        (r) => !r.id.startsWith('old-'),
      ),
      ...shownOlderRoles(stored.olderRoles ?? DEFAULT_CONFIG.olderRoles),
    ],
    olderRoles: stored.olderRoles ?? DEFAULT_CONFIG.olderRoles,
    traitNames: { ...DEFAULT_CONFIG.traitNames, ...stored.traitNames },
    traitGuide: stored.traitGuide ?? DEFAULT_CONFIG.traitGuide,
    roleWeights: { ...DEFAULT_CONFIG.roleWeights, ...stored.roleWeights },
    showHidden: stored.showHidden ?? DEFAULT_CONFIG.showHidden,
    pictures: { ...DEFAULT_CONFIG.pictures, ...stored.pictures },
    learned: { ...DEFAULT_CONFIG.learned, ...stored.learned },
    competitions: { ...DEFAULT_CONFIG.competitions, ...stored.competitions },
    mobileBar: stored.mobileBar ?? DEFAULT_CONFIG.mobileBar,
    personalityRules: stored.personalityRules ?? DEFAULT_CONFIG.personalityRules,
    footWords: stored.footWords ?? DEFAULT_CONFIG.footWords,
    footMins: stored.footMins ?? DEFAULT_CONFIG.footMins,
    // Lists saved before instructions had codes are replaced by FM's full list
    teamInstructions: isInstructionList(stored.teamInstructions)
      ? fillAbout(stored.teamInstructions, DEFAULT_CONFIG.teamInstructions)
      : DEFAULT_CONFIG.teamInstructions,
    playerInstructions: isInstructionList(stored.playerInstructions)
      ? fillAbout(stored.playerInstructions, DEFAULT_CONFIG.playerInstructions)
      : DEFAULT_CONFIG.playerInstructions,
    fmCodes: { ...DEFAULT_CONFIG.fmCodes, ...stored.fmCodes },
    bestXiBaseline: stored.bestXiBaseline ?? DEFAULT_CONFIG.bestXiBaseline,
    briefingLowFit: stored.briefingLowFit ?? DEFAULT_CONFIG.briefingLowFit,
    trainingSessions: stored.trainingSessions ?? DEFAULT_CONFIG.trainingSessions,
    tacticalStyles: stored.tacticalStyles ?? DEFAULT_CONFIG.tacticalStyles,
    matchData: stored.matchData ?? DEFAULT_CONFIG.matchData,
    trainingFocuses: stored.trainingFocuses
      ? withWho(stored.trainingFocuses)
      : DEFAULT_CONFIG.trainingFocuses,
    trainingSchedules: stored.trainingSchedules ?? DEFAULT_CONFIG.trainingSchedules,
    // Saved warnings first; warnings added later appear with their defaults
    roleWarnings: [
      ...(stored.roleWarnings ?? []),
      ...DEFAULT_CONFIG.roleWarnings.filter(
        (w) => !stored.roleWarnings?.some((x) => x.id === w.id),
      ),
    ],
    noteCategories: stored.noteCategories ?? DEFAULT_CONFIG.noteCategories,
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

/** Layouts saved before hidden values had a column get the default Hidden column. */
export function withHiddenColumn(layout: Layout): Layout {
  const out = { ...layout }
  for (const role of Object.keys(out) as Role[]) {
    const used = out[role].flat().some((s) => s.attributes.some((a) => HIDDEN_NAMES.has(a)))
    if (!used) out[role] = [...out[role], [{ label: 'Hidden', attributes: [...HIDDEN_NAMES] }]]
  }
  return out
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
