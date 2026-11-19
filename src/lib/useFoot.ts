import { useMemo } from 'react'
import type { PlayerRow } from '../data/db'
import type { Feet } from '../tactics/analysis'
import { useConfig } from './config'
import { footLevel } from './profile'

/** Each player's foot strength as steps of the foot words (Settings > Personality and feet). */
export function useFoot(): (p: PlayerRow) => Feet {
  const { footWords, footMins } = useConfig()
  return useMemo(
    () => (p: PlayerRow) => ({
      left: footLevel(p.left_foot, footWords, footMins)?.level ?? null,
      right: footLevel(p.right_foot, footWords, footMins)?.level ?? null,
    }),
    [footWords, footMins],
  )
}
