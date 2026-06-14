import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { rhfRules } from '../../security/validators'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  async function onSubmit(data) {
    try {
      setLoading(true)
      await resetPassword(data.email)
      setSent(true)
      toast.success('Password reset link sent!')
    } catch (err) {
      toast.error(err.message || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-left">
        <div className="auth-brand">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <i className="bi bi-heart-pulse-fill" style={{ fontSize: 32, color: 'var(--primary-light)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'white' }}>
              Medi<span style={{ color: 'var(--primary-light)' }}>Book</span>
            </span>
          </Link>
        </div>
        <div className="auth-hero-content">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
            Don't Worry,<br />We've Got You
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 16, lineHeight: 1.7 }}>
            Enter your registered email and we'll send you a link to reset your password securely.
          </p>
        </div>
      </div>

      <div className="auth-page-right">
        <div className="auth-form-container">
          {!sent ? (
            <>
              <div className="mb-4">
                <div style={{
                  width: 56, height: 56, borderRadius: 'var(--radius-md)',
                  background: 'rgba(0,119,182,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20
                }}>
                  <i className="bi bi-key-fill" style={{ fontSize: 24, color: 'var(--primary)' }} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)' }}>
                  Reset Password
                </h3>
                <p style={{ color: 'var(--gray-500)', fontSize: 15, marginTop: 6 }}>
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="mb-3">
                  <label className="form-label-custom" htmlFor="forgot-email">Email Address</label>
                  <div className="search-input-wrapper">
                    <i className="bi bi-envelope" />
                    <input
                      id="forgot-email"
                      type="email"
                      className={`form-input-custom ${errors.email ? 'error' : ''}`}
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={{ paddingLeft: 42 }}
                      maxLength={254}
                      aria-invalid={errors.email ? 'true' : 'false'}
                      {...register('email', rhfRules.email)}
                    />
                  </div>
                  {errors.email && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.email.message}</span>}
                </div>

                <button
                  id="forgot-submit"
                  type="submit"
                  className="btn-primary-custom w-100 justify-content-center mt-3"
                  disabled={loading}
                >
                  {loading ? (
                    <><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Sending...</>
                  ) : (
                    <>Send Reset Link <i className="bi bi-arrow-right" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(45,198,83,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <i className="bi bi-check-circle-fill" style={{ fontSize: 36, color: 'var(--success)' }} />
              </div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--dark)' }}>
                Check Your Email
              </h4>
              <p style={{ color: 'var(--gray-500)', fontSize: 15, marginTop: 8, maxWidth: 350, margin: '8px auto 0' }}>
                We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
              </p>
              <Link to="/login" className="btn-outline-custom mt-4">
                <i className="bi bi-arrow-left" /> Back to Login
              </Link>
            </div>
          )}

          {!sent && (
            <p className="text-center mt-4" style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Remember your password?{' '}
              <Link to="/login" style={{ fontWeight: 600 }}>Sign In</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
