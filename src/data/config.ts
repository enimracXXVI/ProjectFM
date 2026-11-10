import { supabase } from '../lib/supabase'
import {
  ATTRIBUTE_INFO,
  PROFILE_COLUMNS,
  type AttributeInfo,
  type AttributeSection,
  type Role,
} from './attributeInfo'
import { DEFAULT_STATUSES, type StatusInfo } from './statusInfo'

export type Layout = Record<Role, AttributeSection[][]>

/** Everything the user can customise in Settings. */
export interface AppConfig {
  statuses: Record<string, StatusInfo>
  attributes: Record<string, AttributeInfo>
  layout: Layout
}

export type ConfigKey = keyof AppConfig

export const DEFAULT_CONFIG: AppConfig = {
  statuses: DEFAULT_STATUSES,
  attributes: ATTRIBUTE_INFO,
  layout: PROFILE_COLUMNS,
}

type Stored = Partial<{ [K in ConfigKey]: AppConfig[K] }>

/** Applies the user's saved settings on top of the defaults. */
export function mergeConfig(stored: Stored): AppConfig {
  return {
    statuses: stored.statuses ?? DEFAULT_CONFIG.statuses,
    // Per attribute, so new defaults (e.g. a new attribute) still appear
    attributes: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.attributes).map(([k, v]) => [
        k,
        { ...v, ...stored.attributes?.[k] },
      ]),
    ),
    layout: stored.layout ?? DEFAULT_CONFIG.layout,
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
