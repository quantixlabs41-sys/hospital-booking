import { supabase, createIsolatedClient } from '../lib/supabase'

// ─────────────────────────────────────────────
// Public — Submit Application (no auth required)
// ─────────────────────────────────────────────

/**
 * Submit a new collaboration application.
 * Can be called without authentication (public form).
 */
export async function submitApplication(formData) {
  const { data, error } = await supabase
    .from('collaboration_applications')
    .insert([{
      application_type: formData.application_type,
      applicant_name: formData.applicant_name,
      applicant_email: formData.applicant_email,
      applicant_phone: formData.applicant_phone,
      specialization: formData.specialization || null,
      qualification: formData.qualification || null,
      experience_years: formData.experience_years || null,
      consultation_fee: formData.consultation_fee || null,
      registration_number: formData.registration_number || null,
      department_id: formData.department_id || null,
      bio: formData.bio || null,
      documents_url: formData.documents_url || null,
      hospital_name: formData.hospital_name || null,
      hospital_address: formData.hospital_address || null,
      hospital_city: formData.hospital_city || null,
      hospital_state: formData.hospital_state || null,
      hospital_pincode: formData.hospital_pincode || null,
      hospital_type: formData.hospital_type || null,
      bed_count: formData.bed_count || null,
      status: 'PENDING'
    }])
    .select()
    .single()

  if (error) {
    // Handle RLS policy violation specifically
    if (error.code === '42501' || error.message?.includes('row-level security')) {
      console.error('RLS Policy Error: The collaboration_applications table INSERT policy may not be configured correctly. Run fix_collaboration_rls.sql in the Supabase SQL Editor.')
      throw new Error('Unable to submit application due to a database configuration issue. Please contact the administrator.')
    }
    throw error
  }
  return data
}

/**
 * Check if an email already has an active application or registered account.
 */
export async function checkEmailExists(email) {
  // Check profiles table for existing accounts
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (profileData) {
    return { exists: true, reason: 'An account with this email already exists.' }
  }

  // Check for active (non-rejected) applications
  const { data: appData } = await supabase
    .from('collaboration_applications')
    .select('id, status')
    .eq('applicant_email', email.toLowerCase().trim())
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .maybeSingle()

  if (appData) {
    return { exists: true, reason: `An application with this email is already ${appData.status.toLowerCase().replace('_', ' ')}.` }
  }

  return { exists: false }
}

/**
 * Upload application documents to Supabase storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadApplicationDocument(file, applicationEmail) {
  const timestamp = Date.now()
  const safeEmail = applicationEmail.replace(/[^a-zA-Z0-9]/g, '_')
  const ext = file.name.split('.').pop()
  const path = `${safeEmail}/${timestamp}_document.${ext}`

  const { error } = await supabase.storage
    .from('collaborate-docs')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error
  return path
}


// ─────────────────────────────────────────────
// Admin — Application Management
// ─────────────────────────────────────────────

/**
 * Get all applications with optional filters.
 * Admin-only (protected by RLS).
 */
export async function getApplications(filters = {}) {
  let query = supabase
    .from('collaboration_applications')
    .select(`*, departments (name)`)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.application_type) query = query.eq('application_type', filters.application_type)
  if (filters.search) {
    query = query.or(`applicant_name.ilike.%${filters.search}%,applicant_email.ilike.%${filters.search}%,hospital_name.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Get a single application by ID.
 */
export async function getApplicationById(id) {
  const { data, error } = await supabase
    .from('collaboration_applications')
    .select(`*, departments (name)`)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Update application status (e.g., move to UNDER_REVIEW).
 */
export async function updateApplicationStatus(id, status, adminId, adminNotes = '') {
  const updates = {
    status,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString()
  }
  if (adminNotes) updates.admin_notes = adminNotes

  const { data, error } = await supabase
    .from('collaboration_applications')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Approve an application and create the user account.
 * This creates an auth user + profile + doctor record.
 *
 * @param {number} id - Application ID
 * @param {string} password - Password set by admin
 * @param {string} adminId - Admin user ID
 */
export async function approveApplication(id, password, adminId) {
  // 1. Fetch the application
  const application = await getApplicationById(id)
  if (!application) throw new Error('Application not found')
  if (application.status === 'APPROVED') throw new Error('Application already approved')

  const role = application.application_type === 'DOCTOR' ? 'DOCTOR' : 'DOCTOR' // Hospitals get DOCTOR role for now

  // 2. Create an ISOLATED Supabase client for signUp.
  //    This client does NOT persist sessions and does NOT trigger
  //    the main app's onAuthStateChange listener, so the admin
  //    stays logged in throughout the entire process.
  const isolatedClient = createIsolatedClient()

  const { data: authData, error: authError } = await isolatedClient.auth.signUp({
    email: application.applicant_email,
    password,
    options: {
      data: {
        name: application.applicant_name,
        phone: application.applicant_phone,
        role
      }
    }
  })
  if (authError) throw authError

  // 3. Immediately sign out of the isolated client to clean up
  //    (this does NOT affect the main admin session)
  await isolatedClient.auth.signOut()

  // 4. Wait for the database trigger to create the profile row
  await new Promise(r => setTimeout(r, 1200))

  const userId = authData?.user?.id
  if (!userId) throw new Error('User creation failed — no user ID returned')

  // 5. Update profile with correct role and details (using main admin client)
  const { error: roleError } = await supabase.rpc('admin_set_user_role', {
    target_user_id: userId,
    new_role: role
  })
  if (roleError) {
    // Fallback: direct update
    const { error: directError } = await supabase
      .from('profiles')
      .update({ role, name: application.applicant_name, phone: application.applicant_phone })
      .eq('id', userId)
    if (directError) {
      console.error('Role update fallback failed:', directError)
    }
  }

  // 6. Update profile name/phone
  await supabase
    .from('profiles')
    .update({ name: application.applicant_name, phone: application.applicant_phone })
    .eq('id', userId)

  // 7. Create doctor record if application_type is DOCTOR
  if (application.application_type === 'DOCTOR') {
    const { error: docError } = await supabase.from('doctors').insert([{
      user_id: userId,
      specialization: application.specialization || 'General',
      qualification: application.qualification || null,
      experience_years: application.experience_years || 0,
      consultation_fee: application.consultation_fee || 0,
      department_id: application.department_id || null,
      bio: application.bio || null,
      registration_number: application.registration_number || null,
      is_active: true
    }])
    if (docError) throw docError
  }

  // 8. Mark application as APPROVED
  const { data: updatedApp, error: updateError } = await supabase
    .from('collaboration_applications')
    .update({
      status: 'APPROVED',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      created_user_id: userId
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) throw updateError

  return { application: updatedApp, userId, email: application.applicant_email }
}

/**
 * Reject an application with a reason.
 */
export async function rejectApplication(id, reason, adminId) {
  const { data, error } = await supabase
    .from('collaboration_applications')
    .update({
      status: 'REJECTED',
      rejection_reason: reason,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get application counts by status for dashboard/badges.
 */
export async function getApplicationStats() {
  const { data, error } = await supabase
    .from('collaboration_applications')
    .select('status')

  if (error) throw error

  const stats = {
    total: data?.length ?? 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0
  }

  for (const row of (data ?? [])) {
    switch (row.status) {
      case 'PENDING': stats.pending++; break
      case 'UNDER_REVIEW': stats.under_review++; break
      case 'APPROVED': stats.approved++; break
      case 'REJECTED': stats.rejected++; break
    }
  }

  return stats
}
