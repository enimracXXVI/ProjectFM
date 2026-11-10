export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

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
