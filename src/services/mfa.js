// mfa.js
// Thin wrapper around Supabase Auth's TOTP MFA API (supabase.auth.mfa.*).
//
// Assurance levels (AAL):
//   aal1 = password only
//   aal2 = a TOTP challenge has been satisfied this session
//
// NOTE: TOTP MFA must be enabled in the Supabase dashboard
// (Authentication → Providers → Multi-Factor Auth → TOTP) for these calls to work.

import { supabase } from '../lib/supabase'

/**
 * List the current user's MFA factors.
 * @returns {Promise<{ all: Array, totp: Array, verifiedTotp: Array }>}
 */
export async function listFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  const all = data?.all ?? []
  const totp = data?.totp ?? all.filter(f => f.factor_type === 'totp')
  const verifiedTotp = totp.filter(f => f.status === 'verified')
  return { all, totp, verifiedTotp }
}

/** True if the user has at least one verified TOTP factor. */
export async function hasVerifiedTotp() {
  const { verifiedTotp } = await listFactors()
  return verifiedTotp.length > 0
}

/**
 * Read the session's current and next assurance levels.
 * currentLevel: the level the session is at right now.
 * nextLevel: the highest level the user could reach (aal2 if a verified factor exists).
 * @returns {Promise<{ currentLevel: string|null, nextLevel: string|null }>}
 */
export async function getAAL() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return {
    currentLevel: data?.currentLevel ?? null,
    nextLevel: data?.nextLevel ?? null,
  }
}

/**
 * Begin TOTP enrollment. Returns the factor id plus the secret and QR needed
 * for the user to add MediBook to their authenticator app.
 * @param {string} [friendlyName]
 * @returns {Promise<{ factorId: string, qrSvg: string, secret: string, uri: string }>}
 */
export async function enrollTotp(friendlyName) {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    // A friendly name must be unique per user; suffix with a timestamp so a
    // re-enroll after an abandoned attempt never collides.
    friendlyName: friendlyName || `MediBook ${new Date().toISOString().slice(0, 19)}`,
  })
  if (error) throw error
  return {
    factorId: data.id,
    qrSvg: data.totp?.qr_code ?? '',
    secret: data.totp?.secret ?? '',
    uri: data.totp?.uri ?? '',
  }
}

/**
 * Verify a TOTP code against a factor (used for both enrollment confirmation
 * and login step-up). Uses the challengeAndVerify convenience which creates a
 * challenge then verifies in one call. On success the session is raised to aal2.
 * @param {string} factorId
 * @param {string} code - 6-digit TOTP code
 */
export async function verifyTotp(factorId, code) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: String(code).trim(),
  })
  if (error) throw error
  return data
}

/**
 * Remove a factor (self-service, or cleanup of an abandoned enrollment).
 * @param {string} factorId
 */
export async function unenrollFactor(factorId) {
  const { data, error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
  return data
}

/**
 * Best-effort cleanup: remove any unverified TOTP factors left over from an
 * abandoned enrollment so the account never accumulates dangling factors.
 */
export async function cleanupUnverifiedTotp() {
  try {
    const { totp } = await listFactors()
    const unverified = totp.filter(f => f.status !== 'verified')
    await Promise.all(unverified.map(f => unenrollFactor(f.id).catch(() => {})))
  } catch {
    /* non-fatal */
  }
}

/** Map raw Supabase MFA errors to friendly, non-leaky messages. */
export function friendlyMfaError(err) {
  const msg = String(err?.message || '')
  if (/invalid.*code|otp|verify/i.test(msg)) return 'That code is incorrect or expired. Please try again.'
  if (/rate|too many/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.'
  if (/not enabled|unsupported/i.test(msg)) return 'MFA is not enabled for this project. Contact the administrator.'
  return 'Something went wrong with two-factor authentication. Please try again.'
}

// ─────────────────────────────────────────────
// Recovery codes (backend: migration 027 + mfa-recovery-reset edge function)
// ─────────────────────────────────────────────

/**
 * Generate a fresh set of 10 single-use recovery codes for the current user.
 * Returns the plaintext codes ONCE — display them and never store client-side.
 * @returns {Promise<string[]>}
 */
export async function generateRecoveryCodes() {
  const { data, error } = await supabase.rpc('mfa_generate_recovery_codes')
  if (error) throw error
  return data ?? []
}

/** How many unused recovery codes the current user has left. */
export async function recoveryCodesRemaining() {
  const { data, error } = await supabase.rpc('mfa_recovery_codes_remaining')
  if (error) throw error
  return data ?? 0
}

/**
 * Self-service recovery: spend a recovery code to remove the user's own MFA
 * factors (via the mfa-recovery-reset edge function) so they can re-enroll.
 * @param {string} code
 */
export async function recoveryReset(code) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  const { data, error } = await supabase.functions.invoke('mfa-recovery-reset', {
    body: { code },
    headers,
  })
  if (error) {
    const msg = (await error?.context?.json?.().catch(() => null))?.error
    throw new Error(msg || error.message || 'Recovery failed.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}
