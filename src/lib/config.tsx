import { useQuery } from '@tanstack/react-query'
import { createContext, use, type ReactNode } from 'react'
import { DEFAULT_CONFIG, loadStoredConfig, mergeConfig, type AppConfig } from '../data/config'
import { useAuth } from './auth'

const ConfigContext = createContext<AppConfig>(DEFAULT_CONFIG)

/** Provides the user's settings (falls back to defaults while loading or offline). */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: loadStoredConfig,
    enabled: !!session,
  })
  const config = query.data ? mergeConfig(query.data) : DEFAULT_CONFIG
  return <ConfigContext value={config}>{children}</ConfigContext>
}

// eslint-disable-next-line react/only-export-components
export function useConfig(): AppConfig {
  return use(ConfigContext)
}
