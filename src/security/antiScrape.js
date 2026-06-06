/**
 * MediBook — Anti-Scraping Protection
 * Rate limiting, bot detection, content protection, and request signing.
 */

import { logSecurityEvent } from './auditLog'

// ─── Rate Limiter ───
class RequestRateLimiter {
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = []
    this.violations = 0
  }

  check() {
    const now = Date.now()
    // Clean old entries
    this.requests = this.requests.filter(t => now - t < this.windowMs)

    if (this.requests.length >= this.maxRequests) {
      this.violations++
      logSecurityEvent('RATE_LIMIT_HIT', {
        requestCount: this.requests.length,
        window: this.windowMs,
        violations: this.violations
      })
      return false
    }

    this.requests.push(now)
    return true
  }

  getBackoffMs() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s max
    return Math.min(1000 * Math.pow(2, this.violations - 1), 16000)
  }

  reset() {
    this.requests = []
    this.violations = 0
  }
}

export const rateLimiter = new RequestRateLimiter(60, 60000)

// ─── Bot Detection (Behavioral Fingerprinting) ───
class BotDetector {
  constructor() {
    this.signals = {
      mouseMovements: 0,
      keystrokes: 0,
      scrollEvents: 0,
      touchEvents: 0,
      pageLoadTime: Date.now(),
      interactionPatterns: []
    }
    this.isMonitoring = false
  }

  start() {
    if (this.isMonitoring) return
    this.isMonitoring = true

    // Track mouse movements
    document.addEventListener('mousemove', this._onMouseMove, { passive: true })
    document.addEventListener('keydown', this._onKeyDown, { passive: true })
    document.addEventListener('scroll', this._onScroll, { passive: true })
    document.addEventListener('touchstart', this._onTouch, { passive: true })
  }

  stop() {
    this.isMonitoring = false
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('scroll', this._onScroll)
    document.removeEventListener('touchstart', this._onTouch)
  }

  _onMouseMove = () => { this.signals.mouseMovements++ }
  _onKeyDown = () => { this.signals.keystrokes++ }
  _onScroll = () => { this.signals.scrollEvents++ }
  _onTouch = () => { this.signals.touchEvents++ }

  /**
   * Score from 0 (human) to 100 (likely bot).
   * Called after some interaction time has passed.
   */
  getBotScore() {
    const timeOnPage = (Date.now() - this.signals.pageLoadTime) / 1000

    let score = 0

    // No mouse/touch activity after 10 seconds → suspicious
    if (timeOnPage > 10 && this.signals.mouseMovements === 0 && this.signals.touchEvents === 0) {
      score += 30
    }

    // No scroll after 15 seconds → suspicious
    if (timeOnPage > 15 && this.signals.scrollEvents === 0) {
      score += 15
    }

    // Page visited for less than 2 seconds but already making API calls → suspicious
    if (timeOnPage < 2) {
      score += 25
    }

    // No keystrokes on forms → less suspicious but worth noting
    if (timeOnPage > 30 && this.signals.keystrokes === 0) {
      score += 10
    }

    // Check for headless browser indicators
    if (navigator.webdriver) score += 40
    if (!navigator.languages || navigator.languages.length === 0) score += 20
    if (window.outerWidth === 0 && window.outerHeight === 0) score += 30

    return Math.min(100, score)
  }

  isLikelyBot() {
    return this.getBotScore() >= 60
  }
}

export const botDetector = new BotDetector()

// ─── Content Protection ───
export function enableContentProtection() {
  // Disable right-click on sensitive elements
  document.addEventListener('contextmenu', (e) => {
    const target = e.target
    if (target.closest('[data-protected]') || target.closest('.doctor-contact-info')) {
      e.preventDefault()
    }
  })

  // Add user-select: none to sensitive data via CSS class
  const style = document.createElement('style')
  style.textContent = `
    .no-select, [data-protected] {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  `
  document.head.appendChild(style)
}

// ─── Request Signing ───
// Simple timestamp-based request validation (prevents replay)
export function signRequest(payload) {
  const timestamp = Date.now()
  const nonce = Math.random().toString(36).substring(2, 15)
  return {
    ...payload,
    _ts: timestamp,
    _nonce: nonce
  }
}

export function isRequestFresh(timestamp, maxAgeMs = 30000) {
  return Math.abs(Date.now() - timestamp) < maxAgeMs
}

// ─── Initialize Anti-Scraping ───
export function initAntiScraping() {
  botDetector.start()
  enableContentProtection()

  // Check bot score periodically
  const interval = setInterval(() => {
    if (botDetector.isLikelyBot()) {
      logSecurityEvent('BOT_DETECTED', {
        score: botDetector.getBotScore(),
        signals: { ...botDetector.signals }
      })
    }
  }, 30000) // Every 30 seconds

  return () => {
    botDetector.stop()
    clearInterval(interval)
  }
}
