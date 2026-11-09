export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface Career {
  id: string
  name: string
  club: string
  nation: string
  startSeason: string
  currentSeason: string
}

export interface Player {
  id: string
  careerId: string
  name: string
  age: number
  nationality: string
  position: Position
  /** Detailed FM position string, e.g. "AM (RL), ST (C)" */
  positions: string
  apps: number
  goals: number
  assists: number
  avgRating: number
  value: number
  wage: number
}

export interface Staff {
  id: string
  careerId: string
  name: string
  age: number
  role: string
  nationality: string
  wage: number
}

export type ScoutStatus = 'watching' | 'bid' | 'signed' | 'rejected'

export interface ScoutTarget {
  id: string
  careerId: string
  name: string
  age: number
  club: string
  position: Position
  status: ScoutStatus
  rating: number
  value: number
}
