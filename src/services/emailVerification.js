// emailVerification.js
// Calls the verify-email edge function (which uses Abstract API server-side —
// the API key never reaches the browser). Returns a simple verdict.

import { supabase } from '../lib/supabase'

/**
 * Verify an email address is valid/deliverable.
 * Fails OPEN: on any error the caller should not block registration.
 * @param {string} email
 * @returns {Promise<{ allow: boolean, reason: string|null, checked: boolean }>}
 */
export async function verifyEmail(email) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-email', {
      body: { email },
    })
    if (error) return { allow: true, reason: null, checked: false }
    return {
      allow: data?.allow !== false,
      reason: data?.reason ?? null,
      checked: data?.checked === true,
    }
  } catch {
    return { allow: true, reason: null, checked: false }
  }
}
