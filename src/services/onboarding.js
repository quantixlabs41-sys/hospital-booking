import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// Onboarding Progress
// ─────────────────────────────────────────────

/**
 * Fetch all completed onboarding steps for a user.
 * Returns array of step_key strings.
 */
export async function getOnboardingProgress(userId) {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('step_key, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Mark a single onboarding step as completed.
 * Uses upsert to handle idempotent calls.
 */
export async function markStepComplete(userId, stepKey, metadata = {}) {
  const { error } = await supabase
    .from('onboarding_progress')
    .upsert({
      user_id: userId,
      step_key: stepKey,
      metadata,
      completed_at: new Date().toISOString()
    }, { onConflict: 'user_id,step_key' })

  if (error) throw error
}

/**
 * Check if onboarding is fully complete for a user.
 * A user is considered onboarded when the 'completed' step exists.
 */
export async function isOnboardingComplete(userId) {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('step_key', 'completed')
    .maybeSingle()

  if (error) throw error
  return !!data
}


// ─────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────

/**
 * Get user preferences (notification, language, timezone).
 */
export async function getPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Save/update user preferences.
 * Uses upsert since user_id is UNIQUE.
 */
export async function savePreferences(userId, prefs) {
  const payload = {
    user_id: userId,
    notification_channel: prefs.notification_channel || 'EMAIL',
    language: prefs.language || 'en',
    timezone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    appointment_reminder: prefs.appointment_reminder !== false,
    marketing_emails: prefs.marketing_emails === true
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}


// ─────────────────────────────────────────────
// User Consents (Audit-Grade, Insert-Only)
// ─────────────────────────────────────────────

/**
 * Record one or more consent grants.
 * Each consent is a separate immutable row for audit compliance.
 * 
 * @param {string} userId
 * @param {Array<{consent_type: string, granted: boolean}>} consents
 */
export async function saveConsents(userId, consents) {
  const rows = consents.map(c => ({
    user_id: userId,
    consent_type: c.consent_type,
    version: '1.0',
    granted: c.granted,
    granted_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('user_consents')
    .insert(rows)

  if (error) throw error
}

/**
 * Get all active consents for a user.
 * Returns the latest consent record per type.
 */
export async function getConsents(userId) {
  const { data, error } = await supabase
    .from('user_consents')
    .select('*')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false })

  if (error) throw error

  // Deduplicate: keep only the latest per consent_type
  const latest = {}
  for (const row of (data || [])) {
    if (!latest[row.consent_type]) {
      latest[row.consent_type] = row
    }
  }
  return Object.values(latest)
}


// ─────────────────────────────────────────────
// Onboarding Step Definitions
// ─────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { key: 'welcome', label: 'Welcome', icon: 'bi-hand-thumbs-up' },
  { key: 'profile_details', label: 'Profile', icon: 'bi-person-circle' },
  { key: 'preferences', label: 'Preferences', icon: 'bi-sliders' },
  { key: 'consent', label: 'Consent', icon: 'bi-shield-check' }
]

/**
 * Get the next incomplete step index.
 * Returns -1 if all steps are complete.
 */
export function getNextStepIndex(completedSteps) {
  const completedKeys = completedSteps.map(s => s.step_key)
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    if (!completedKeys.includes(ONBOARDING_STEPS[i].key)) {
      return i
    }
  }
  return -1 // all complete
}
