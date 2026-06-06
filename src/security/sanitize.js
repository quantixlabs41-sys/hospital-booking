/**
 * MediBook — Input Sanitization & XSS Prevention
 * Applied to all user-submitted text fields before insert/update.
 */

/**
 * Strip HTML tags and dangerous patterns from a string.
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return str
  if (str.length === 0) return str

  // Remove HTML tags
  let clean = str.replace(/<[^>]*>/g, '')

  // Remove script-related patterns
  clean = clean.replace(/javascript:/gi, '')
  clean = clean.replace(/on\w+\s*=/gi, '')
  clean = clean.replace(/data:\s*text\/html/gi, '')
  clean = clean.replace(/vbscript:/gi, '')

  // Remove SQL injection patterns (basic defense-in-depth, not primary protection)
  clean = clean.replace(/(['";])\s*(DROP|ALTER|DELETE|INSERT|UPDATE|UNION|SELECT)\s/gi, '$1 ')

  // Trim whitespace
  clean = clean.trim()

  return clean
}

/**
 * Recursively sanitize all string fields in an object.
 */
export function sanitizeFormData(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeInput(obj) : obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFormData(item))
  }

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip private/system fields
    if (key.startsWith('_') || key === 'id') {
      sanitized[key] = value
    } else {
      sanitized[key] = sanitizeFormData(value)
    }
  }
  return sanitized
}

/**
 * Escape HTML entities for safe rendering.
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return str
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(str))
  return div.innerHTML
}

/**
 * Validate that a date is within a reasonable future range.
 * Prevents booking appointments 100 years from now.
 */
export function isReasonableDate(dateStr, maxDaysAhead = 365) {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDaysAhead)

  return date >= now && date <= maxDate
}

/**
 * Validate phone number format (basic).
 */
export function isValidPhone(phone) {
  if (!phone) return false
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  // Must be 10-15 digits, optionally starting with +
  return /^\+?\d{10,15}$/.test(cleaned)
}

/**
 * Validate email format (basic).
 */
export function isValidEmail(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Rate-limit form submissions (prevent double-click).
 * Returns a wrapped function that ignores rapid calls.
 */
export function debounceSubmit(fn, delayMs = 2000) {
  let lastCall = 0
  let pending = false

  return async function (...args) {
    const now = Date.now()
    if (pending || now - lastCall < delayMs) {
      return // Ignore rapid calls
    }
    lastCall = now
    pending = true
    try {
      return await fn.apply(this, args)
    } finally {
      pending = false
    }
  }
}
