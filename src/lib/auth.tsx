import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

interface AuthValue {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthValue>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthValue>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthValue {
  return use(AuthContext)
}
