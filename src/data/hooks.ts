import { useQuery } from '@tanstack/react-query'
import {
  getPlayer,
  listCareerSnapshots,
  listImports,
  listPlayers,
  listSnapshots,
  listMatchLog,
  listStaff,
  listTactics,
} from './api'

export const usePlayers = (careerId: string) =>
  useQuery({ queryKey: ['players', careerId], queryFn: () => listPlayers(careerId) })

export const usePlayer = (id: string) =>
  useQuery({ queryKey: ['player', id], queryFn: () => getPlayer(id) })

export const useSnapshots = (playerId: string) =>
  useQuery({ queryKey: ['snapshots', playerId], queryFn: () => listSnapshots(playerId) })

export const useImports = (careerId: string) =>
  useQuery({ queryKey: ['imports', careerId], queryFn: () => listImports(careerId) })

export const useStaff = (careerId: string) =>
  useQuery({ queryKey: ['staff', careerId], queryFn: () => listStaff(careerId) })

export const useCareerSnapshots = (careerId: string) =>
  useQuery({
    queryKey: ['snapshots', 'career', careerId],
    queryFn: () => listCareerSnapshots(careerId),
  })

export const useTactics = (careerId: string) =>
  useQuery({ queryKey: ['tactics', careerId], queryFn: () => listTactics(careerId), retry: false })

export const useMatchLog = (careerId: string) =>
  useQuery({
    queryKey: ['matchlog', careerId],
    queryFn: () => listMatchLog(careerId),
    retry: false,
  })
