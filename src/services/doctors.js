import { supabase } from '../lib/supabase'
import { sanitizeFormData, sanitizeInput, sanitizeSearchTerm } from '../security/sanitize'

// Only non-sensitive, display-safe columns are exposed to the public
// doctor directory/search. Contact details (email/phone) are intentionally
// excluded so they can't be scraped from the public search.
const PUBLIC_DOCTOR_SELECT =
  `id, specialization, qualification, experience_years, consultation_fee, photo_url, availability_status, department_id, profiles:user_id (name), departments (name, code)`

export async function getDoctors(filters = {}) {
  let query = supabase
    .from('doctors')
    .select(PUBLIC_DOCTOR_SELECT)
    .eq('is_active', true)

  if (filters.specialization) query = query.ilike('specialization', `%${sanitizeInput(filters.specialization)}%`)
  if (filters.department_id) query = query.eq('department_id', filters.department_id)

  const { data, error } = await query.order('experience_years', { ascending: false })
  if (error) throw error

  let results = data ?? []

  // Free-text search: match doctor name OR specialization OR department.
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search).toLowerCase()
    if (term) {
      results = results.filter(d =>
        d.profiles?.name?.toLowerCase().includes(term) ||
        d.specialization?.toLowerCase().includes(term) ||
        d.departments?.name?.toLowerCase().includes(term)
      )
    }
  }

  // Filter strictly by doctor name when provided.
  if (filters.name) {
    const nameTerm = sanitizeSearchTerm(filters.name).toLowerCase()
    results = results.filter(d => d.profiles?.name?.toLowerCase().includes(nameTerm))
  }

  return results
}

export async function getDoctorById(id) {
  const { data, error } = await supabase
    .from('doctors')
    .select(`*, profiles:user_id (name, email, phone), departments (name, code), doctor_hospitals (*)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getDoctorAvailability(doctorId) {
  const { data, error } = await supabase
    .from('doctor_availability').select('*').eq('doctor_id', doctorId)
  if (error) throw error
  return data ?? []
}

/**
 * Set doctor availability using UPSERT instead of destructive delete-all + insert.
 * This prevents data loss if the insert step fails.
 */
export async function setDoctorAvailability(doctorId, slots) {
  // First, deactivate all existing slots for this doctor
  await supabase
    .from('doctor_availability')
    .update({ is_active: false })
    .eq('doctor_id', doctorId)

  if (!slots.length) return []

  // Upsert the new slots (uses the unique constraint on doctor_id + day_of_week)
  const rows = slots.map(s => ({
    ...s,
    doctor_id: doctorId,
    is_active: true
  }))

  const { data, error } = await supabase
    .from('doctor_availability')
    .upsert(rows, { onConflict: 'doctor_id,day_of_week' })
    .select()

  if (error) throw error
  return data
}

export async function getAvailableSlots(doctorId, date) {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  // Use timezone-safe date parsing
  const aptDate = new Date(date + 'T00:00:00')
  const dayOfWeek = dayNames[aptDate.getDay()]

  const { data: avail } = await supabase
    .from('doctor_availability').select('*')
    .eq('doctor_id', doctorId).eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!avail) return []

  const { data: booked } = await supabase
    .from('appointments').select('slot_start_time')
    .eq('doctor_id', doctorId).eq('appointment_date', date)
    .in('status', ['PENDING', 'CONFIRMED'])

  const bookedTimes = new Set((booked ?? []).map(b => b.slot_start_time.substring(0, 5)))

  // If the requested date is today, any slot whose start time has already
  // passed must not be bookable. Compare in local time against "now".
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = date === todayStr
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const slots = []
  let [sh, sm] = avail.start_time.split(':').map(Number)
  const [eh, em] = avail.end_time.split(':').map(Number)
  const endMins = eh * 60 + em
  const duration = avail.slot_duration_mins ?? 30

  while (sh * 60 + sm + duration <= endMins) {
    const startMins = sh * 60 + sm
    const startStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
    const endM = startMins + duration
    const endStr = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    // Skip slots that have already started (or are starting now) for today.
    if (!(isToday && startMins <= nowMins)) {
      slots.push({ start: startStr, end: endStr, booked: bookedTimes.has(startStr) })
    }
    sm += duration
    sh += Math.floor(sm / 60)
    sm %= 60
  }
  return slots
}

export async function updateDoctorProfile(doctorId, updates) {
  const sanitizedUpdates = sanitizeFormData(updates)
  const { data, error } = await supabase
    .from('doctors').update(sanitizedUpdates).eq('id', doctorId).select().single()
  if (error) throw error
  return data
}

export async function getDoctorByUserId(userId) {
  const { data, error } = await supabase
    .from('doctors').select(`*, profiles:user_id (name, email, phone), departments (name, code), doctor_hospitals (*)`)
    .eq('user_id', userId).single()
  if (error) throw error
  return data
}
