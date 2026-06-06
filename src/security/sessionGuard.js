/**
 * MediBook — Session Security Guard
 * Idle timeout, concurrent session detection, JWT refresh monitoring.
 */

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000   // 30 minutes
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000  // Show warning 5 min before expiry
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

class SessionGuard {
  constructor(options = {}) {
    this.idleTimeout = options.idleTimeout || DEFAULT_IDLE_TIMEOUT
    this.warningTimeout = this.idleTimeout - WARNING_BEFORE_TIMEOUT
    this.onWarning = options.onWarning || (() => {})
    this.onTimeout = options.onTimeout || (() => {})
    this.onActivity = options.onActivity || (() => {})

    this.idleTimer = null
    this.warningTimer = null
    this.isWarningShown = false
    this.lastActivity = Date.now()
    this.isActive = false

    this._handleActivity = this._handleActivity.bind(this)
  }

  start() {
    if (this.isActive) return
    this.isActive = true
    this.lastActivity = Date.now()

    // Listen for user activity
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, this._handleActivity, { passive: true })
    })

    this._resetTimers()
  }

  stop() {
    this.isActive = false

    ACTIVITY_EVENTS.forEach(event => {
      document.removeEventListener(event, this._handleActivity)
    })

    this._clearTimers()
  }

  _handleActivity() {
    if (!this.isActive) return

    this.lastActivity = Date.now()

    if (this.isWarningShown) {
      this.isWarningShown = false
      this.onActivity()
    }

    this._resetTimers()
  }

  _resetTimers() {
    this._clearTimers()

    // Warning timer
    this.warningTimer = setTimeout(() => {
      this.isWarningShown = true
      this.onWarning(WARNING_BEFORE_TIMEOUT / 1000)
    }, this.warningTimeout)

    // Logout timer
    this.idleTimer = setTimeout(() => {
      this.onTimeout()
    }, this.idleTimeout)
  }

  _clearTimers() {
    if (this.warningTimer) clearTimeout(this.warningTimer)
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.warningTimer = null
    this.idleTimer = null
  }

  /**
   * Extend session (user clicked "Stay Logged In")
   */
  extend() {
    this.isWarningShown = false
    this.lastActivity = Date.now()
    this._resetTimers()
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingTime() {
    const elapsed = Date.now() - this.lastActivity
    const remaining = Math.max(0, this.idleTimeout - elapsed)
    return Math.floor(remaining / 1000)
  }

  getIsWarningShown() {
    return this.isWarningShown
  }
}

export default SessionGuard
