import { useQuery } from '@tanstack/react-query'
import { createContext, use, useState, type ReactNode } from 'react'
import { listCareers } from '../data/api'
import type { Career } from '../data/db'
import { useAuth } from './auth'

interface CareerContextValue {
  careers: Career[]
  /** Null only when the user has no careers yet. */
  current: Career | null
  setCurrentId: (id: string) => void
  loading: boolean
  error: Error | null
}

const CareerContext = createContext<CareerContextValue | null>(null)

const STORAGE_KEY = 'projectfm.currentCareer'

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function CareerProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const query = useQuery({ queryKey: ['careers'], queryFn: listCareers, enabled: !!session })
  const careers = query.data ?? []
  const [currentId, setId] = useState(readStoredId)
  const current = careers.find((c) => c.id === currentId) ?? careers[0] ?? null

  const setCurrentId = (id: string) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage unavailable (private mode); selection just won't persist.
    }
  }

  return (
    <CareerContext
      value={{ careers, current, setCurrentId, loading: query.isPending, error: query.error }}
    >
      {children}
    </CareerContext>
  )
}

// eslint-disable-next-line react/only-export-components
export function useCareer(): CareerContextValue {
  const ctx = use(CareerContext)
  if (!ctx) throw new Error('useCareer must be used inside CareerProvider')
  return ctx
}

/** For pages that only render once a career exists (guarded in Layout). */
// eslint-disable-next-line react/only-export-components
export function useCurrentCareer(): Career {
  const { current } = useCareer()
  if (!current) throw new Error('No career selected')
  return current
}
