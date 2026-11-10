import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetConfig, saveConfig, type AppConfig, type ConfigKey } from '../data/config'

/** Save / reset one settings section, refreshing the whole app afterwards. */
export function useSaveConfig<K extends ConfigKey>(key: K) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['settings'] })
  const save = useMutation({
    mutationFn: (value: AppConfig[K]) => saveConfig(key, value),
    onSuccess: done,
  })
  const reset = useMutation({ mutationFn: () => resetConfig(key), onSuccess: done })
  return { save, reset }
}
