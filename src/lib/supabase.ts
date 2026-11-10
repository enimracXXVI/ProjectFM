import { createClient } from '@supabase/supabase-js'

// Publishable key is safe to ship in the browser: data is protected by Row Level Security.
// Env vars (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) override these defaults,
// e.g. to point a local build at a different project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://cgilypdnuabdngeqalgg.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Z57YF0oikk4wjpPWxcMl8w_3EuDF9_a'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
