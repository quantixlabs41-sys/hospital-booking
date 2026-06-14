import { supabase } from '../lib/supabase'
import { sanitizeFormData } from '../security/sanitize'

// ─────────────────────────────────────────────
// Profile CRUD
// ─────────────────────────────────────────────

/**
 * Fetch the full profile for a user, including role-specific data
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

/**
 * Update core profile fields (name, phone, bio, avatar_url, date_of_birth, gender)
 */
export async function updateProfile(userId, updates) {
  // Only allow safe fields
  const allowed = ['name', 'phone', 'bio', 'avatar_url', 'date_of_birth', 'gender']
  const safeUpdates = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      safeUpdates[key] = updates[key]
    }
  }

  const sanitizedUpdates = sanitizeFormData(safeUpdates)

  const { data, error } = await supabase
    .from('profiles')
    .update(sanitizedUpdates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}


// ─────────────────────────────────────────────
// Patient Details
// ─────────────────────────────────────────────

/**
 * Get patient-specific details (dob, gender, blood_group, address, emergency_contact)
 */
export async function getPatientDetails(userId) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Upsert patient-specific details
 * Uses upsert because the patients row may not exist yet
 */
export async function updatePatientDetails(userId, details) {
  const payload = sanitizeFormData({
    user_id: userId,
    dob: details.dob || null,
    gender: details.gender || null,
    blood_group: details.blood_group || null,
    address: details.address || null,
    emergency_contact: details.emergency_contact || null
  })

  const { data, error } = await supabase
    .from('patients')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}


// ─────────────────────────────────────────────
// Doctor Details
// ─────────────────────────────────────────────

/**
 * Update doctor-specific professional details
 */
export async function updateDoctorDetails(doctorId, details) {
  const allowed = [
    'specialization', 'qualification', 'experience_years',
    'consultation_fee', 'department_id', 'bio', 'photo_url',
    'languages', 'registration_number', 'availability_status'
  ]
  const safeUpdates = {}
  for (const key of allowed) {
    if (details[key] !== undefined) {
      safeUpdates[key] = details[key]
    }
  }

  const { data, error } = await supabase
    .from('doctors')
    .update(safeUpdates)
    .eq('id', doctorId)
    .select()
    .single()

  if (error) throw error
  return data
}


// ─────────────────────────────────────────────
// Avatar Upload
// ─────────────────────────────────────────────

/**
 * Compress and resize an image file client-side
 * Returns a Blob ready for upload
 */
export function compressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        // Draw circular crop area (for better avatar results)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Failed to compress image'))
            resolve(blob)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Upload avatar to Supabase Storage
 * Compresses the image first, then uploads to avatars/{userId}/{timestamp}.jpg
 * Returns the public URL
 */
export async function uploadAvatar(userId, file) {
  // Compress image client-side
  const compressed = await compressImage(file)

  // Generate unique filename
  const timestamp = Date.now()
  const filePath = `${userId}/${timestamp}.jpg`

  // Delete old avatars for this user (cleanup)
  const { data: existing } = await supabase.storage
    .from('avatars')
    .list(userId)

  if (existing && existing.length > 0) {
    const filesToRemove = existing.map(f => `${userId}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToRemove)
  }

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, compressed, {
      contentType: 'image/jpeg',
      upsert: true
    })

  if (uploadError) throw uploadError

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  const publicUrl = urlData.publicUrl

  // Update profile with avatar URL
  await updateProfile(userId, { avatar_url: publicUrl })

  return publicUrl
}

/**
 * Remove avatar from storage and clear avatar_url in profile
 */
export async function deleteAvatar(userId) {
  // List and remove all files in user's avatar folder
  const { data: existing } = await supabase.storage
    .from('avatars')
    .list(userId)

  if (existing && existing.length > 0) {
    const filesToRemove = existing.map(f => `${userId}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToRemove)
  }

  // Clear avatar_url in profile
  await updateProfile(userId, { avatar_url: null })
}


// ─────────────────────────────────────────────
// Password Change
// ─────────────────────────────────────────────

/**
 * Change the current user's password
 * Uses Supabase Auth updateUser
 */
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })
  if (error) throw error
}


// ─────────────────────────────────────────────
// Account Management
// ─────────────────────────────────────────────

/**
 * Deactivate the current user's account (soft delete)
 */
export async function deactivateAccount(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)

  if (error) throw error
}

/**
 * Calculate profile completeness percentage
 */
export function calculateCompleteness(profile, patientDetails = null) {
  const fields = [
    profile?.name,
    profile?.phone,
    profile?.avatar_url,
    profile?.bio,
    profile?.date_of_birth,
    profile?.gender
  ]

  if (patientDetails) {
    fields.push(
      patientDetails?.blood_group,
      patientDetails?.address,
      patientDetails?.emergency_contact
    )
  }

  const filled = fields.filter(f => f && f !== '').length
  return Math.round((filled / fields.length) * 100)
}
