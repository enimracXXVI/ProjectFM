import { supabase } from './supabase'

export async function sendLoginEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  if (error) throw error
}

export async function verifyLoginCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  try {
    localStorage.removeItem('projectfm.currentCareer')
  } catch {
    // ignore
  }
  // Full reload drops all cached data from the previous account.
  window.location.assign(import.meta.env.BASE_URL)
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
