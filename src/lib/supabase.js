import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

/**
 * Creates an isolated Supabase client that does NOT persist sessions
 * or interfere with the main client's auth state.
 * Used for admin operations like creating new user accounts via signUp
 * without logging out the current admin.
 */
export function createIsolatedClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: 'sb-isolated-auth-token'
    }
  })
}
