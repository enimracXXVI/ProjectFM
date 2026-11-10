import { useQuery } from '@tanstack/react-query'
import { loadWorld } from './storage'

/** Compact money in the dump currency (GBP). */
export function gbp(v: number | null): string {
  if (v == null) return '–'
  if (v >= 1e6) return `£${Math.round(v / 1e5) / 10}M`
  if (v >= 1e3) return `£${Math.round(v / 100) / 10}K`
  return `£${v}`
}

export function useWorld(careerId: string) {
  return useQuery({
    queryKey: ['world', careerId],
    queryFn: () => loadWorld(careerId),
    staleTime: Infinity,
    retry: 1,
  })
}
