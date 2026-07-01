/**
 * MediBook — Centralized Validation Engine
 * Single source of truth for all field validation rules.
 * 
 * Usage:
 *   import { RULES, validateField, validateForm, getPasswordStrength, rhfRules } from './validators'
 * 
 *   // React Hook Form integration:
 *   {...register('email', rhfRules.email)}
 * 
 *   // Manual validation:
 *   const result = validateField('phone', '+91 98765 43210')
 *   if (!result.valid) showError(result.message)
 */

// ─────────────────────────────────────────────
// Regex Patterns
// ─────────────────────────────────────────────

const PATTERNS = {
  // RFC 5322 simplified — covers 99.9% of real-world emails
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,

  // Letters, spaces, dots, apostrophes, hyphens (international names)
  name: /^[a-zA-Z\u00C0-\u024F\s.''-]+$/,

  // 10-15 digits, optional leading + (after cleaning spaces/dashes/parens)
  phone: /^\+?\d{10,15}$/,

  // Password: 8+ chars, 1 uppercase, 1 lowercase, 1 digit, 1 special
  passwordStrong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,

  // Specialization: letters, spaces, ampersand, comma, slash, hyphen
  specialization: /^[a-zA-Z\s&,/()-]+$/,

  // Qualification: letters, spaces, dots, commas, ampersand, slash, hyphen
  qualification: /^[a-zA-Z\s.,&/()-]+$/,

  // Registration number: alphanumeric, hyphens, slashes
  registrationNumber: /^[A-Za-z0-9\-/]+$/,
}

// ─────────────────────────────────────────────
// Validation Rules
// ─────────────────────────────────────────────

export const RULES = {
  email: {
    pattern: PATTERNS.email,
    maxLength: 254,
    messages: {
      required: 'Email address is required',
      pattern: 'Please enter a valid email address',
      maxLength: 'Email must be under 254 characters',
    }
  },
  password: {
    minLength: 8,
    maxLength: 128,
    pattern: PATTERNS.passwordStrong,
    messages: {
      required: 'Password is required',
      minLength: 'Password must be at least 8 characters',
      maxLength: 'Password must be under 128 characters',
      pattern: 'Must include uppercase, lowercase, number, and special character',
    }
  },
  name: {
    pattern: PATTERNS.name,
    minLength: 2,
    maxLength: 100,
    messages: {
      required: 'Full name is required',
      minLength: 'Name must be at least 2 characters',
      maxLength: 'Name must be under 100 characters',
      pattern: 'Name can only contain letters, spaces, dots, and hyphens',
    }
  },
  phone: {
    pattern: PATTERNS.phone,
    minLength: 10,
    maxLength: 15,
    messages: {
      required: 'Phone number is required',
      pattern: 'Please enter a valid phone number (10-15 digits)',
      minLength: 'Phone number must be at least 10 digits',
    }
  },
  bio: {
    maxLength: 500,
    messages: {
      maxLength: 'Bio must be under 500 characters',
    }
  },
  address: {
    maxLength: 500,
    messages: {
      maxLength: 'Address must be under 500 characters',
    }
  },
  reason: {
    maxLength: 500,
    messages: {
      maxLength: 'Reason must be under 500 characters',
    }
  },
  cancelReason: {
    maxLength: 300,
    messages: {
      required: 'Please provide a reason for cancellation',
      maxLength: 'Reason must be under 300 characters',
    }
  },
  specialization: {
    pattern: PATTERNS.specialization,
    minLength: 2,
    maxLength: 100,
    messages: {
      required: 'Specialization is required',
      minLength: 'Must be at least 2 characters',
      maxLength: 'Must be under 100 characters',
      pattern: 'Only letters, spaces, and common separators allowed',
    }
  },
  qualification: {
    pattern: PATTERNS.qualification,
    minLength: 2,
    maxLength: 200,
    messages: {
      required: 'Qualification is required',
      minLength: 'Must be at least 2 characters',
      maxLength: 'Must be under 200 characters',
      pattern: 'Only letters, spaces, dots, and common separators allowed',
    }
  },
  registrationNumber: {
    pattern: PATTERNS.registrationNumber,
    minLength: 3,
    maxLength: 50,
    messages: {
      minLength: 'Must be at least 3 characters',
      maxLength: 'Must be under 50 characters',
      pattern: 'Only letters, numbers, hyphens, and slashes allowed',
    }
  },
  experienceYears: {
    min: 0,
    max: 70,
    messages: {
      min: 'Experience cannot be negative',
      max: 'Experience cannot exceed 70 years',
    }
  },
  consultationFee: {
    min: 0,
    max: 100000,
    messages: {
      min: 'Fee cannot be negative',
      max: 'Fee cannot exceed ₹1,00,000',
    }
  },
  emergencyContact: {
    pattern: PATTERNS.phone,
    messages: {
      pattern: 'Please enter a valid phone number',
    }
  },
  language: {
    pattern: /^[a-zA-Z\s]+$/,
    minLength: 2,
    maxLength: 30,
    messages: {
      pattern: 'Language name can only contain letters',
      minLength: 'Must be at least 2 characters',
      maxLength: 'Must be under 30 characters',
    }
  },
  dateOfBirth: {
    messages: {
      future: 'Date of birth cannot be in the future',
      tooOld: 'Please enter a valid date of birth',
    }
  },
}


// ─────────────────────────────────────────────
// Field-level validation
// ─────────────────────────────────────────────

/**
 * Validate a single field value against its rules.
 * @param {string} fieldName — key from RULES
 * @param {*} value — the field value
 * @param {object} options — { required: boolean }
 * @returns {{ valid: boolean, message: string|null }}
 */
export function validateField(fieldName, value, options = {}) {
  const rule = RULES[fieldName]
  if (!rule) return { valid: true, message: null }

  const { required = false } = options
  const strVal = typeof value === 'string' ? value.trim() : value

  // Required check
  if (required && (strVal === '' || strVal === null || strVal === undefined)) {
    return { valid: false, message: rule.messages?.required || `${fieldName} is required` }
  }

  // Skip further validation if empty and not required
  if (strVal === '' || strVal === null || strVal === undefined) {
    return { valid: true, message: null }
  }

  // String validations
  if (typeof strVal === 'string') {
    if (rule.minLength && strVal.length < rule.minLength) {
      return { valid: false, message: rule.messages?.minLength || `Minimum ${rule.minLength} characters` }
    }
    if (rule.maxLength && strVal.length > rule.maxLength) {
      return { valid: false, message: rule.messages?.maxLength || `Maximum ${rule.maxLength} characters` }
    }
    if (rule.pattern && !rule.pattern.test(strVal)) {
      return { valid: false, message: rule.messages?.pattern || 'Invalid format' }
    }
  }

  // Numeric validations
  if (typeof strVal === 'number' || (typeof strVal === 'string' && !isNaN(Number(strVal)))) {
    const numVal = Number(strVal)
    if (rule.min !== undefined && numVal < rule.min) {
      return { valid: false, message: rule.messages?.min || `Minimum value is ${rule.min}` }
    }
    if (rule.max !== undefined && numVal > rule.max) {
      return { valid: false, message: rule.messages?.max || `Maximum value is ${rule.max}` }
    }
  }

  // Date of birth validation
  if (fieldName === 'dateOfBirth' && strVal) {
    const dob = new Date(strVal + 'T00:00:00')
    const now = new Date()
    if (dob > now) {
      return { valid: false, message: rule.messages?.future }
    }
    const minDate = new Date('1900-01-01T00:00:00')
    if (dob < minDate) {
      return { valid: false, message: rule.messages?.tooOld }
    }
  }

  return { valid: true, message: null }
}

/**
 * Validate phone number (cleans non-digit chars first).
 */
export function validatePhone(phone, required = false) {
  if (!phone || !phone.trim()) {
    return required
      ? { valid: false, message: RULES.phone.messages.required }
      : { valid: true, message: null }
  }
  const cleaned = phone.replace(/[\s\-()]/g, '')
  return validateField('phone', cleaned, { required })
}


// ─────────────────────────────────────────────
// Form-level validation
// ─────────────────────────────────────────────

/**
 * Validate an entire form object.
 * @param {object} formData — the form values
 * @param {object} fieldConfig — { fieldName: { required: boolean }, ... }
 * @returns {{ valid: boolean, errors: object }}
 */
export function validateForm(formData, fieldConfig) {
  const errors = {}
  let valid = true

  for (const [field, config] of Object.entries(fieldConfig)) {
    const value = formData[field]
    const result = field === 'phone' || field === 'emergencyContact'
      ? validatePhone(value, config.required)
      : validateField(field, value, config)

    if (!result.valid) {
      errors[field] = result.message
      valid = false
    }
  }

  return { valid, errors }
}


// ─────────────────────────────────────────────
// Password Strength
// ─────────────────────────────────────────────

/**
 * Calculate password strength with detailed breakdown.
 * @returns {{ level: number, label: string, color: string, checks: object }}
 */
export function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: '', checks: {} }

  const checks = {
    length8: password.length >= 8,
    length12: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }

  let score = 0
  if (checks.length8) score++
  if (checks.length12) score++
  if (checks.uppercase) score++
  if (checks.lowercase) score++
  if (checks.digit) score++
  if (checks.special) score++

  if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--danger)', checks }
  if (score <= 2) return { level: 2, label: 'Fair', color: '#F97316', checks }
  if (score <= 3) return { level: 3, label: 'Good', color: 'var(--warning)', checks }
  if (score <= 4) return { level: 4, label: 'Strong', color: 'var(--success)', checks }
  return { level: 5, label: 'Excellent', color: '#059669', checks }
}


// ─────────────────────────────────────────────
// React Hook Form Integration Helpers
// ─────────────────────────────────────────────

/**
 * Pre-built rule objects for react-hook-form's `register()`.
 * Usage: {...register('email', rhfRules.email)}
 */
export const rhfRules = {
  email: {
    required: RULES.email.messages.required,
    maxLength: { value: RULES.email.maxLength, message: RULES.email.messages.maxLength },
    pattern: { value: RULES.email.pattern, message: RULES.email.messages.pattern },
  },
  password: {
    required: RULES.password.messages.required,
    minLength: { value: RULES.password.minLength, message: RULES.password.messages.minLength },
    maxLength: { value: RULES.password.maxLength, message: RULES.password.messages.maxLength },
    pattern: { value: RULES.password.pattern, message: RULES.password.messages.pattern },
  },
  // Login password — less strict (user may have old 6-char password)
  loginPassword: {
    required: RULES.password.messages.required,
    minLength: { value: 6, message: 'Password must be at least 6 characters' },
  },
  name: {
    required: RULES.name.messages.required,
    minLength: { value: RULES.name.minLength, message: RULES.name.messages.minLength },
    maxLength: { value: RULES.name.maxLength, message: RULES.name.messages.maxLength },
    pattern: { value: RULES.name.pattern, message: RULES.name.messages.pattern },
  },
  phone: {
    required: RULES.phone.messages.required,
    validate: (value) => {
      if (!value) return true
      const cleaned = value.replace(/[\s\-()]/g, '')
      if (!RULES.phone.pattern.test(cleaned)) return RULES.phone.messages.pattern
      return true
    }
  },
  phoneOptional: {
    validate: (value) => {
      if (!value || !value.trim()) return true
      const cleaned = value.replace(/[\s\-()]/g, '')
      if (!RULES.phone.pattern.test(cleaned)) return RULES.phone.messages.pattern
      return true
    }
  },
}
