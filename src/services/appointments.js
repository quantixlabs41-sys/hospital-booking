import { supabase } from '../lib/supabase'
import { sanitizeFormData, sanitizeInput } from '../security/sanitize'

/**
 * Book an appointment with double-booking prevention and date validation
 */
export async function bookAppointment(payload) {
  const { doctor_id, appointment_date, slot_start_time, reason, patient_id } = payload

  // ── Validation: No past dates ──
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const aptDate = new Date(appointment_date + 'T00:00:00')
  if (aptDate < today) {
    throw new Error('Cannot book appointments in the past.')
  }

  // ── Validation: Doctor must be active ──
  const { data: doctor, error: docErr } = await supabase
    .from('doctors').select('id, is_active').eq('id', doctor_id).single()
  if (docErr || !doctor) throw new Error('Doctor not found.')
  if (!doctor.is_active) throw new Error('This doctor is currently unavailable.')

  // ── Validation: Check slot availability before insert ──
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

  // ── Calculate end time from availability ──
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayOfWeek = dayNames[aptDate.getDay()]

  const { data: avail } = await supabase
    .from('doctor_availability').select('slot_duration_mins')
    .eq('doctor_id', doctor_id).eq('day_of_week', dayOfWeek).single()

  const duration = avail?.slot_duration_mins ?? 30
  const [sh, sm] = slot_start_time.split(':').map(Number)
  const endM = sh * 60 + sm + duration
  const slot_end_time = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`

  // ── Insert with conflict handling ──
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ patient_id, doctor_id, appointment_date, slot_start_time, slot_end_time, reason: sanitizeInput(reason || ''), status: 'PENDING' }])
    .select(`*, doctors (specialization, consultation_fee, profiles:user_id (name))`)
    .single()

  if (error) {
    // Catch unique constraint violation (race condition fallback)
    if (error.code === '23505') {
      throw new Error('This time slot was just booked by someone else. Please select another slot.')
    }
    throw error
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
 * Complete appointment — only callable with doctor context (RLS enforces)
 */
export async function completeAppointment(appointmentId, doctorId) {
  // Validate status transition
  const { data: apt, error: fetchErr } = await supabase
    .from('appointments').select('status, doctor_id').eq('id', appointmentId).single()

  if (fetchErr) throw new Error('Appointment not found.')
  if (apt.status === 'COMPLETED') throw new Error('Appointment is already completed.')
  if (apt.status === 'CANCELLED') throw new Error('Cannot complete a cancelled appointment.')

  // Ownership check — only the assigned doctor can complete
  if (doctorId && apt.doctor_id !== doctorId) {
    throw new Error('You can only complete your own appointments.')
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'COMPLETED' })
    .eq('id', appointmentId)
    .select().single()

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
