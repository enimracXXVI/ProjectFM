import { createContext, use, useState, type ReactNode } from 'react'
import { careers } from '../data/mock'
import type { Career } from '../data/types'

interface CareerContextValue {
  careers: Career[]
  current: Career
  setCurrentId: (id: string) => void
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
  const [currentId, setId] = useState(() => readStoredId() ?? careers[0].id)
  const current = careers.find((c) => c.id === currentId) ?? careers[0]

  const setCurrentId = (id: string) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage unavailable (private mode); selection just won't persist.
    }
  }

  return <CareerContext value={{ careers, current, setCurrentId }}>{children}</CareerContext>
}

// eslint-disable-next-line react/only-export-components
export function useCareer(): CareerContextValue {
  const ctx = use(CareerContext)
  if (!ctx) throw new Error('useCareer must be used inside CareerProvider')
  return ctx
}
