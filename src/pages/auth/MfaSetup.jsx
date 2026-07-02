import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { enrollTotp, verifyTotp, cleanupUnverifiedTotp, generateRecoveryCodes, friendlyMfaError } from '../../services/mfa'

const ROLE_ROUTES = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
  HOSPITAL: '/hospital/dashboard',
}

const PRIVILEGED = ['ADMIN', 'DOCTOR', 'HOSPITAL']

/**
 * TOTP enrollment. Used both for mandatory enrollment (privileged roles) and
 * opt-in enrollment (patients). Enrolling + verifying raises the session to aal2.
 */
export default function MfaSetup() {
  const { profile, signOut, refreshMfa, mfaEnrolled } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [factor, setFactor] = useState(null) // { factorId, qrSvg, secret, uri }
  const [code, setCode] = useState('')
  const [enrolling, setEnrolling] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState(null) // shown once after enable
  const startedRef = useRef(false)
  const mandatory = PRIVILEGED.includes(profile?.role)

  const startEnrollment = useCallback(async () => {
    setEnrolling(true)
    setError('')
    try {
      // Clear any leftover unverified factor from a previous abandoned attempt.
      await cleanupUnverifiedTotp()
      const f = await enrollTotp()
      setFactor(f)
    } catch (err) {
      setError(friendlyMfaError(err))
    } finally {
      setEnrolling(false)
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    // If already enrolled (e.g. navigated here directly), send them onward.
    if (mfaEnrolled) {
      navigate(ROLE_ROUTES[profile?.role] || '/', { replace: true })
      return
    }
    startEnrollment()
  }, [mfaEnrolled, profile, navigate, startEnrollment])

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) {
      setError('Enter the 6-digit code shown in your authenticator app.')
      return
    }
    if (!factor?.factorId) {
      setError('Enrollment expired. Please restart setup.')
      return
    }
    try {
      setVerifying(true)
      await verifyTotp(factor.factorId, clean)
      await refreshMfa()
      // Issue one-time recovery codes so device loss never locks the user out.
      try {
        const codes = await generateRecoveryCodes()
        if (codes?.length) {
          setRecoveryCodes(codes)
          toast.success('Two-factor authentication is now enabled.')
          return // show the recovery-codes step before leaving
        }
      } catch {
        /* recovery-code generation is best-effort; don't block enablement */
      }
      toast.success('Two-factor authentication is now enabled.')
      const dest = location.state?.from?.pathname || ROLE_ROUTES[profile?.role] || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(friendlyMfaError(err))
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  function finishSetup() {
    const dest = location.state?.from?.pathname || ROLE_ROUTES[profile?.role] || '/'
    navigate(dest, { replace: true })
  }

  function copyCodes() {
    if (!recoveryCodes) return
    navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(
      () => toast.success('Recovery codes copied.'),
      () => toast.info('Could not copy — please select and copy manually.'),
    )
  }

  function downloadCodes() {
    if (!recoveryCodes) return
    const blob = new Blob(
      [`MediBook — Two-Factor Recovery Codes\nKeep these safe. Each code works once.\n\n${recoveryCodes.join('\n')}\n`],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = 'medibook-recovery-codes.txt'
    el.click()
    URL.revokeObjectURL(url)
  }

  async function handleCancel() {
    await cleanupUnverifiedTotp()
    if (mandatory) {
      // Privileged users cannot skip — signing out is the only exit.
      await signOut()
      navigate('/login', { replace: true })
    } else {
      navigate(ROLE_ROUTES[profile?.role] || '/', { replace: true })
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
              <i className="bi bi-shield-plus" style={{ fontSize: 24, color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)' }}>
              Set Up Two-Factor Authentication
            </h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 6 }}>
              {mandatory
                ? 'Your role requires two-factor authentication. Scan the QR code with an authenticator app to continue.'
                : 'Add an extra layer of security. Scan the QR code with an authenticator app.'}
            </p>
          </div>

          {recoveryCodes ? (
            <>
              <div className="mb-2" style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(45,198,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                  <i className="bi bi-check-lg" style={{ fontSize: 24, color: '#2DC653' }} />
                </div>
                <h5 style={{ fontWeight: 700, margin: 0 }}>Save your recovery codes</h5>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
                  Store these somewhere safe. Each code works once and lets you regain access if you lose your authenticator.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50)', padding: 12, borderRadius: 10, margin: '8px 0 12px' }}>
                {recoveryCodes.map((c, i) => (
                  <code key={i} style={{ fontSize: 14, letterSpacing: '0.05em', textAlign: 'center' }}>{c}</code>
                ))}
              </div>
              <div className="d-flex gap-2">
                <button className="btn-outline-custom" style={{ flex: 1 }} onClick={copyCodes}><i className="bi bi-clipboard me-1" />Copy</button>
                <button className="btn-outline-custom" style={{ flex: 1 }} onClick={downloadCodes}><i className="bi bi-download me-1" />Download</button>
              </div>
              <button className="btn-primary-custom w-100 justify-content-center mt-3" onClick={finishSetup}>
                I&apos;ve saved my codes — Continue <i className="bi bi-arrow-right" />
              </button>
            </>
          ) : enrolling ? (
            <div className="text-center py-4">
              <div className="spinner-custom" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }} />
              <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 12 }}>Preparing your setup…</p>
            </div>
          ) : factor ? (
            <>
              <div className="text-center mb-3">
                {factor.qrSvg
                  ? <img src={factor.qrSvg} alt="TOTP QR code" width={180} height={180} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 8, background: '#fff' }} />
                  : null}
              </div>
              <div className="mb-3" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>Can't scan? Enter this key manually:</p>
                <code style={{ fontSize: 13, wordBreak: 'break-all', background: 'var(--gray-50)', padding: '6px 10px', borderRadius: 8, display: 'inline-block' }}>
                  {factor.secret}
                </code>
              </div>

              <form onSubmit={handleVerify} noValidate>
                <div className="mb-3">
                  <label className="form-label-custom" htmlFor="setup-code">Enter the 6-digit code to confirm</label>
                  <input
                    id="setup-code"
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
                    aria-describedby={error ? 'setup-error' : undefined}
                  />
                  {error && <span id="setup-error" className="form-error" role="alert"><i className="bi bi-exclamation-circle" />{error}</span>}
                </div>
                <button type="submit" className="btn-primary-custom w-100 justify-content-center" disabled={verifying || code.length !== 6}>
                  {verifying ? (<><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Confirming...</>) : (<>Confirm &amp; Enable <i className="bi bi-check-lg" /></>)}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-3">
              {error && <p className="form-error" role="alert" style={{ justifyContent: 'center' }}><i className="bi bi-exclamation-circle" />{error}</p>}
              <button className="btn-outline-custom mt-2" onClick={startEnrollment}>
                <i className="bi bi-arrow-clockwise me-1" /> Retry setup
              </button>
            </div>
          )}

          {!recoveryCodes && (
            <button className="btn-ghost w-100 justify-content-center mt-3" onClick={handleCancel} style={{ fontSize: 14 }}>
              {mandatory ? (<><i className="bi bi-box-arrow-left me-1" /> Sign out</>) : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
