import { useQuery } from '@tanstack/react-query'
import { listStatsSeasons, loadSeasonStats, loadWorld } from './storage'

export function useWorld(careerId: string) {
  return useQuery({
    queryKey: ['world', careerId],
    queryFn: () => loadWorld(careerId),
    staleTime: Infinity,
    retry: 1,
  })
}

/** Seasons with every player's stats stored, newest first. */
export function useStatsSeasons(careerId: string) {
  return useQuery({
    queryKey: ['statsSeasons', careerId],
    queryFn: () => listStatsSeasons(careerId),
    staleTime: 60_000,
  })
}

/** One season's stats of every player (null season: none). */
export function useSeasonStats(careerId: string, season: number | null) {
  return useQuery({
    queryKey: ['seasonStats', careerId, season],
    queryFn: () => (season === null ? null : loadSeasonStats(careerId, season)),
    enabled: season !== null,
    staleTime: Infinity,
    retry: 1,
  })
}
