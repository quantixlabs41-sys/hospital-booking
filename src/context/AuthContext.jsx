import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SessionGuard from '../security/sessionGuard'
import { logSessionTimeout, logLoginSuccess } from '../security/auditLog'
import SessionTimeoutModal from '../components/SessionTimeoutModal'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [timeoutSeconds, setTimeoutSeconds] = useState(300)
  const sessionGuardRef = useRef(null)

  // ── Session Guard Setup ──
  const initSessionGuard = useCallback((userId) => {
    if (sessionGuardRef.current) {
      sessionGuardRef.current.stop()
    }

    const guard = new SessionGuard({
      idleTimeout: 30 * 60 * 1000, // 30 minutes
      onWarning: (seconds) => {
        setTimeoutSeconds(seconds)
        setShowTimeoutWarning(true)
      },
      onTimeout: () => {
        logSessionTimeout(userId)
        setShowTimeoutWarning(false)
        signOut()
      },
      onActivity: () => {
        setShowTimeoutWarning(false)
      }
    })

    guard.start()
    sessionGuardRef.current = guard
  }, [])

  const handleStayLoggedIn = useCallback(() => {
    setShowTimeoutWarning(false)
    if (sessionGuardRef.current) {
      sessionGuardRef.current.extend()
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        initSessionGuard(session.user.id)
      }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true) // Prevent flash of unauthenticated content
        fetchProfile(session.user.id)
        initSessionGuard(session.user.id)
      } else {
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        // Stop session guard when logged out
        if (sessionGuardRef.current) {
          sessionGuardRef.current.stop()
          sessionGuardRef.current = null
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      if (sessionGuardRef.current) {
        sessionGuardRef.current.stop()
      }
    }
  }, [initSessionGuard])

  async function fetchProfile(userId, retries = 3) {
    try {
      setProfileError(null)
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      
      if (error) {
        // Profile may not exist yet if trigger is slow — retry
        if (retries > 0 && error.code === 'PGRST116') {
          await new Promise(r => setTimeout(r, 800))
          return fetchProfile(userId, retries - 1)
        }
        throw error
      }
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfileError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    logLoginSuccess(data.user?.id)
    return data
  }

  async function signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: metadata }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    if (sessionGuardRef.current) {
      sessionGuardRef.current.stop()
      sessionGuardRef.current = null
    }
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
    setShowTimeoutWarning(false)
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, role: profile?.role ?? null,
      signIn, signUp, signOut, resetPassword,
      refreshProfile: () => user && fetchProfile(user.id)
    }}>
      {children}
      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <SessionTimeoutModal
          secondsRemaining={timeoutSeconds}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={signOut}
        />
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
