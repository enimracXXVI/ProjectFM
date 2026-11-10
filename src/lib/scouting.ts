import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveScouting } from '../data/api'
import type { Career, ScoutingNetwork, StaffRow } from '../data/db'

export const isScout = (s: StaffRow) => s.role === 'Scout'

/** Regions a staff member heads. */
export function headedRegions(net: ScoutingNetwork, staffId: string): string[] {
  return Object.entries(net.heads ?? {})
    .filter(([, s]) => s === staffId)
    .map(([r]) => r)
}

/** Saves the career's scouting network and refreshes the careers list. */
export function useSaveScouting(career: Career) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (next: ScoutingNetwork) => saveScouting(career.id, next),
    onMutate: async (next) => {
      // Show the change immediately; the careers list is refetched afterwards
      await qc.cancelQueries({ queryKey: ['careers'] })
      qc.setQueryData<Career[]>(['careers'], (list) =>
        list?.map((c) => (c.id === career.id ? { ...c, scouting: next } : c)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['careers'] }),
  })
}
