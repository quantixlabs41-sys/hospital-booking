import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from 'react'
import { CAPTCHA_SITE_KEY, CAPTCHA_ENABLED, CAPTCHA_SCRIPT_SRC } from '../lib/captcha'

// Loads the Turnstile script once (shared across mounts).
let scriptPromise = null
function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CAPTCHA_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('captcha script failed')))
      return
    }
    const s = document.createElement('script')
    s.src = CAPTCHA_SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('captcha script failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * Cloudflare Turnstile widget for Supabase Auth captcha.
 *
 * Renders nothing when CAPTCHA is not configured (no site key), so the app
 * works unchanged until captcha is enabled.
 *
 * Props:
 *   onVerify(token)  — called with the captcha token on success
 *   onExpire()       — called when the token expires (clear it upstream)
 * Ref API:
 *   reset() — reset the widget (tokens are single-use; call after a failed auth)
 */
const Captcha = forwardRef(function Captcha({ onVerify, onExpire }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  const reset = useCallback(() => {
    if (window.turnstile && widgetIdRef.current !== null) {
      try { window.turnstile.reset(widgetIdRef.current) } catch { /* ignore */ }
    }
  }, [])

  useImperativeHandle(ref, () => ({ reset }), [reset])

  useEffect(() => {
    if (!CAPTCHA_ENABLED) return
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        if (widgetIdRef.current !== null) return // already rendered
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: CAPTCHA_SITE_KEY,
          callback: (token) => onVerify?.(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
          theme: 'light',
        })
      })
      .catch(() => { /* script blocked/offline — upstream requires a token so submit stays disabled */ })

    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current !== null) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* ignore */ }
        widgetIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CAPTCHA_ENABLED) return null

  return <div ref={containerRef} className="captcha-widget" style={{ marginBottom: 16, minHeight: 65 }} />
})

export default Captcha
