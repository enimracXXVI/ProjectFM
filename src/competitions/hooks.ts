import { useQueries, useQuery } from '@tanstack/react-query'
import type { CompetitionsFile } from './types'
import { listSeasons, loadSeason } from './storage'

export function useSeasons(careerId: string) {
  return useQuery({
    queryKey: ['competitions', careerId, 'seasons'],
    queryFn: () => listSeasons(careerId),
    retry: 1,
  })
}

/** A season's competitions (the latest when `season` is null). */
export function useCompetitions(careerId: string, season: number | null) {
  const seasons = useSeasons(careerId)
  const list = seasons.data ?? []
  const chosen = list.find((s) => s.season === season) ?? list[0]
  const file = useQuery({
    queryKey: ['competitions', careerId, chosen?.season, chosen?.updatedAt],
    queryFn: () => loadSeason(careerId, chosen!.season, chosen!.updatedAt),
    enabled: !!chosen,
    staleTime: Infinity,
    retry: 1,
  })
  return {
    seasons: list,
    season: chosen?.season ?? null,
    data: file.data,
    isPending: seasons.isPending || (!!chosen && file.isPending),
    error: seasons.error ?? file.error,
  }
}

/** Every saved season (for records across seasons), oldest first. */
export function useAllCompetitions(careerId: string) {
  const seasons = useSeasons(careerId)
  const files = useQueries({
    queries: (seasons.data ?? []).map((s) => ({
      queryKey: ['competitions', careerId, s.season, s.updatedAt],
      queryFn: () => loadSeason(careerId, s.season, s.updatedAt),
      staleTime: Infinity,
    })),
  })
  const data = files.map((f) => f.data).filter((f): f is CompetitionsFile => !!f)
  return {
    data: data.sort((a, b) => (a.season ?? 0) - (b.season ?? 0)),
    isPending: seasons.isPending || files.some((f) => f.isPending),
    error: seasons.error ?? files.find((f) => f.error)?.error ?? null,
  }
}
