import { useMemo } from 'react'
import { useCompetitions } from '../competitions/hooks'
import { usePlayers, useStaff, useTactics } from '../data/hooks'
import { useConfig } from './config'
import { useCurrentCareer } from './career'
import { findChecks } from './checks'

export function useChecks() {
  const career = useCurrentCareer()
  const { data: players } = usePlayers(career.id)
  const { data: staff } = useStaff(career.id)
  const { data: comps } = useCompetitions(career.id, null)
  const { data: tactics } = useTactics(career.id)
  const config = useConfig()
  return useMemo(
    () => findChecks(players ?? [], staff ?? [], comps, config, tactics ?? []),
    [players, staff, comps, config, tactics],
  )
}
