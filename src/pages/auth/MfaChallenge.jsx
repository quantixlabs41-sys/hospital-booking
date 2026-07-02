import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { listFactors, verifyTotp, recoveryReset, friendlyMfaError } from '../../services/mfa'

const ROLE_ROUTES = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
  HOSPITAL: '/hospital/dashboard',
}

/**
 * Login step-up: the session is authenticated (aal1) but the user has a
 * verified TOTP factor, so we require a code to reach aal2 before any
 * protected route renders.
 */
export default function MfaChallenge() {
  const { profile, signOut, refreshMfa, mfaStepUpRequired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    listFactors()
      .then(({ verifiedTotp }) => {
        if (verifiedTotp.length > 0) setFactorId(verifiedTotp[0].id)
      })
      .catch(() => setError('Could not load your authenticator. Please sign out and try again.'))
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  // If step-up is no longer required (already aal2), leave this screen.
  useEffect(() => {
    if (!mfaStepUpRequired) {
      const dest = location.state?.from?.pathname || ROLE_ROUTES[profile?.role] || '/'
      navigate(dest, { replace: true })
    }
  }, [mfaStepUpRequired, profile, location, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    if (!factorId) {
      setError('No authenticator found. Please sign out and try again.')
      return
    }
    try {
      setLoading(true)
      await verifyTotp(factorId, clean)
      await refreshMfa()
      toast.success('Verified — welcome back!')
      const dest = location.state?.from?.pathname || ROLE_ROUTES[profile?.role] || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(friendlyMfaError(err))
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleRecovery(e) {
    e.preventDefault()
    setError('')
    if (!recoveryCode.trim()) {
      setError('Enter one of your recovery codes.')
      return
    }
    try {
      setLoading(true)
      // Spends a recovery code and removes the user's factors so they can
      // re-enroll. It does NOT grant access by itself.
      await recoveryReset(recoveryCode.trim())
      await refreshMfa()
      toast.success('Recovery accepted. Please set up a new authenticator.')
      // The guard will now route: privileged → mandatory /mfa/setup;
      // patients → their dashboard (MFA now off until they re-enroll).
      navigate(ROLE_ROUTES[profile?.role] || '/', { replace: true })
    } catch (err) {
      setError(err.message || friendlyMfaError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-right" style={{ margin: '0 auto' }}>
        <div className="auth-form-container">
          <div className="mb-4 text-center">
            <div style={{
              width: 56, height: 56, borderRadius: 'var(--radius-md)',
              background: 'rgba(0,119,182,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <i className="bi bi-shield-lock-fill" style={{ fontSize: 24, color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)' }}>
              Two-Factor Verification
            </h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 15, marginTop: 6 }}>
              Enter the 6-digit code from your authenticator app to continue.
            </p>
          </div>

          {!useRecovery ? (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label-custom" htmlFor="mfa-code">Authentication Code</label>
                <input
                  id="mfa-code"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`form-input-custom ${error ? 'error' : ''}`}
                  placeholder="123456"
                  value={code}
                  maxLength={6}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: 22, fontWeight: 700 }}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'mfa-error' : undefined}
                />
                {error && <span id="mfa-error" className="form-error" role="alert"><i className="bi bi-exclamation-circle" />{error}</span>}
              </div>

              <button type="submit" className="btn-primary-custom w-100 justify-content-center" disabled={loading || code.length !== 6}>
                {loading ? (<><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Verifying...</>) : (<>Verify <i className="bi bi-arrow-right" /></>)}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecovery} noValidate>
              <div className="mb-3">
                <label className="form-label-custom" htmlFor="recovery-code">Recovery Code</label>
                <input
                  id="recovery-code"
                  type="text"
                  autoComplete="off"
                  className={`form-input-custom ${error ? 'error' : ''}`}
                  placeholder="xxxxx-xxxxx"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '0.08em' }}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'mfa-error' : undefined}
                />
                {error && <span id="mfa-error" className="form-error" role="alert"><i className="bi bi-exclamation-circle" />{error}</span>}
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                  Using a recovery code removes your current authenticator. You&apos;ll set up a new one after signing in.
                </p>
              </div>
              <button type="submit" className="btn-primary-custom w-100 justify-content-center" disabled={loading || !recoveryCode.trim()}>
                {loading ? (<><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Verifying...</>) : (<>Use Recovery Code <i className="bi bi-arrow-right" /></>)}
              </button>
            </form>
          )}

          <button
            className="btn-ghost w-100 justify-content-center mt-2"
            onClick={() => { setUseRecovery(v => !v); setError('') }}
            style={{ fontSize: 13 }}
          >
            {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
          </button>

          <button className="btn-ghost w-100 justify-content-center mt-1" onClick={handleSignOut} style={{ fontSize: 14 }}>
            <i className="bi bi-box-arrow-left me-1" /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
