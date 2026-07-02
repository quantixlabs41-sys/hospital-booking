// pwnedPassword.js
// Checks a password against Have I Been Pwned's Pwned Passwords range API using
// k-anonymity: the password is SHA-1 hashed locally, and ONLY the first 5 hex
// characters of the hash are sent. HIBP returns all hash suffixes for that
// prefix; we match ours locally. The raw password never leaves the browser.
//
// No API key required. See https://haveibeenpwned.com/API/v3#PwnedPasswords

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'

/** SHA-1 hex (uppercase) of a string via Web Crypto. */
async function sha1HexUpper(str) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * Check whether a password appears in known breaches.
 * Fails OPEN: any error returns { pwned: false, checked: false } so a network
 * or API problem never blocks registration.
 *
 * @param {string} password
 * @returns {Promise<{ pwned: boolean, count: number, checked: boolean }>}
 */
export async function checkPasswordPwned(password) {
  try {
    if (!password || typeof crypto === 'undefined' || !crypto.subtle) {
      return { pwned: false, count: 0, checked: false }
    }

    const hash = await sha1HexUpper(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      // Add-Padding hides the real response size for extra privacy.
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return { pwned: false, count: 0, checked: false }

    const text = await res.text()
    for (const line of text.split('\n')) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const suf = line.slice(0, idx).trim().toUpperCase()
      if (suf === suffix) {
        const count = parseInt(line.slice(idx + 1).trim(), 10) || 0
        return { pwned: count > 0, count, checked: true }
      }
    }
    return { pwned: false, count: 0, checked: true }
  } catch {
    return { pwned: false, count: 0, checked: false }
  }
}
