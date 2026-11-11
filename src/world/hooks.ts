import { useQuery } from '@tanstack/react-query'
import { loadWorld } from './storage'

export function useWorld(careerId: string) {
  return useQuery({
    queryKey: ['world', careerId],
    queryFn: () => loadWorld(careerId),
    staleTime: Infinity,
    retry: 1,
  })
}
