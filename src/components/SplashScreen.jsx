import { useState, useEffect } from 'react'
import './SplashScreen.css'

/**
 * SplashScreen — Premium animated brand splash for cold-start loading.
 * 
 * Props:
 *   onComplete — callback fired after splash finishes (min 2.5s + exit animation)
 *   isReady    — external signal that auth/data is resolved
 * 
 * Behavior:
 *   - Shows for at least 2.5s to complete brand reveal animation
 *   - Waits for isReady=true before starting exit
 *   - Smooth scale-up + fade-out exit transition (500ms)
 *   - Respects prefers-reduced-motion
 */
export default function SplashScreen({ onComplete, isReady = false }) {
  const [minTimePassed, setMinTimePassed] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [removed, setRemoved] = useState(false)

  // Minimum display timer (2.5s)
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  // Start exit when both conditions met
  useEffect(() => {
    if (minTimePassed && isReady && !exiting) {
      setExiting(true)
      // Wait for CSS exit animation to finish (500ms)
      const exitTimer = setTimeout(() => {
        setRemoved(true)
        onComplete?.()
      }, 550)
      return () => clearTimeout(exitTimer)
    }
  }, [minTimePassed, isReady, exiting, onComplete])

  // Don't render after removal
  if (removed) return null

  return (
    <div
      className={`splash-screen ${exiting ? 'splash-exit' : ''}`}
      role="status"
      aria-label="Loading MediBook"
      aria-live="polite"
    >
      {/* Background particles */}
      <div className="splash-particles" aria-hidden="true">
        <div className="splash-particle" />
        <div className="splash-particle" />
        <div className="splash-particle" />
        <div className="splash-particle" />
        <div className="splash-particle" />
      </div>

      {/* Logo + Brand */}
      <div className="splash-logo-container">
        <div className="splash-logo-icon" aria-hidden="true">
          <i className="bi bi-heart-pulse-fill" />
        </div>

        <div className="splash-brand">
          Medi<span className="splash-brand-accent">Book</span>
        </div>

        <div className="splash-tagline">
          Your Health, Our Priority
        </div>

        {/* EKG Heartbeat Line */}
        <div className="splash-ekg" aria-hidden="true">
          <svg viewBox="0 0 200 40" preserveAspectRatio="none">
            <path
              className="splash-ekg-line"
              d="M0,20 L40,20 L50,20 L55,5 L60,35 L65,10 L70,25 L75,20 L100,20 L110,20 L115,5 L120,35 L125,10 L130,25 L135,20 L200,20"
            />
          </svg>
        </div>

        {/* Loading dots */}
        <div className="splash-loading" aria-hidden="true">
          <div className="splash-loading-dot" />
          <div className="splash-loading-dot" />
          <div className="splash-loading-dot" />
        </div>
      </div>

      {/* Footer */}
      <div className="splash-footer" aria-hidden="true">
        Hospital Appointment System
      </div>
    </div>
  )
}
