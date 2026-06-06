/**
 * MediBook — Integrity Check
 * CSP enforcement helpers and SRI validation.
 */

/**
 * Check if the page's Content Security Policy is active.
 * Returns any violations detected.
 */
export function monitorCSPViolations() {
  const violations = []

  document.addEventListener('securitypolicyviolation', (event) => {
    violations.push({
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      timestamp: new Date().toISOString()
    })

    // Log in dev mode
    if (import.meta.env.DEV) {
      console.warn('[CSP Violation]', {
        blocked: event.blockedURI,
        directive: event.violatedDirective
      })
    }
  })

  return violations
}

/**
 * Verify that critical external scripts haven't been tampered with.
 * Checks script integrity attributes.
 */
export function verifyScriptIntegrity() {
  const scripts = document.querySelectorAll('script[src]')
  const issues = []

  scripts.forEach(script => {
    const src = script.getAttribute('src')
    // External CDN scripts should have integrity attributes
    if (src && (src.startsWith('http') || src.startsWith('//'))) {
      if (!script.getAttribute('integrity')) {
        issues.push({
          src,
          issue: 'Missing SRI integrity attribute'
        })
      }
    }
  })

  return issues
}

/**
 * Initialize integrity monitoring
 */
export function initIntegrityCheck() {
  const violations = monitorCSPViolations()
  const scriptIssues = verifyScriptIntegrity()

  if (import.meta.env.DEV && scriptIssues.length > 0) {
    console.info('[Integrity] Script issues:', scriptIssues)
  }

  return { violations, scriptIssues }
}
