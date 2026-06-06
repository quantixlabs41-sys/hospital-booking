import { useState, useEffect, useRef } from 'react'

/**
 * Premium session timeout warning modal with countdown timer.
 */
export default function SessionTimeoutModal({ secondsRemaining, onStayLoggedIn, onLogout }) {
  const [countdown, setCountdown] = useState(secondsRemaining)
  const intervalRef = useRef(null)

  useEffect(() => {
    setCountdown(secondsRemaining)
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [secondsRemaining, onLogout])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const progress = (countdown / secondsRemaining) * 100

  return (
    <>
      <div className="overlay" style={{ zIndex: 10000 }} />
      <div className="session-timeout-modal" id="session-timeout-modal">
        <div className="session-timeout-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="var(--warning)" strokeWidth="3" fill="rgba(249,199,79,0.1)" />
            <path d="M24 14V26" stroke="var(--warning)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="24" cy="32" r="2" fill="var(--warning)" />
          </svg>
        </div>

        <h5 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--dark)',
          marginBottom: 8
        }}>
          Session Expiring Soon
        </h5>

        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
          Your session will expire due to inactivity. You'll be logged out automatically.
        </p>

        {/* Countdown Circle */}
        <div className="session-countdown-wrapper">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="var(--gray-200)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={countdown > 60 ? 'var(--warning)' : 'var(--danger)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%'
              }}
            />
          </svg>
          <div className="session-countdown-text">
            <span className="session-countdown-value">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            <span className="session-countdown-label">remaining</span>
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex gap-3 mt-4" style={{ width: '100%' }}>
          <button
            className="btn-ghost flex-fill"
            onClick={onLogout}
            style={{ padding: '10px 16px' }}
          >
            <i className="bi bi-box-arrow-right me-1" /> Logout
          </button>
          <button
            className="btn-primary-custom flex-fill"
            onClick={() => {
              if (intervalRef.current) clearInterval(intervalRef.current)
              onStayLoggedIn()
            }}
            style={{ padding: '10px 16px' }}
          >
            <i className="bi bi-shield-check me-1" /> Stay Logged In
          </button>
        </div>
      </div>
    </>
  )
}
