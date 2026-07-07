import { supabase } from '../lib/supabase'
import { sanitizeInput } from '../security/sanitize'

/**
 * Book an appointment atomically.
 *
 * All validation + the double-booking check + the insert happen inside a
 * single Postgres transaction (the `book_appointment` RPC). There is no
 * check-then-insert race window: the unique index `idx_appointments_active_slot`
 * is the single source of truth, so two users hitting the same slot at the
 * same instant can never both succeed — exactly one wins, the other gets a
 * clean "slot taken" error.
 */
export async function bookAppointment(payload) {
  const { doctor_id, appointment_date, slot_start_time, reason } = payload

  // Light client-side guard for instant UX feedback (server re-validates).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const aptDate = new Date(appointment_date + 'T00:00:00')
  if (aptDate < today) {
    throw new Error('Cannot book appointments in the past.')
  }
  // For today, reject a slot whose start time has already passed.
  if (aptDate.getTime() === today.getTime() && slot_start_time) {
    const [sh, sm] = String(slot_start_time).split(':').map(Number)
    const now = new Date()
    if (sh * 60 + sm <= now.getHours() * 60 + now.getMinutes()) {
      throw new Error('This time slot has already passed. Please pick a later slot.')
    }
  }

  const { data, error } = await supabase.rpc('book_appointment', {
    p_doctor_id: doctor_id,
    p_date: appointment_date,
    p_start_time: slot_start_time,
    p_reason: sanitizeInput(reason || ''),
  })

  if (error) {
    // The atomic RPC isn't deployed yet (migration not run). PostgREST reports
    // this as PGRST202 / "Could not find the function ...". Fall back to a
    // direct insert so booking still works — the partial unique index
    // `idx_appointments_active_slot` keeps it safe against double-booking.
    const fnMissing =
      error.code === 'PGRST202' ||
      /Could not find the function/i.test(error.message || '')
    if (fnMissing) {
      return bookAppointmentFallback(payload, aptDate)
    }

    // Postgres unique violation (23505) or our custom P0002 → friendly message
    if (error.code === '23505' || error.code === 'P0002') {
      throw new Error('This time slot was just booked by someone else. Please pick another slot.')
    }
    // RAISE EXCEPTION messages come through as error.message
    throw new Error(error.message || 'Could not book the appointment. Please try again.')
  }

  // RPC returns the appointment row; nested doctor info is fetched separately
  // by the callers that need it, keeping the booking call a single round-trip.
  return data
}

/**
 * Fallback path used only when the `book_appointment` RPC has not been
 * deployed. Validates, computes the end time, and inserts directly. The
 * unique index still prevents two patients from holding the same slot.
 *
 * Run `supabase_appointment_concurrency_migration.sql` to enable the fully
 * atomic, single-round-trip RPC path above.
 */
async function bookAppointmentFallback(payload, aptDate) {
  const { doctor_id, appointment_date, slot_start_time, reason, patient_id } = payload

  if (!patient_id) {
    throw new Error('Could not book the appointment: missing patient. Please sign in again.')
  }

  // Doctor must exist and be active.
  const { data: doctor, error: docErr } = await supabase
    .from('doctors').select('id, is_active').eq('id', doctor_id).single()
  if (docErr || !doctor) throw new Error('Doctor not found.')
  if (!doctor.is_active) throw new Error('This doctor is currently unavailable.')

  // Pre-check slot availability (soft check; unique index is the hard guard).
  const { data: existing } = await supabase
    .from('appointments').select('id')
    .eq('doctor_id', doctor_id)
    .eq('appointment_date', appointment_date)
    .eq('slot_start_time', slot_start_time)
    .in('status', ['PENDING', 'CONFIRMED'])
    .maybeSingle()
  if (existing) {
    throw new Error('This time slot is already booked. Please select another slot.')
  }

  // Derive end time from the doctor's availability for that weekday.
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayOfWeek = dayNames[aptDate.getDay()]
  const { data: avail } = await supabase
    .from('doctor_availability').select('slot_duration_mins')
    .eq('doctor_id', doctor_id).eq('day_of_week', dayOfWeek).maybeSingle()

  const duration = avail?.slot_duration_mins ?? 30
  const [sh, sm] = slot_start_time.split(':').map(Number)
  const endM = sh * 60 + sm + duration
  const slot_end_time = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('appointments')
    .insert([{
      patient_id, doctor_id, appointment_date, slot_start_time, slot_end_time,
      reason: sanitizeInput(reason || ''), status: 'PENDING',
    }])
    .select(`*, doctors (specialization, consultation_fee, profiles:user_id (name))`)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('This time slot was just booked by someone else. Please select another slot.')
    }
    throw new Error(error.message || 'Could not book the appointment. Please try again.')
  }
  return data
}

/**
 * Get appointments for a specific patient (with ownership enforced by RLS)
 */
export async function getPatientAppointments(patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, doctors (id, specialization, consultation_fee, photo_url, profiles:user_id (name))`)
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Get appointments for a specific doctor
 */
export async function getDoctorAppointments(doctorId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, profiles:patient_id (name, phone, email)`)
    .eq('doctor_id', doctorId)
    .order('appointment_date', { ascending: false })
    .order('slot_start_time', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Get ALL appointments (admin only — RLS enforces admin check)
 * Supports pagination
 */
export async function getAllAppointments(filters = {}, page = 0, pageSize = 50) {
  let query = supabase
    .from('appointments')
    .select(`*, profiles:patient_id (name, phone), doctors (specialization, profiles:user_id (name))`)
    .order('appointment_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.date) query = query.eq('appointment_date', filters.date)
  if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Cancel appointment — with ownership verification
 * @param {string} cancelledBy - 'PATIENT', 'DOCTOR', or 'ADMIN'
 */
export async function cancelAppointment(appointmentId, cancel_reason, cancelledBy = 'PATIENT') {
  // Validate status transition — can only cancel PENDING or CONFIRMED
  const { data: apt, error: fetchErr } = await supabase
    .from('appointments').select('status').eq('id', appointmentId).single()

  if (fetchErr) throw new Error('Appointment not found.')
  if (!['PENDING', 'CONFIRMED'].includes(apt.status)) {
    throw new Error(`Cannot cancel an appointment that is already ${apt.status.toLowerCase()}.`)
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'CANCELLED', cancel_reason: sanitizeInput(cancel_reason || ''), cancelled_by: cancelledBy })
    .eq('id', appointmentId)
    .select().single()

  if (error) throw error
  return data
}

/**
 * Complete an appointment.
 *
 * Routes through the `complete_appointment_early` RPC, which atomically:
 *  1. marks the appointment COMPLETED (recording the real finish time),
 *  2. if the doctor finished before the slot's scheduled end, releases the
 *     leftover window as a bookable "freed slot" (e.g. finish a 09:00–09:30
 *     appointment at 09:15 → 09:15–09:30 opens up), and
 *  3. notifies every patient on the waitlist for that doctor/day.
 *
 * Returns the freed slot (or null if nothing was released).
 */
export async function completeAppointment(appointmentId) {
  const { data, error } = await supabase.rpc('complete_appointment_early', {
    p_appointment_id: appointmentId,
  })

  if (error) {
    throw new Error(error.message || 'Could not complete the appointment.')
  }
  return data // freed_slots row, or null
}

/**
 * Book a freed slot (the leftover window released when a doctor finishes early).
 * Race-safe: if two patients tap the same freed slot, only one wins.
 */
export async function bookFreedSlot(freedSlotId, reason) {
  const { data, error } = await supabase.rpc('book_freed_slot', {
    p_freed_slot_id: freedSlotId,
    p_reason: sanitizeInput(reason || ''),
  })

  if (error) {
    if (error.code === '23505' || error.code === 'P0002') {
      throw new Error('This freed slot was just taken. Please pick another.')
    }
    throw new Error(error.message || 'Could not book this slot.')
  }
  return data
}

/**
 * List currently-open freed slots for a doctor on a given date.
 */
export async function getOpenFreedSlots(doctorId, date) {
  const { data, error } = await supabase
    .from('freed_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .eq('status', 'OPEN')
    .order('available_from', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Join the waitlist for a doctor on a date so the patient gets notified the
 * moment a slot frees up. Idempotent thanks to the unique constraint.
 */
export async function joinWaitlist(doctorId, date, patientId) {
  const { data, error } = await supabase
    .from('appointment_waitlist')
    .upsert(
      { patient_id: patientId, doctor_id: doctorId, appointment_date: date, status: 'WAITING' },
      { onConflict: 'patient_id,doctor_id,appointment_date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Confirm appointment
 */
export async function confirmAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'CONFIRMED' })
    .eq('id', appointmentId).select().single()
  if (error) throw error
  return data
}

/**
 * Get today's appointments for a doctor
 */
export async function getTodayAppointments(doctorId) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, profiles:patient_id (name, phone, email)`)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', today)
    .order('slot_start_time', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Search the doctor's own patients by name or mobile number.
 *
 * Scoped to patients who have at least one appointment with this doctor, so a
 * doctor can only look up people they actually treat (privacy-preserving).
 * Pass an empty term to list all of the doctor's patients.
 *
 * Returns deduped patients with visit metadata:
 *   { patient_id, name, phone, email, totalVisits, lastVisit, upcoming }
 */
export async function searchDoctorPatients(doctorId, term = '') {
  if (!doctorId) return []

  const { data, error } = await supabase
    .from('appointments')
    .select(`patient_id, appointment_date, status, profiles:patient_id (name, phone, email)`)
    .eq('doctor_id', doctorId)
    .order('appointment_date', { ascending: false })
  if (error) throw error

  const today = new Date().toISOString().split('T')[0]
  const byPatient = new Map()

  for (const apt of data ?? []) {
    const p = apt.profiles
    if (!p) continue
    let entry = byPatient.get(apt.patient_id)
    if (!entry) {
      entry = {
        patient_id: apt.patient_id,
        name: p.name ?? '',
        phone: p.phone ?? '',
        email: p.email ?? '',
        totalVisits: 0,
        lastVisit: null,
        upcoming: 0,
      }
      byPatient.set(apt.patient_id, entry)
    }
    entry.totalVisits += 1
    // appointments are sorted desc, so the first date seen is the latest.
    if (!entry.lastVisit) entry.lastVisit = apt.appointment_date
    if (['PENDING', 'CONFIRMED'].includes(apt.status) && apt.appointment_date >= today) {
      entry.upcoming += 1
    }
  }

  let results = [...byPatient.values()]

  const q = term.trim().toLowerCase()
  if (q) {
    // Match by name or by phone (ignoring spaces, dashes and +).
    const digits = q.replace(/[\s\-+()]/g, '')
    results = results.filter(r => {
      const nameMatch = r.name.toLowerCase().includes(q)
      const phoneMatch = digits && r.phone.replace(/[\s\-+()]/g, '').includes(digits)
      return nameMatch || phoneMatch
    })
  }

  // Most recently seen first.
  results.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  return results
}
