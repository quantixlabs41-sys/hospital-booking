import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// Live Queue ETA service
//
// Wraps the queue RPCs (seed/advance/flag_delay) and Supabase Realtime
// subscriptions that power the doctor's queue console and the patient's
// "Uber-style" live ETA view. See supabase/migrations/032_live_queue_eta.sql.
// ─────────────────────────────────────────────

export const QUEUE_STATE = {
  WAITING: 'WAITING',
  CHECKED_IN: 'CHECKED_IN',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
}

export const QUEUE_STATE_LABELS = {
  WAITING: 'Waiting',
  CHECKED_IN: 'Checked in',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
}

/** Map a raw queue_entries DB row (snake_case) to a camelCase client object. */
export function mapQueueEntry(row) {
  if (!row) return null
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    doctorId: row.doctor_id,
    patientId: row.patient_id,
    queueDate: row.queue_date,
    scheduledStartTime: row.scheduled_start_time,
    position: row.position,
    state: row.state,
    etaAt: row.eta_at,
    suggestedLeaveAt: row.suggested_leave_at,
    consultStartedAt: row.consult_started_at,
    consultCompletedAt: row.consult_completed_at,
    actualDurationMinutes: row.actual_duration_minutes,
  }
}

const todayStr = () => new Date().toISOString().split('T')[0]

// ─────────────────────────────────────────────
// Doctor-side mutations
// ─────────────────────────────────────────────

async function rpcQueue(fn, args, fallbackMsg) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message || fallbackMsg)
  return (data ?? []).map(mapQueueEntry)
}

/** Idempotently build (or refresh) the queue for a doctor/day and return it. */
export function seedQueue(doctorId, date = todayStr()) {
  return rpcQueue('seed_queue', { p_doctor_id: doctorId, p_date: date }, 'Could not load the queue.')
}

export function markCheckedIn(entryId) {
  return rpcQueue('advance_queue', { p_entry_id: entryId, p_next_state: 'CHECKED_IN' }, 'Could not check the patient in.')
}

export function startConsultation(entryId) {
  return rpcQueue('advance_queue', { p_entry_id: entryId, p_next_state: 'IN_CONSULTATION' }, 'Could not start the consultation.')
}

export function completeConsultation(entryId) {
  return rpcQueue('advance_queue', { p_entry_id: entryId, p_next_state: 'COMPLETED' }, 'Could not complete the consultation.')
}

export function skipEntry(entryId) {
  return rpcQueue('advance_queue', { p_entry_id: entryId, p_next_state: 'SKIPPED' }, 'Could not skip the patient.')
}

export function restoreEntry(entryId) {
  return rpcQueue('advance_queue', { p_entry_id: entryId, p_next_state: 'WAITING' }, 'Could not restore the patient.')
}

export function flagDelay(doctorId, minutes, reason = '', date = todayStr()) {
  return rpcQueue(
    'flag_delay',
    { p_doctor_id: doctorId, p_date: date, p_delay_minutes: minutes, p_reason: reason },
    'Could not flag the delay.',
  )
}

// ─────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────

/** The current queue snapshot for a doctor/day (ordered), via a fresh seed. */
export async function getDoctorQueue(doctorId, date = todayStr()) {
  return seedQueue(doctorId, date)
}

/** The patient's own live queue entry for an appointment, or null. */
export async function getMyQueueEntry(appointmentId) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle()
  if (error) throw error
  return mapQueueEntry(data)
}

// ─────────────────────────────────────────────
// Realtime subscriptions
// ─────────────────────────────────────────────

/**
 * Subscribe to every queue change for a doctor/day. `onChange` is called with
 * the changed entry (mapped). Returns an unsubscribe function.
 */
export function subscribeToDoctorQueue(doctorId, date, onChange) {
  const channel = supabase
    .channel(`queue-doctor-${doctorId}-${date}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries', filter: `doctor_id=eq.${doctorId}` },
      (payload) => onChange(mapQueueEntry(payload.new ?? payload.old)),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

/**
 * Subscribe to a single patient's queue entry (their appointment). Returns an
 * unsubscribe function.
 */
export function subscribeToMyEntry(appointmentId, onChange) {
  const channel = supabase
    .channel(`queue-entry-${appointmentId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries', filter: `appointment_id=eq.${appointmentId}` },
      (payload) => onChange(mapQueueEntry(payload.new ?? payload.old)),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─────────────────────────────────────────────
// Formatting helpers (shared by both views)
// ─────────────────────────────────────────────

/** Minutes from now until an ISO timestamp (clamped at 0). */
export function minutesUntil(iso) {
  if (!iso) return null
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  return Math.max(0, diff)
}

/** Local wall-clock time label, e.g. "10:40 AM". */
export function formatEtaTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
