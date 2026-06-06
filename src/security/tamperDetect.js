/**
 * MediBook — Tamper Detection System
 * Monitors DOM integrity, storage manipulation, and runtime hijacking.
 * Defense-in-depth layer — server-side RLS is the actual enforcement.
 */

import { logSecurityEvent } from './auditLog'

// ─── Critical Selectors to Monitor ───
const CRITICAL_SELECTORS = [
  '[data-price]',
  '[data-role]',
  '[data-status]',
  '.consultation-fee',
  '.kpi-value',
  '.badge-confirmed',
  '.badge-pending'
]

// ─── DOM Integrity Monitor ───
let domObserver = null

export function startDOMMonitor() {
  if (typeof MutationObserver === 'undefined') return

  domObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target
      if (isCriticalElement(target)) {
        logSecurityEvent('TAMPER_DETECTED', {
          type: 'DOM_MUTATION',
          element: target.tagName,
          className: target.className,
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue
        })
      }
    }
  })

  // Observe the entire body for attribute and content changes
  const body = document.body
  if (body) {
    domObserver.observe(body, {
      childList: false,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true
    })
  }
}

function isCriticalElement(el) {
  if (!el || !el.matches) return false
  return CRITICAL_SELECTORS.some(selector => {
    try { return el.matches(selector) } catch { return false }
  })
}

export function stopDOMMonitor() {
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }
}

// ─── Storage Guard ───
const PROTECTED_KEYS = ['sb-', 'supabase.auth']
let originalSetItem = null

export function startStorageGuard() {
  if (originalSetItem) return // Already guarding

  originalSetItem = Storage.prototype.setItem

  Storage.prototype.setItem = function (key, value) {
    // Check if someone is trying to modify auth tokens externally
    const isProtected = PROTECTED_KEYS.some(pk => key.includes(pk))

    if (isProtected) {
      // Validate that the call is coming from Supabase (heuristic)
      const stack = new Error().stack || ''
      const isFromSupabase = stack.includes('supabase') || stack.includes('@supabase')
      const isFromApp = stack.includes('AuthContext') || stack.includes('supabase.js')

      if (!isFromSupabase && !isFromApp) {
        logSecurityEvent('TAMPER_DETECTED', {
          type: 'STORAGE_MANIPULATION',
          key,
          source: 'external'
        })
      }
    }

    return originalSetItem.call(this, key, value)
  }
}

export function stopStorageGuard() {
  if (originalSetItem) {
    Storage.prototype.setItem = originalSetItem
    originalSetItem = null
  }
}

// ─── Runtime Integrity Check ───
export function checkRuntimeIntegrity() {
  const issues = []

  // Check if fetch has been overridden
  if (typeof window.fetch !== 'function' || window.fetch.toString().includes('native code') === false) {
    // Some bundlers wrap fetch, so this is a soft check
    const fetchStr = window.fetch.toString()
    if (!fetchStr.includes('fetch') && !fetchStr.includes('bound')) {
      issues.push('fetch_override')
    }
  }

  // Check if console methods have been stripped (anti-debug)
  if (typeof console.log !== 'function') {
    issues.push('console_stripped')
  }

  if (issues.length > 0) {
    logSecurityEvent('TAMPER_DETECTED', {
      type: 'RUNTIME_INTEGRITY',
      issues
    })
  }

  return issues.length === 0
}

// ─── Form Honeypot Helper ───
export function createHoneypotField() {
  return {
    fieldName: '_hp_field',
    style: {
      position: 'absolute',
      left: '-9999px',
      top: '-9999px',
      opacity: 0,
      height: 0,
      width: 0,
      overflow: 'hidden',
      tabIndex: -1
    }
  }
}

export function isHoneypotFilled(formData) {
  const hpValue = formData['_hp_field'] || formData['_hp_email'] || ''
  return hpValue.length > 0
}

// ─── Initialize All Tamper Detection ───
export function initTamperDetection() {
  startDOMMonitor()
  startStorageGuard()
  checkRuntimeIntegrity()

  // Periodic integrity check every 5 minutes
  const interval = setInterval(() => {
    checkRuntimeIntegrity()
  }, 5 * 60 * 1000)

  return () => {
    stopDOMMonitor()
    stopStorageGuard()
    clearInterval(interval)
  }
}
