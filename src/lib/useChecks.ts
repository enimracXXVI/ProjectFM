import { useMemo } from 'react'
import { usePlayers, useStaff } from '../data/hooks'
import { useCurrentCareer } from './career'
import { findChecks } from './checks'

export function useChecks() {
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { data: staff } = useStaff(career.id)
  return useMemo(() => findChecks(players ?? [], staff ?? []), [players, staff])
}
