/**
 * MediBook — Audit Log
 * Centralized security event logging.
 * Dev: console only | Production: Supabase audit_logs table.
 */

import { supabase } from '../lib/supabase'

const IS_DEV = import.meta.env.DEV

/**
 * Log a security event.
 * @param {string} event - Event name (e.g., 'LOGIN_SUCCESS', 'TAMPER_DETECTED')
 * @param {object} details - Event-specific metadata
 */
export function logSecurityEvent(event, details = {}) {
  const entry = {
    event,
    details,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  }

  // Always log to console in dev
  if (IS_DEV) {
    const color = getEventColor(event)
    console.log(
      `%c[SECURITY] ${event}`,
      `color: ${color}; font-weight: bold;`,
      details
    )
    return
  }

  // In production, write to audit_logs table
  writeToAuditLog(entry).catch(err => {
    console.error('[AuditLog] Failed to write:', err)
  })
}

async function writeToAuditLog(entry) {
  try {
    // Get current user ID if available
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id ?? null

    await supabase.from('audit_logs').insert({
      user_id: userId,
      event: entry.event,
      details: entry.details,
      user_agent: entry.userAgent,
      created_at: entry.timestamp
    })
  } catch (err) {
    // Silently fail — audit logging should never break the app
    console.error('[AuditLog] Insert failed:', err)
  }
}

function getEventColor(event) {
  if (event.includes('TAMPER') || event.includes('BOT')) return '#EF233C'
  if (event.includes('LOGIN_FAILED') || event.includes('FAILED')) return '#F97316'
  if (event.includes('SUCCESS') || event.includes('SENT')) return '#2DC653'
  if (event.includes('RATE_LIMIT') || event.includes('DEVTOOLS')) return '#F59E0B'
  return '#6366F1'
}

/**
 * Log login success
 */
export function logLoginSuccess(userId) {
  logSecurityEvent('LOGIN_SUCCESS', { userId })
}

/**
 * Log login failure
 */
export function logLoginFailed(email, reason) {
  logSecurityEvent('LOGIN_FAILED', { email, reason })
}

/**
 * Log session timeout
 */
export function logSessionTimeout(userId) {
  logSecurityEvent('SESSION_TIMEOUT', { userId })
}
