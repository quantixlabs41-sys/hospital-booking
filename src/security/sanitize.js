/**
 * MediBook — Input Sanitization & XSS Prevention
 * Applied to all user-submitted text fields before insert/update.
 * 
 * Usage:
 *   import { sanitizeFormData, sanitizeForDisplay } from './sanitize'
 *   
 *   // Before DB write:
 *   const clean = sanitizeFormData({ name: userInput, bio: userBio })
 *   
 *   // For display (escapes HTML entities):
 *   const safe = sanitizeForDisplay(untrustedString)
 */

// ─────────────────────────────────────────────
// Core Sanitization
// ─────────────────────────────────────────────

/**
 * Strip HTML tags and dangerous patterns from a string.
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return str
  if (str.length === 0) return str

  let clean = str

  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, '')

  // Remove script-related patterns
  clean = clean.replace(/javascript:/gi, '')
  clean = clean.replace(/on\w+\s*=/gi, '')
  clean = clean.replace(/data:\s*text\/html/gi, '')
  clean = clean.replace(/vbscript:/gi, '')

  // Remove expression() CSS attacks
  clean = clean.replace(/expression\s*\(/gi, '')

  // Remove SQL injection patterns (defense-in-depth, not primary protection)
  clean = clean.replace(/(['";])\s*(DROP|ALTER|DELETE|INSERT|UPDATE|UNION|SELECT)\s/gi, '$1 ')

  // Normalize whitespace (collapse multiple spaces)
  clean = clean.replace(/\s{2,}/g, ' ')

  // Trim
  clean = clean.trim()

  return clean
}


// ─────────────────────────────────────────────
// Field-Specific Sanitizers
// ─────────────────────────────────────────────

/**
 * Sanitize email — trim, lowercase, remove dangerous chars.
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return email
  return email.trim().toLowerCase()
}

/**
 * Sanitize phone — strip all non-digit chars except leading +.
 */
export function sanitizePhone(phone) {
  if (typeof phone !== 'string') return phone
  const trimmed = phone.trim()
  if (!trimmed) return ''
  // Preserve leading + for international format
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * Sanitize name — trim, normalize whitespace, strip HTML.
 */
export function sanitizeName(name) {
  if (typeof name !== 'string') return name
  let clean = sanitizeInput(name)
  // Remove any remaining non-name characters (numbers, special chars except .'-)
  clean = clean.replace(/[^a-zA-Z\u00C0-\u024F\s.''-]/g, '')
  return clean
}

/**
 * Sanitize a free-text search term before it is interpolated into a
 * PostgREST `.or()` / `.ilike()` filter string.
 *
 * PostgREST treats commas, parentheses, dots and a few other characters as
 * filter syntax. If raw user input reaches an `.or(...)` string it could alter
 * the query (filter injection) and expose unintended rows. We strip those
 * control characters and the `%`/`_` LIKE wildcards, then clamp the length.
 */
export function sanitizeSearchTerm(term, maxLength = 60) {
  if (typeof term !== 'string') return ''
  let clean = sanitizeInput(term)
  // Remove PostgREST/PostgreSQL filter & LIKE control characters
  clean = clean.replace(/[,()*%_\\:"'`]/g, ' ')
  // Collapse whitespace and clamp length
  clean = clean.replace(/\s{2,}/g, ' ').trim()
  return clean.slice(0, maxLength)
}

/**
 * Sanitize numeric value — clamp to valid range.
 */
export function sanitizeNumeric(value, min = 0, max = Infinity) {
  const num = Number(value)
  if (isNaN(num)) return min
  return Math.max(min, Math.min(max, num))
}


// ─────────────────────────────────────────────
// Recursive Form Sanitization
// ─────────────────────────────────────────────

/**
 * Field type map for smart sanitization.
 * Keys that match will use their specific sanitizer.
 */
const FIELD_SANITIZERS = {
  email: sanitizeEmail,
  phone: sanitizePhone,
  emergency_contact: sanitizePhone,
  name: sanitizeName,
}

/**
 * Numeric field map — { fieldName: [min, max] }
 */
const NUMERIC_FIELDS = {
  experience_years: [0, 70],
  consultation_fee: [0, 100000],
  slot_duration_mins: [5, 120],
}

/**
 * Recursively sanitize all string fields in an object.
 * Uses field-specific sanitizers when available.
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
    if (key.startsWith('_') || key === 'id' || key === 'user_id' || key === 'patient_id' || key === 'doctor_id') {
      sanitized[key] = value
      continue
    }

    // Field-specific sanitizer
    if (FIELD_SANITIZERS[key] && typeof value === 'string') {
      sanitized[key] = FIELD_SANITIZERS[key](value)
      continue
    }

    // Numeric field sanitizer
    if (NUMERIC_FIELDS[key] && (typeof value === 'number' || typeof value === 'string')) {
      const [min, max] = NUMERIC_FIELDS[key]
      sanitized[key] = sanitizeNumeric(value, min, max)
      continue
    }

    // Recursive for nested objects
    sanitized[key] = sanitizeFormData(value)
  }
  return sanitized
}


// ─────────────────────────────────────────────
// Display Sanitization
// ─────────────────────────────────────────────

/**
 * Escape HTML entities for safe rendering in non-React contexts.
 * Note: React auto-escapes in JSX, so this is for edge cases.
 */
export function sanitizeForDisplay(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


// ─────────────────────────────────────────────
// Utility Validators (kept for backward compat)
// ─────────────────────────────────────────────

/**
 * Validate that a date is within a reasonable future range.
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
 * Validate phone number format.
 */
export function isValidPhone(phone) {
  if (!phone) return false
  const cleaned = phone.replace(/[\s\-()]/g, '')
  return /^\+?\d{10,15}$/.test(cleaned)
}

/**
 * Validate email format.
 */
export function isValidEmail(email) {
  if (!email) return false
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email)
}

/**
 * Rate-limit form submissions (prevent double-click).
 */
export function debounceSubmit(fn, delayMs = 2000) {
  let lastCall = 0
  let pending = false

  return async function (...args) {
    const now = Date.now()
    if (pending || now - lastCall < delayMs) {
      return
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
