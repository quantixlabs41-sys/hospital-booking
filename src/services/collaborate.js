import { supabase, createIsolatedClient } from '../lib/supabase'
import { sanitizeSearchTerm } from '../security/sanitize'

// ─────────────────────────────────────────────
// File Validation Constants
// ─────────────────────────────────────────────

export const FILE_CONSTRAINTS = {
  document: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxSizeLabel: '5MB',
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    label: 'PDF, JPG, PNG, WebP',
  },
  photo: {
    maxSize: 2 * 1024 * 1024, // 2MB
    maxSizeLabel: '2MB',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    label: 'JPG, PNG, WebP',
    minWidth: 200,
    minHeight: 200,
  },
}

/**
 * Validate a file against size and type constraints.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file, type = 'document') {
  const constraints = FILE_CONSTRAINTS[type]
  if (!constraints) return { valid: false, error: 'Unknown file type' }

  if (!file) return { valid: false, error: 'No file selected' }

  if (file.size > constraints.maxSize) {
    return { valid: false, error: `File size must be under ${constraints.maxSizeLabel}. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` }
  }

  if (!constraints.allowedTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file format. Allowed: ${constraints.label}` }
  }

  return { valid: true }
}

/**
 * Validate image dimensions (returns a Promise).
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export function validateImageDimensions(file, minWidth = 200, minHeight = 200) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'Not an image file' })
      return
    }
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      if (img.width < minWidth || img.height < minHeight) {
        resolve({ valid: false, error: `Image must be at least ${minWidth}×${minHeight}px. Your image is ${img.width}×${img.height}px.` })
      } else {
        resolve({ valid: true })
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve({ valid: false, error: 'Could not read image file' })
    }
    img.src = URL.createObjectURL(file)
  })
}

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
      photo_url: formData.photo_url || null,
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
  // Validate file before upload
  const validation = validateFile(file, 'document')
  if (!validation.valid) throw new Error(validation.error)

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

/**
 * Upload applicant photo to Supabase storage.
 * Returns the storage path of the uploaded photo.
 */
export async function uploadApplicationPhoto(file, applicationEmail) {
  // Validate file type and size
  const validation = validateFile(file, 'photo')
  if (!validation.valid) throw new Error(validation.error)

  // Validate image dimensions
  const dimValidation = await validateImageDimensions(
    file,
    FILE_CONSTRAINTS.photo.minWidth,
    FILE_CONSTRAINTS.photo.minHeight
  )
  if (!dimValidation.valid) throw new Error(dimValidation.error)

  const timestamp = Date.now()
  const safeEmail = applicationEmail.replace(/[^a-zA-Z0-9]/g, '_')
  const ext = file.name.split('.').pop()
  const path = `${safeEmail}/${timestamp}_photo.${ext}`

  const { error } = await supabase.storage
    .from('collaborate-photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error
  return path
}

/**
 * Get the public URL of an uploaded photo.
 */
export function getPhotoPublicUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from('collaborate-photos').getPublicUrl(path)
  return data?.publicUrl || null
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
    // Sanitize to strip PostgREST filter/LIKE control characters (injection-safe).
    const term = sanitizeSearchTerm(filters.search)
    if (term) {
      query = query.or(`applicant_name.ilike.%${term}%,applicant_email.ilike.%${term}%,hospital_name.ilike.%${term}%`)
    }
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

  const role = application.application_type === 'HOSPITAL' ? 'HOSPITAL' : 'DOCTOR'

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

  // 4. Wait for the database trigger to create the profile row. Poll instead
  //    of a fixed sleep so we proceed as soon as it exists (and fail loudly
  //    if it never does, rather than silently continuing on a missing row).
  const userId = authData?.user?.id
  if (!userId) throw new Error('User creation failed — no user ID returned')

  let profileReady = false
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: prof } = await supabase
      .from('profiles').select('id').eq('id', userId).maybeSingle()
    if (prof) { profileReady = true; break }
    await new Promise(r => setTimeout(r, 500))
  }
  if (!profileReady) {
    throw new Error('Account was created but its profile was not provisioned in time. Please retry the approval.')
  }

  // 5. Set the correct role + profile details. Prefer the SECURITY DEFINER RPC;
  //    also apply a direct update so name/phone are set in one pass.
  const { error: roleError } = await supabase.rpc('admin_set_user_role', {
    target_user_id: userId,
    new_role: role
  })
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role, name: application.applicant_name, phone: application.applicant_phone })
    .eq('id', userId)
  if (roleError && profileError) {
    console.error('Role/profile update failed:', roleError, profileError)
    throw new Error('Account created but its role could not be set. Please retry the approval.')
  }

  // 6. Create the role-specific record
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
  } else if (application.application_type === 'HOSPITAL') {
    // Create the first-class hospital record linked to the new user
    const { error: hospError } = await supabase.from('hospitals').insert([{
      owner_user_id: userId,
      name: application.hospital_name || application.applicant_name,
      type: application.hospital_type || null,
      registration_number: application.registration_number || null,
      bed_count: application.bed_count || null,
      address: application.hospital_address || null,
      city: application.hospital_city || null,
      state: application.hospital_state || null,
      pincode: application.hospital_pincode || null,
      email: application.applicant_email || null,
      phone: application.applicant_phone || null,
      summary_text: application.bio || null,
      is_active: true,
      is_verified: true
    }])
    if (hospError) throw hospError
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

// ─────────────────────────────────────────────
// Public — Application Status Lookup
// ─────────────────────────────────────────────

/**
 * Look up an application by email and application ID.
 * Public access — used on the status page.
 */
export async function getApplicationByEmailAndId(email, applicationId) {
  const { data, error } = await supabase
    .from('collaboration_applications')
    .select(`*, departments (name)`)
    .eq('id', applicationId)
    .eq('applicant_email', email.toLowerCase().trim())
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Generate a signed download URL for an uploaded document.
 * Returns a temporary URL (valid for 60 minutes).
 *
 * NOTE: This direct-signing path requires storage read access and is used
 * by ADMINS (who have the collab_docs_admin_read policy). Anonymous
 * applicants must use getApplicantDocumentUrl() instead.
 */
export async function getDocumentDownloadUrl(documentPath) {
  if (!documentPath) return null

  const { data, error } = await supabase.storage
    .from('collaborate-docs')
    .createSignedUrl(documentPath, 3600) // 1 hour expiry

  if (error) {
    console.error('Error generating signed URL:', error)
    return null
  }
  return data?.signedUrl || null
}

/**
 * Securely fetch a signed document URL for an applicant on the public
 * status page. Ownership is verified server-side (email + application ID
 * must match) by the 'collab-document' edge function, which signs the URL
 * with the service role. The bucket stays private and admin-only at the
 * RLS level.
 *
 * @param {string} email - Applicant email used in the status lookup
 * @param {number} applicationId - Application ID
 * @returns {Promise<string|null>} Signed URL or null
 */
export async function getApplicantDocumentUrl(email, applicationId) {
  try {
    const { data, error } = await supabase.functions.invoke('collab-document', {
      body: { email, applicationId }
    })
    if (error) {
      console.error('Document access error:', error)
      return null
    }
    return data?.url || null
  } catch (err) {
    console.error('Document access error:', err)
    return null
  }
}
