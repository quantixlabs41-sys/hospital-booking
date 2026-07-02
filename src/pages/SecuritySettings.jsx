import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { listFactors, unenrollFactor, recoveryCodesRemaining, generateRecoveryCodes, friendlyMfaError } from '../services/mfa'

const PRIVILEGED = ['ADMIN', 'DOCTOR', 'HOSPITAL']

/**
 * Self-service MFA management for any role: enable/opt-in, view enrolled
 * authenticators, and remove them. Removal requires an aal2 session.
 */
export default function SecuritySettings() {
  const { profile, aal, mfaEnrolled, refreshMfa } = useAuth()
  const navigate = useNavigate()
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [newCodes, setNewCodes] = useState(null)
  const [regenerating, setRegenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { verifiedTotp } = await listFactors()
      setFactors(verifiedTotp)
      if (verifiedTotp.length > 0) {
        recoveryCodesRemaining().then(setRemaining).catch(() => setRemaining(null))
      }
    } catch {
      setFactors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRemove(factorId) {
    // Removing a factor is sensitive — require a fully verified (aal2) session.
    if (aal.currentLevel !== 'aal2') {
      toast.info('Please verify with your authenticator first.')
      navigate('/mfa', { state: { from: { pathname: '/security' } } })
      return
    }
    const isLastForPrivileged = PRIVILEGED.includes(profile?.role) && factors.length <= 1
    const warn = isLastForPrivileged
      ? 'Your role requires MFA. Removing this will force you to set up a new authenticator immediately. Continue?'
      : 'Remove this authenticator? You will no longer be prompted for a code from it.'
    if (!window.confirm(warn)) return
    try {
      setRemoving(factorId)
      await unenrollFactor(factorId)
      await refreshMfa()
      toast.success('Authenticator removed.')
      load()
    } catch (err) {
      toast.error(friendlyMfaError(err))
    } finally {
      setRemoving(null)
    }
  }

  function fmt(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  async function handleRegenerate() {
    if (aal.currentLevel !== 'aal2') {
      toast.info('Please verify with your authenticator first.')
      navigate('/mfa', { state: { from: { pathname: '/security' } } })
      return
    }
    if (!window.confirm('Generate a new set of recovery codes? Your old codes will stop working immediately.')) return
    try {
      setRegenerating(true)
      const codes = await generateRecoveryCodes()
      setNewCodes(codes)
      setRemaining(codes.length)
      toast.success('New recovery codes generated. Save them now.')
    } catch (err) {
      toast.error(friendlyMfaError(err))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div>
      <Navbar />
      <div className="page-header">
        <div className="container">
          <div className="section-badge">Security</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', position: 'relative', zIndex: 1 }}>
            Two-Factor Authentication
          </h1>
        </div>
      </div>

      <div className="container py-5" style={{ maxWidth: 640 }}>
        <div className="card-custom p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)',
              background: mfaEnrolled ? 'rgba(45,198,83,0.12)' : 'rgba(249,199,79,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`bi ${mfaEnrolled ? 'bi-shield-check' : 'bi-shield-exclamation'}`}
                 style={{ fontSize: 22, color: mfaEnrolled ? '#2DC653' : '#D97706' }} />
            </div>
            <div>
              <h5 style={{ margin: 0, fontWeight: 700 }}>
                {mfaEnrolled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
              </h5>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-500)' }}>
                {mfaEnrolled
                  ? 'Your account asks for an authenticator code at sign-in.'
                  : 'Add a second step at sign-in using an authenticator app.'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="skeleton skeleton-text" style={{ height: 40 }} />
          ) : mfaEnrolled ? (
            <div>
              {factors.map(f => (
                <div key={f.id} className="d-flex align-items-center justify-content-between py-2"
                     style={{ borderTop: '1px solid var(--gray-100)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      <i className="bi bi-phone me-2" />{f.friendly_name || 'Authenticator app'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Added {fmt(f.created_at)}</div>
                  </div>
                  <button className="btn-ghost" style={{ color: 'var(--danger)', fontSize: 13 }}
                          onClick={() => handleRemove(f.id)} disabled={removing === f.id}>
                    {removing === f.id ? 'Removing…' : (<><i className="bi bi-trash me-1" />Remove</>)}
                  </button>
                </div>
              ))}
              <button className="btn-outline-custom mt-3" onClick={() => navigate('/mfa/setup')}>
                <i className="bi bi-plus-lg me-1" /> Add another authenticator
              </button>

              <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: 16, paddingTop: 16 }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      <i className="bi bi-key me-2" />Recovery codes
                    </div>
                    <div style={{ fontSize: 12, color: remaining != null && remaining <= 3 ? 'var(--danger)' : 'var(--gray-400)' }}>
                      {remaining == null ? 'One-time backup codes for device loss'
                        : `${remaining} unused code${remaining === 1 ? '' : 's'} remaining`}
                    </div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 13 }} onClick={handleRegenerate} disabled={regenerating}>
                    {regenerating ? 'Generating…' : (<><i className="bi bi-arrow-repeat me-1" />Regenerate</>)}
                  </button>
                </div>
                {newCodes && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50)', padding: 12, borderRadius: 10, marginTop: 10 }}>
                    {newCodes.map((c, i) => (
                      <code key={i} style={{ fontSize: 14, letterSpacing: '0.05em', textAlign: 'center' }}>{c}</code>
                    ))}
                  </div>
                )}
                {newCodes && (
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                    <i className="bi bi-exclamation-triangle me-1" />Save these now — they won&apos;t be shown again.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <button className="btn-primary-custom mt-2" onClick={() => navigate('/mfa/setup')}>
              <i className="bi bi-shield-plus me-1" /> Enable Two-Factor Authentication
            </button>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 16 }}>
          <i className="bi bi-info-circle me-1" />
          If you lose access to your authenticator, contact an administrator to reset your MFA.
        </p>
      </div>
      <Footer />
    </div>
  )
}
