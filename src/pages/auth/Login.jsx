import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { rhfRules } from '../../security/validators'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors }, setFocus } = useForm()
  const formRef = useRef(null)

  const from = location.state?.from?.pathname ?? '/'

  // After login, AuthContext loads the profile. Once profile.role is available,
  // redirect to the correct dashboard. This prevents relying on spoofable user_metadata.
  const { profile: currentProfile } = useAuth()
  const [loginSuccess, setLoginSuccess] = useState(false)

  useEffect(() => {
    if (loginSuccess && currentProfile?.role) {
      const redirectMap = { PATIENT: '/patient/dashboard', DOCTOR: '/doctor/dashboard', ADMIN: '/admin/dashboard' }
      navigate(from !== '/' ? from : (redirectMap[currentProfile.role] ?? '/'), { replace: true })
    }
  }, [loginSuccess, currentProfile])

  // Auto-focus first errored field on validation failure (Priority 8 — focus-management)
  useEffect(() => {
    const firstError = Object.keys(errors)[0]
    if (firstError) {
      try { setFocus(firstError) } catch (e) { /* field may not be registered yet */ }
    }
  }, [errors, setFocus])

  async function onSubmit(data) {
    try {
      setLoading(true)
      await signIn(data.email.trim().toLowerCase(), data.password)
      toast.success('Welcome back!')
      setLoginSuccess(true)
    } catch (err) {
      toast.error(err.message || 'Invalid email or password')
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
            Your Health,<br />Our Priority
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 16, lineHeight: 1.7 }}>
            Book appointments with top specialists in just a few clicks. No waiting, no hassle.
          </p>
          <div className="d-flex gap-4 mt-4">
            {[
              { icon: 'bi-shield-check', text: 'Verified Doctors' },
              { icon: 'bi-clock', text: 'Instant Booking' },
              { icon: 'bi-bell', text: 'Smart Reminders' },
            ].map(item => (
              <div key={item.text} className="d-flex align-items-center gap-2">
                <i className={`bi ${item.icon}`} style={{ color: 'var(--primary-light)', fontSize: 18 }} />
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-page-right">
        <div className="auth-form-container">
          <div className="mb-4">
            <div className="section-badge">Welcome Back</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', marginTop: 8 }}>
              Sign in to your account
            </h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 15, marginTop: 6 }}>
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <label className="form-label-custom required" htmlFor="login-email">Email Address</label>
              <div className="search-input-wrapper">
                <i className="bi bi-envelope" />
                <input
                  id="login-email"
                  type="email"
                  className={`form-input-custom ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{ paddingLeft: 42 }}
                  maxLength={254}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  {...register('email', rhfRules.email)}
                />
              </div>
              {errors.email && <span id="login-email-error" className="form-error"><i className="bi bi-exclamation-circle" />{errors.email.message}</span>}
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label-custom required mb-0" htmlFor="login-password">Password</label>
                <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>
                  Forgot Password?
                </Link>
              </div>
              <div className="search-input-wrapper">
                <i className="bi bi-lock" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input-custom ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{ paddingLeft: 42, paddingRight: 44 }}
                  maxLength={128}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  {...register('password', rhfRules.loginPassword)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
              {errors.password && <span id="login-password-error" className="form-error"><i className="bi bi-exclamation-circle" />{errors.password.message}</span>}
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn-primary-custom w-100 justify-content-center mt-4"
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Signing in...</>
              ) : (
                <>Sign In <i className="bi bi-arrow-right" /></>
              )}
            </button>
          </form>

          <p className="text-center mt-4" style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ fontWeight: 600 }}>Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
