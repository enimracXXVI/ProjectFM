import { useQuery } from '@tanstack/react-query'
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
