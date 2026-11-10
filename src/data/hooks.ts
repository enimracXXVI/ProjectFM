import { useQuery } from '@tanstack/react-query'
import { getPlayer, listImports, listPlayers, listSnapshots } from './api'

export const usePlayers = (careerId: string) =>
  useQuery({ queryKey: ['players', careerId], queryFn: () => listPlayers(careerId) })

export const usePlayer = (id: string) =>
  useQuery({ queryKey: ['player', id], queryFn: () => getPlayer(id) })

export const useSnapshots = (playerId: string) =>
  useQuery({ queryKey: ['snapshots', playerId], queryFn: () => listSnapshots(playerId) })

export const useImports = (careerId: string) =>
  useQuery({ queryKey: ['imports', careerId], queryFn: () => listImports(careerId) })
