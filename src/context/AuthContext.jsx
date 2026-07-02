import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SessionGuard from '../security/sessionGuard'
import { logSessionTimeout, logLoginSuccess } from '../security/auditLog'
import SessionTimeoutModal from '../components/SessionTimeoutModal'
import { isOnboardingComplete } from '../services/onboarding'
import { getAAL, listFactors } from '../services/mfa'

// Roles for which TOTP MFA enrollment is mandatory.
const MFA_REQUIRED_ROLES = ['ADMIN', 'DOCTOR', 'HOSPITAL']

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [timeoutSeconds, setTimeoutSeconds] = useState(300)
  const [onboardingComplete, setOnboardingComplete] = useState(null) // null=loading, true/false
  // MFA / assurance-level state.
  //   aal.currentLevel: 'aal1' (password) | 'aal2' (MFA satisfied)
  //   aal.nextLevel:    'aal2' means a verified TOTP factor exists for the user
  const [aal, setAal] = useState({ currentLevel: null, nextLevel: null })
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaLoaded, setMfaLoaded] = useState(false)
  const sessionGuardRef = useRef(null)

  // Load the session's assurance level + whether a verified TOTP factor exists.
  // Never throws — if MFA is unavailable the app continues at aal1.
  const loadMfaState = useCallback(async () => {
    try {
      const [levels, factors] = await Promise.all([
        getAAL().catch(() => ({ currentLevel: 'aal1', nextLevel: 'aal1' })),
        listFactors().catch(() => ({ verifiedTotp: [] })),
      ])
      setAal(levels)
      setMfaEnrolled((factors.verifiedTotp?.length ?? 0) > 0)
    } catch {
      setAal({ currentLevel: 'aal1', nextLevel: 'aal1' })
      setMfaEnrolled(false)
    } finally {
      setMfaLoaded(true)
    }
  }, [])

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
        loadMfaState()
      }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true) // Prevent flash of unauthenticated content
        fetchProfile(session.user.id)
        initSessionGuard(session.user.id)
        loadMfaState()
      } else {
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        setAal({ currentLevel: null, nextLevel: null })
        setMfaEnrolled(false)
        setMfaLoaded(false)
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
  }, [initSessionGuard, loadMfaState])

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

      // Account closure / deactivation gate: a closed account must not be able
      // to use the app. Sign out immediately and surface a clear message.
      if (data?.is_active === false) {
        setProfile(null)
        setProfileError('This account has been closed. Please contact support if you believe this is a mistake.')
        await supabase.auth.signOut()
        if (sessionGuardRef.current) {
          sessionGuardRef.current.stop()
          sessionGuardRef.current = null
        }
        setUser(null)
        return
      }

      // Check onboarding status for PATIENT and DOCTOR roles
      if (data?.role === 'PATIENT' || data?.role === 'DOCTOR') {
        try {
          const completed = await isOnboardingComplete(userId)
          setOnboardingComplete(completed)
        } catch (obErr) {
          // If onboarding table doesn't exist yet, treat as complete (graceful migration)
          console.warn('Onboarding check failed (table may not exist yet):', obErr.message)
          setOnboardingComplete(true)
        }
      } else {
        // Admins skip onboarding
        setOnboardingComplete(true)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfileError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshOnboardingStatus() {
    if (!user?.id) return
    try {
      const completed = await isOnboardingComplete(user.id)
      setOnboardingComplete(completed)
    } catch {
      setOnboardingComplete(true)
    }
  }

  async function signIn(email, password, captchaToken) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    })
    if (error) throw error
    logLoginSuccess(data.user?.id)
    return data
  }

  async function signUp(email, password, metadata, captchaToken) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: metadata, ...(captchaToken ? { captchaToken } : {}) },
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
    setOnboardingComplete(null)
    setShowTimeoutWarning(false)
    setAal({ currentLevel: null, nextLevel: null })
    setMfaEnrolled(false)
    setMfaLoaded(false)
  }

  async function resetPassword(email, captchaToken) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    })
    if (error) throw error
  }

  /**
   * OAuth sign-in (Google / GitHub). Redirects to the provider and back to
   * /login, where the restored session is picked up by onAuthStateChange and
   * routed by role. Works for both "sign in" and "sign up" — Supabase creates
   * the account on first OAuth login and the handle_new_user trigger provisions
   * the profile (role defaults to PATIENT).
   */
  async function signInWithProvider(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    })
    if (error) throw error
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, role: profile?.role ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      onboardingComplete,
      // ── MFA / assurance level ──
      aal,
      mfaEnrolled,
      mfaLoaded,
      // The session has a verified factor but hasn't completed step-up this session.
      mfaStepUpRequired: aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2',
      // Whether the given role must enroll in MFA (privileged roles).
      mfaEnrollmentRequired: MFA_REQUIRED_ROLES.includes(profile?.role) && !mfaEnrolled,
      refreshMfa: loadMfaState,
      signIn, signUp, signOut, resetPassword, signInWithProvider,
      refreshProfile: () => user && fetchProfile(user.id),
      refreshOnboarding: refreshOnboardingStatus,
      updateProfileInContext: (updates) => setProfile(prev => prev ? { ...prev, ...updates } : prev)
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
