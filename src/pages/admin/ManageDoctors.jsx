import { useState, useEffect } from 'react'
import { getDoctors } from '../../services/doctors'
import { getDepartments, deactivateDoctor, activateDoctor } from '../../services/admin'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validateField, validatePhone, getPasswordStrength, RULES } from '../../security/validators'
import { sanitizeFormData, sanitizeName, sanitizePhone, sanitizeEmail } from '../../security/sanitize'

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    specialization: '', qualification: '', experience_years: 0,
    consultation_fee: 0, department_id: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [creating, setCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      // Fetch all doctors (including inactive)
      const { data, error } = await supabase
        .from('doctors')
        .select(`*, profiles:user_id (name, email, phone), departments (name)`)
        .order('id', { ascending: false })
      if (error) throw error
      setDoctors(data ?? [])
      const depts = await getDepartments()
      setDepartments(depts)
    } catch (err) {
      toast.error('Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  function validateForm() {
    const errs = {}

    // Name
    const nameResult = validateField('name', form.name, { required: true })
    if (!nameResult.valid) errs.name = nameResult.message

    // Email
    const emailResult = validateField('email', form.email, { required: true })
    if (!emailResult.valid) errs.email = emailResult.message

    // Phone
    const phoneResult = validatePhone(form.phone, true)
    if (!phoneResult.valid) errs.phone = phoneResult.message

    // Password
    if (!form.password) {
      errs.password = RULES.password.messages.required
    } else if (form.password.length < RULES.password.minLength) {
      errs.password = RULES.password.messages.minLength
    } else if (!RULES.password.pattern.test(form.password)) {
      errs.password = RULES.password.messages.pattern
    }

    // Specialization
    const specResult = validateField('specialization', form.specialization, { required: true })
    if (!specResult.valid) errs.specialization = specResult.message

    // Qualification (optional but validate format)
    if (form.qualification) {
      const qualResult = validateField('qualification', form.qualification)
      if (!qualResult.valid) errs.qualification = qualResult.message
    }

    // Experience
    const expResult = validateField('experienceYears', form.experience_years)
    if (!expResult.valid) errs.experience_years = expResult.message

    // Fee
    const feeResult = validateField('consultationFee', form.consultation_fee)
    if (!feeResult.valid) errs.consultation_fee = feeResult.message

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  function clearError(field) {
    setFormErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setCreating(true)

      const cleanName = sanitizeName(form.name)
      const cleanEmail = sanitizeEmail(form.email)
      const cleanPhone = sanitizePhone(form.phone)

      // Step 1: Store current admin session BEFORE signUp
      const { data: adminSession } = await supabase.auth.getSession()
      const adminAccessToken = adminSession?.session?.access_token
      const adminRefreshToken = adminSession?.session?.refresh_token

      // Step 2: Create doctor auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: { data: { name: cleanName, phone: cleanPhone, role: 'DOCTOR' } }
      })
      if (authError) throw authError

      // Step 3: IMMEDIATELY restore admin session
      if (adminRefreshToken) {
        await supabase.auth.setSession({
          access_token: adminAccessToken,
          refresh_token: adminRefreshToken
        })
      }

      // Step 4: Wait for the trigger to create the profile
      await new Promise(r => setTimeout(r, 1000))

      if (authData?.user) {
        // Step 5: Use the admin RPC function to set role to DOCTOR
        const { error: roleError } = await supabase.rpc('admin_set_user_role', {
          target_user_id: authData.user.id,
          new_role: 'DOCTOR'
        })
        if (roleError) {
          console.error('Role update failed, trying direct update:', roleError)
          const { error: directError } = await supabase
            .from('profiles')
            .update({ role: 'DOCTOR', name: cleanName, phone: cleanPhone })
            .eq('id', authData.user.id)
          if (directError) {
            console.error('Direct update also failed:', directError)
            throw new Error('Account created but role update failed. Please update the role manually in the database.')
          }
        }

        // Step 6: Update profile name/phone
        await supabase
          .from('profiles')
          .update({ name: cleanName, phone: cleanPhone })
          .eq('id', authData.user.id)

        // Step 7: Create doctor record (sanitized)
        const doctorData = sanitizeFormData({
          user_id: authData.user.id,
          specialization: form.specialization,
          qualification: form.qualification,
          experience_years: form.experience_years,
          consultation_fee: form.consultation_fee,
          department_id: form.department_id || null,
          is_active: true
        })
        const { error: docError } = await supabase.from('doctors').insert([doctorData])
        if (docError) throw docError
      }

      toast.success('Doctor account created successfully!')
      setShowModal(false)
      setForm({ name: '', email: '', phone: '', password: '', specialization: '', qualification: '', experience_years: 0, consultation_fee: 0, department_id: '' })
      setFormErrors({})
      loadData()
    } catch (err) {
      console.error('Doctor creation error:', err)
      toast.error(err.message || 'Failed to create doctor')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleStatus(doctor) {
    try {
      if (doctor.is_active) {
        await deactivateDoctor(doctor.id)
        toast.success('Doctor deactivated')
      } else {
        await activateDoctor(doctor.id)
        toast.success('Doctor activated')
      }
      loadData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const filtered = doctors.filter(d => {
    if (!search) return true
    const name = d.profiles?.name?.toLowerCase() ?? ''
    const spec = d.specialization?.toLowerCase() ?? ''
    return name.includes(search.toLowerCase()) || spec.includes(search.toLowerCase())
  })

  const strength = getPasswordStrength(form.password)

  if (loading) return <LoadingSpinner text="Loading doctors..." />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            Manage Doctors
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Add, edit, or deactivate doctor accounts
          </p>
        </div>
        <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-lg" /> Add Doctor
        </button>
      </div>

      {/* Search */}
      <div className="card-custom p-3 mb-4">
        <div className="search-input-wrapper">
          <i className="bi bi-search" />
          <input
            type="text"
            className="form-input-custom"
            placeholder="Search by name or specialization..."
            style={{ paddingLeft: 42 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-custom">
        <div className="table-responsive">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialization</th>
                <th>Experience</th>
                <th>Fee</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {doc.profiles?.name?.charAt(0) ?? 'D'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Dr. {doc.profiles?.name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{doc.profiles?.email ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{doc.specialization}</td>
                  <td>{doc.experience_years ?? 0} yrs</td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{doc.consultation_fee ?? 0}</td>
                  <td>{doc.departments?.name ?? '—'}</td>
                  <td>
                    <span className={doc.is_active ? 'badge-confirmed' : 'badge-cancelled'}>
                      {doc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 12, color: doc.is_active ? 'var(--danger)' : 'var(--success)' }}
                      onClick={() => handleToggleStatus(doc)}
                    >
                      {doc.is_active ? (
                        <><i className="bi bi-x-circle me-1" />Deactivate</>
                      ) : (
                        <><i className="bi bi-check-circle me-1" />Activate</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Doctor Modal */}
      {showModal && (
        <>
          <div className="overlay" onClick={() => setShowModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 'var(--radius-lg)', padding: 32,
            zIndex: 1001, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-person-plus me-2 text-primary" />Add New Doctor
            </h5>
            <form onSubmit={handleCreate} noValidate>
              <div className="row g-3">
                {/* Name */}
                <div className="col-md-6">
                  <label className="form-label-custom">Full Name *</label>
                  <input
                    type="text"
                    className={`form-input-custom ${formErrors.name ? 'error' : ''}`}
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); clearError('name') }}
                    maxLength={100}
                    placeholder="Dr. John Doe"
                  />
                  {formErrors.name && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.name}</span>}
                </div>

                {/* Email */}
                <div className="col-md-6">
                  <label className="form-label-custom">Email *</label>
                  <input
                    type="email"
                    className={`form-input-custom ${formErrors.email ? 'error' : ''}`}
                    value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); clearError('email') }}
                    maxLength={254}
                    placeholder="doctor@example.com"
                  />
                  {formErrors.email && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.email}</span>}
                </div>

                {/* Phone */}
                <div className="col-md-6">
                  <label className="form-label-custom">Phone *</label>
                  <input
                    type="tel"
                    className={`form-input-custom ${formErrors.phone ? 'error' : ''}`}
                    value={form.phone}
                    onChange={e => { setForm({ ...form, phone: e.target.value }); clearError('phone') }}
                    maxLength={15}
                    placeholder="+91 98765 43210"
                  />
                  {formErrors.phone && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.phone}</span>}
                </div>

                {/* Password */}
                <div className="col-md-6">
                  <label className="form-label-custom">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`form-input-custom ${formErrors.password ? 'error' : ''}`}
                      value={form.password}
                      onChange={e => { setForm({ ...form, password: e.target.value }); clearError('password') }}
                      maxLength={128}
                      placeholder="Strong password"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                  {formErrors.password && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.password}</span>}
                  {form.password && (
                    <div className="mt-1">
                      <div className="password-strength-meter">
                        <div className="password-strength-fill" style={{ width: `${(strength.level / 5) * 100}%`, background: strength.color }} />
                      </div>
                      <span className="password-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                  )}
                </div>

                {/* Specialization */}
                <div className="col-md-6">
                  <label className="form-label-custom">Specialization *</label>
                  <input
                    type="text"
                    className={`form-input-custom ${formErrors.specialization ? 'error' : ''}`}
                    value={form.specialization}
                    onChange={e => { setForm({ ...form, specialization: e.target.value }); clearError('specialization') }}
                    maxLength={100}
                    placeholder="e.g. Cardiology"
                  />
                  {formErrors.specialization && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.specialization}</span>}
                </div>

                {/* Qualification */}
                <div className="col-md-6">
                  <label className="form-label-custom">Qualification</label>
                  <input
                    type="text"
                    className={`form-input-custom ${formErrors.qualification ? 'error' : ''}`}
                    value={form.qualification}
                    onChange={e => { setForm({ ...form, qualification: e.target.value }); clearError('qualification') }}
                    maxLength={200}
                    placeholder="e.g. MBBS, MD"
                  />
                  {formErrors.qualification && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.qualification}</span>}
                </div>

                {/* Experience */}
                <div className="col-md-4">
                  <label className="form-label-custom">Experience (yrs)</label>
                  <input
                    type="number"
                    className={`form-input-custom ${formErrors.experience_years ? 'error' : ''}`}
                    min={0}
                    max={70}
                    value={form.experience_years}
                    onChange={e => { setForm({ ...form, experience_years: parseInt(e.target.value) || 0 }); clearError('experience_years') }}
                  />
                  {formErrors.experience_years && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.experience_years}</span>}
                </div>

                {/* Fee */}
                <div className="col-md-4">
                  <label className="form-label-custom">Fee (₹)</label>
                  <input
                    type="number"
                    className={`form-input-custom ${formErrors.consultation_fee ? 'error' : ''}`}
                    min={0}
                    max={100000}
                    value={form.consultation_fee}
                    onChange={e => { setForm({ ...form, consultation_fee: parseFloat(e.target.value) || 0 }); clearError('consultation_fee') }}
                  />
                  {formErrors.consultation_fee && <span className="form-error"><i className="bi bi-exclamation-circle" />{formErrors.consultation_fee}</span>}
                </div>

                {/* Department */}
                <div className="col-md-4">
                  <label className="form-label-custom">Department</label>
                  <select className="form-input-custom" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="d-flex gap-3 mt-4">
                <button type="button" className="btn-ghost flex-fill" onClick={() => { setShowModal(false); setFormErrors({}) }}>Cancel</button>
                <button type="submit" className="btn-primary-custom flex-fill justify-content-center" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
