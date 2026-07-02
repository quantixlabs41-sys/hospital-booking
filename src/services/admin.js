import { supabase } from '../lib/supabase'
import { sanitizeSearchTerm } from '../security/sanitize'

export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0]

  const [doctorsRes, patientsRes, appointmentsRes, todayRes] = await Promise.all([
    supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'PATIENT'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today)
  ])

  return {
    totalDoctors: doctorsRes.count ?? 0,
    totalPatients: patientsRes.count ?? 0,
    totalAppointments: appointmentsRes.count ?? 0,
    todayAppointments: todayRes.count ?? 0
  }
}

export async function getAllPatients() {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('role', 'PATIENT').order('name')
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────
// User Management (Account Closures)
// ─────────────────────────────────────────────

/**
 * List user accounts for the admin Users panel.
 * @param {Object} filters - { role, status: 'ALL'|'ACTIVE'|'CLOSED', search }
 */
export async function getAllUsers(filters = {}) {
  let query = supabase
    .from('profiles')
    .select('id, name, email, role, is_active, closed_at, closure_reason, created_at')
    .order('created_at', { ascending: false })

  if (filters.role) query = query.eq('role', filters.role)
  if (filters.status === 'ACTIVE') query = query.eq('is_active', true)
  if (filters.status === 'CLOSED') query = query.eq('is_active', false)
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search)
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Counts for the admin Users panel header.
 */
export async function getUserStats() {
  const [totalRes, closedRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', false),
  ])
  const total = totalRes.count ?? 0
  const closed = closedRes.count ?? 0
  return { total, closed, active: total - closed }
}

/**
 * Reopen (reactivate) a closed account without data loss.
 * Calls the admin-only SECURITY DEFINER RPC.
 */
export async function reopenAccount(targetUserId) {
  const { error } = await supabase.rpc('admin_reopen_account', { target_user_id: targetUserId })
  if (error) throw error
}

/**
 * Admin-assisted MFA reset: removes all of a user's MFA factors (via the
 * admin-mfa-reset edge function, which enforces admin authorization + audits).
 */
export async function adminResetUserMfa(targetUserId) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  const { data, error } = await supabase.functions.invoke('admin-mfa-reset', {
    body: { targetUserId },
    headers,
  })
  if (error) {
    const msg = (await error?.context?.json?.().catch(() => null))?.error
    throw new Error(msg || error.message || 'Could not reset MFA.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function createDoctorAccount({ email, password, name, phone, specialization, qualification, experience_years, consultation_fee, department_id }) {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { name, phone, role: 'DOCTOR' }
  })
  if (authError) {
    // Fallback: use signUp if admin API not available
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, phone, role: 'DOCTOR' } }
    })
    if (signUpError) throw signUpError
    return signUpData
  }

  // 2. Create doctor profile record
  const userId = authData.user.id
  const { error: docError } = await supabase.from('doctors').insert([{
    user_id: userId, specialization, qualification,
    experience_years: experience_years ?? 0,
    consultation_fee: consultation_fee ?? 0,
    department_id: department_id || null,
    is_active: true
  }])
  if (docError) throw docError

  return authData
}

export async function deactivateDoctor(doctorId) {
  const { data, error } = await supabase
    .from('doctors').update({ is_active: false }).eq('id', doctorId).select().single()
  if (error) throw error
  return data
}

export async function activateDoctor(doctorId) {
  const { data, error } = await supabase
    .from('doctors').update({ is_active: true }).eq('id', doctorId).select().single()
  if (error) throw error
  return data
}

export async function updateDepartment(id, updates) {
  const { data, error } = await supabase
    .from('departments').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function createDepartment({ name, code }) {
  const { data, error } = await supabase
    .from('departments').insert([{ name, code }]).select().single()
  if (error) throw error
  return data
}

export async function getAppointmentReport(filters = {}) {
  let query = supabase
    .from('appointments')
    .select(`*, profiles:patient_id (name, phone, email), doctors (specialization, profiles:user_id (name))`)
    .order('appointment_date', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from_date) query = query.gte('appointment_date', filters.from_date)
  if (filters.to_date) query = query.lte('appointment_date', filters.to_date)
  if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getWeeklyAppointmentTrend() {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const { data, error } = await supabase
    .from('appointments').select('appointment_date, status')
    .gte('appointment_date', dates[0])
    .lte('appointment_date', dates[6])

  if (error) throw error

  const trend = dates.map(date => ({
    date,
    total: (data ?? []).filter(a => a.appointment_date === date).length,
    completed: (data ?? []).filter(a => a.appointment_date === date && a.status === 'COMPLETED').length,
    cancelled: (data ?? []).filter(a => a.appointment_date === date && a.status === 'CANCELLED').length
  }))

  return trend
}

// ─────────────────────────────────────────────
// Reports & Analytics (admin-only, server-aggregated)
// ─────────────────────────────────────────────

/**
 * Full analytics payload for a date range, computed server-side by the
 * admin-only `admin_report_overview` RPC (aggregates only — no patient PII).
 * @param {string} from - ISO date (YYYY-MM-DD)
 * @param {string} to   - ISO date (YYYY-MM-DD)
 */
export async function getReportOverview(from, to) {
  const { data, error } = await supabase.rpc('admin_report_overview', {
    p_from: from,
    p_to: to,
  })
  if (error) throw new Error(error.message || 'Could not load the report.')
  return data
}

/**
 * Active hospitals that have map coordinates, for the report map.
 * Returns [{ id, name, city, latitude, longitude }].
 */
export async function getHospitalGeoPoints() {
  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name, city, latitude, longitude')
    .eq('is_active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
  if (error) throw error
  return (data ?? []).filter(h => h.latitude != null && h.longitude != null)
}
