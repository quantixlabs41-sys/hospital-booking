import { useState, useEffect } from 'react'
import { getDoctorByUserId, updateDoctorProfile } from '../../services/doctors'
import { getDepartments } from '../../services/admin'
import { getProfile, updateProfile, uploadAvatar, deleteAvatar } from '../../services/profiles'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import AvatarUpload from '../../components/AvatarUpload'
import PasswordChange from '../../components/PasswordChange'
import ProfileTabs from '../../components/ProfileTabs'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validateField, validatePhone, RULES } from '../../security/validators'

export default function DoctorProfileEdit() {
  const { user, profile: authProfile, refreshProfile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  // Personal info
  const [personalForm, setPersonalForm] = useState({
    name: '', phone: '', bio: '', avatar_url: null
  })

  // Professional info
  const [profForm, setProfForm] = useState({
    specialization: '', qualification: '', experience_years: 0,
    consultation_fee: 0, department_id: '', registration_number: '',
    languages: [], availability_status: 'AVAILABLE'
  })

  // Languages input
  const [langInput, setLangInput] = useState('')

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    try {
      setLoading(true)
      const [doc, profile, depts] = await Promise.all([
        getDoctorByUserId(user.id),
        getProfile(user.id),
        getDepartments()
      ])

      setDoctor(doc)
      setDepartments(depts)

      setPersonalForm({
        name: profile.name || '',
        phone: profile.phone || '',
        bio: profile.bio || doc?.bio || '',
        avatar_url: profile.avatar_url || null
      })

      if (doc) {
        setProfForm({
          specialization: doc.specialization || '',
          qualification: doc.qualification || '',
          experience_years: doc.experience_years ?? 0,
          consultation_fee: doc.consultation_fee ?? 0,
          department_id: doc.department_id || '',
          registration_number: doc.registration_number || '',
          languages: doc.languages || [],
          availability_status: doc.availability_status || 'AVAILABLE'
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePersonal(e) {
    e.preventDefault()
    const errs = {}
    const nameResult = validateField('name', personalForm.name, { required: true })
    if (!nameResult.valid) errs.name = nameResult.message
    const phoneResult = validatePhone(personalForm.phone)
    if (!phoneResult.valid) errs.phone = phoneResult.message
    const bioResult = validateField('bio', personalForm.bio)
    if (!bioResult.valid) errs.bio = bioResult.message
    if (Object.keys(errs).length > 0) {
      Object.values(errs).forEach(msg => toast.error(msg))
      return
    }
    try {
      setSaving(true)
      await updateProfile(user.id, {
        name: personalForm.name.trim(),
        phone: personalForm.phone.trim(),
        bio: personalForm.bio.trim()
      })
      await refreshProfile()
      toast.success('Personal information saved!')
    } catch (err) {
      toast.error('Failed to save personal info')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProfessional(e) {
    e.preventDefault()
    if (!doctor) return
    const errs = {}
    const specResult = validateField('specialization', profForm.specialization, { required: true })
    if (!specResult.valid) errs.specialization = specResult.message
    if (profForm.qualification) {
      const qualResult = validateField('qualification', profForm.qualification)
      if (!qualResult.valid) errs.qualification = qualResult.message
    }
    if (profForm.registration_number) {
      const regResult = validateField('registrationNumber', profForm.registration_number)
      if (!regResult.valid) errs.registration_number = regResult.message
    }
    const expResult = validateField('experienceYears', profForm.experience_years)
    if (!expResult.valid) errs.experience_years = expResult.message
    const feeResult = validateField('consultationFee', profForm.consultation_fee)
    if (!feeResult.valid) errs.consultation_fee = feeResult.message
    if (Object.keys(errs).length > 0) {
      Object.values(errs).forEach(msg => toast.error(msg))
      return
    }
    try {
      setSaving(true)
      await updateDoctorProfile(doctor.id, {
        specialization: profForm.specialization,
        qualification: profForm.qualification,
        experience_years: profForm.experience_years,
        consultation_fee: profForm.consultation_fee,
        department_id: profForm.department_id || null,
        registration_number: profForm.registration_number || null,
        languages: profForm.languages.length > 0 ? profForm.languages : null,
        availability_status: profForm.availability_status
      })
      toast.success('Professional details saved!')
    } catch (err) {
      toast.error('Failed to save professional details')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(file) {
    try {
      setUploading(true)
      const url = await uploadAvatar(user.id, file)
      setPersonalForm(prev => ({ ...prev, avatar_url: url }))
      await refreshProfile()
      toast.success('Photo updated!')
    } catch (err) {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  async function handleAvatarRemove() {
    try {
      setUploading(true)
      await deleteAvatar(user.id)
      setPersonalForm(prev => ({ ...prev, avatar_url: null }))
      await refreshProfile()
      toast.success('Photo removed')
    } catch (err) {
      toast.error('Failed to remove photo')
    } finally {
      setUploading(false)
    }
  }

  function addLanguage() {
    const lang = langInput.trim()
    if (!lang) return
    // Validate language name
    const langResult = validateField('language', lang)
    if (!langResult.valid) {
      toast.error(langResult.message)
      return
    }
    if (profForm.languages.includes(lang)) {
      toast.error('Language already added')
      return
    }
    setProfForm(prev => ({ ...prev, languages: [...prev.languages, lang] }))
    setLangInput('')
  }

  function removeLanguage(lang) {
    setProfForm(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang)
    }))
  }

  if (loading) return <LoadingSpinner text="Loading profile..." />

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          My Profile
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Manage your personal and professional details
        </p>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="card-custom card-static p-4 text-center" style={{ position: 'sticky', top: 88 }}>
            <div className="d-flex justify-content-center mb-3">
              <AvatarUpload
                currentUrl={personalForm.avatar_url}
                name={personalForm.name}
                size={110}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                uploading={uploading}
              />
            </div>
            <div className="profile-card-info">
              <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>
                Dr. {personalForm.name || 'Doctor'}
              </h5>
            </div>
            <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, margin: '4px 0' }}>
              {profForm.specialization || 'Specialist'}
            </p>
            {profForm.qualification && (
              <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '2px 0' }}>
                {profForm.qualification}
              </p>
            )}

            {/* Availability Status Badge */}
            <div className="mt-2 mb-1">
              <span className={`doctor-status-badge status-${profForm.availability_status.toLowerCase().replace('_', '-')}`}>
                <i className={`bi ${profForm.availability_status === 'AVAILABLE' ? 'bi-circle-fill' : profForm.availability_status === 'OFFLINE' ? 'bi-moon-fill' : profForm.availability_status === 'UNAVAILABLE' ? 'bi-dash-circle-fill' : 'bi-x-circle-fill'}`} style={{ fontSize: 8 }} />
                {profForm.availability_status === 'AVAILABLE' ? 'Available' : profForm.availability_status === 'OFFLINE' ? 'Offline' : profForm.availability_status === 'UNAVAILABLE' ? 'Unavailable' : 'Not in Service'}
              </span>
            </div>

            <hr className="divider" />

            <div className="d-flex flex-column gap-2 text-start profile-card-info">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-envelope" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">{authProfile?.email ?? user?.email}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-telephone" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">{personalForm.phone || '—'}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-briefcase" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">{profForm.experience_years} years exp.</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-currency-rupee" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>₹{profForm.consultation_fee}</span>
              </div>
              {profForm.registration_number && (
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-card-text" style={{ color: 'var(--gray-400)', width: 20 }} />
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Reg: {profForm.registration_number}</span>
                </div>
              )}
            </div>

            {/* Languages */}
            {profForm.languages.length > 0 && (
              <>
                <hr className="divider" />
                <div className="text-start">
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Languages
                  </span>
                  <div className="d-flex flex-wrap gap-1 mt-2">
                    {profForm.languages.map(lang => (
                      <span key={lang} style={{
                        background: 'rgba(0,119,182,0.08)', color: 'var(--primary)',
                        padding: '2px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: 12, fontWeight: 500
                      }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit Area */}
        <div className="col-lg-8">
          <ProfileTabs
            tabs={['Personal', 'Professional', 'Security']}
            activeTab={activeTab}
            onChange={setActiveTab}
            icons={['bi-person', 'bi-briefcase-fill', 'bi-shield-lock']}
          />

          {/* Tab 1: Personal */}
          {activeTab === 0 && (
            <div className="card-custom p-4 mt-3 animate-fadeInUp">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                <i className="bi bi-person-lines-fill me-2 text-primary" />
                Personal Information
              </h6>
              <form onSubmit={handleSavePersonal}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label-custom" htmlFor="doc-personal-name">Full Name *</label>
                    <input
                      id="doc-personal-name"
                      type="text"
                      className="form-input-custom"
                      value={personalForm.name}
                      onChange={e => setPersonalForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom" htmlFor="doc-personal-phone">Phone</label>
                    <input
                      id="doc-personal-phone"
                      type="tel"
                      className="form-input-custom"
                      placeholder="+91 98765 43210"
                      value={personalForm.phone}
                      onChange={e => setPersonalForm(prev => ({ ...prev, phone: e.target.value }))}
                      maxLength={15}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label-custom" htmlFor="doc-personal-bio">Bio / About</label>
                    <textarea
                      id="doc-personal-bio"
                      className="form-input-custom"
                      rows={4}
                      placeholder="Tell patients about yourself, your approach to care, and your experience..."
                      value={personalForm.bio}
                      onChange={e => setPersonalForm(prev => ({ ...prev, bio: e.target.value }))}
                      maxLength={500}
                    />
                    <div className={`char-counter ${personalForm.bio.length > 450 ? (personalForm.bio.length > 490 ? 'danger' : 'warning') : ''}`}>
                      {personalForm.bio.length}/500
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)', display: 'block' }}>
                      This will be visible on your public profile
                    </span>
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <button type="submit" className="btn-primary-custom" disabled={saving}>
                    {saving ? (
                      <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                    ) : (
                      <><i className="bi bi-check-lg" /> Save Personal Info</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Professional */}
          {activeTab === 1 && (
            <div className="card-custom p-4 mt-3 animate-fadeInUp">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                <i className="bi bi-award me-2 text-primary" />
                Professional Details
              </h6>
              <form onSubmit={handleSaveProfessional}>
                {/* Status Selector */}
                <div className="doctor-status-selector mb-4">
                  <label className="form-label-custom">Availability Status</label>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 10 }}>
                    This status is visible to patients on your profile and search results
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { value: 'AVAILABLE', label: 'Available', icon: 'bi-circle-fill', color: 'var(--success)' },
                      { value: 'OFFLINE', label: 'Offline', icon: 'bi-moon-fill', color: 'var(--gray-400)' },
                      { value: 'UNAVAILABLE', label: 'Unavailable', icon: 'bi-dash-circle-fill', color: 'var(--warning)' },
                      { value: 'NOT_IN_SERVICE', label: 'Not in Service', icon: 'bi-x-circle-fill', color: 'var(--danger)' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`doctor-status-option ${profForm.availability_status === opt.value ? 'active' : ''}`}
                        style={{ '--status-color': opt.color }}
                        onClick={() => setProfForm(prev => ({ ...prev, availability_status: opt.value }))}
                      >
                        <i className={`bi ${opt.icon}`} style={{ color: opt.color, fontSize: 10 }} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label-custom">Specialization *</label>
                    <input
                      id="doc-prof-spec"
                      type="text"
                      className="form-input-custom"
                      value={profForm.specialization}
                      onChange={e => setProfForm(prev => ({ ...prev, specialization: e.target.value }))}
                      placeholder="e.g. Cardiology"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Qualification</label>
                    <input
                      id="doc-prof-qual"
                      type="text"
                      className="form-input-custom"
                      value={profForm.qualification}
                      onChange={e => setProfForm(prev => ({ ...prev, qualification: e.target.value }))}
                      placeholder="e.g. MBBS, MD, DM"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Experience (years)</label>
                    <input
                      id="doc-prof-exp"
                      type="number"
                      className="form-input-custom"
                      min={0}
                      value={profForm.experience_years}
                      onChange={e => setProfForm(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Consultation Fee (₹)</label>
                    <input
                      id="doc-prof-fee"
                      type="number"
                      className="form-input-custom"
                      min={0}
                      value={profForm.consultation_fee}
                      onChange={e => setProfForm(prev => ({ ...prev, consultation_fee: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Department</label>
                    <select
                      id="doc-prof-dept"
                      className="form-input-custom"
                      value={profForm.department_id}
                      onChange={e => setProfForm(prev => ({ ...prev, department_id: e.target.value }))}
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Medical Registration No.</label>
                    <input
                      id="doc-prof-reg"
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g. MCI-12345"
                      value={profForm.registration_number}
                      onChange={e => setProfForm(prev => ({ ...prev, registration_number: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Languages Spoken</label>
                    <div className="d-flex gap-2">
                      <input
                        id="doc-prof-lang"
                        type="text"
                        className="form-input-custom"
                        placeholder="e.g. Hindi"
                        value={langInput}
                        onChange={e => setLangInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLanguage() } }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn-ghost" onClick={addLanguage} style={{ whiteSpace: 'nowrap' }}>
                        <i className="bi bi-plus-lg" /> Add
                      </button>
                    </div>
                    {profForm.languages.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {profForm.languages.map(lang => (
                          <span key={lang} style={{
                            background: 'rgba(0,119,182,0.08)', color: 'var(--primary)',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            fontSize: 13, fontWeight: 500, display: 'inline-flex',
                            alignItems: 'center', gap: 4
                          }}>
                            {lang}
                            <button
                              type="button"
                              onClick={() => removeLanguage(lang)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--gray-400)', padding: 0, fontSize: 14, lineHeight: 1
                              }}
                            >
                              <i className="bi bi-x" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <button type="submit" className="btn-primary-custom" disabled={saving}>
                    {saving ? (
                      <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                    ) : (
                      <><i className="bi bi-check-lg" /> Save Professional Details</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Security */}
          {activeTab === 2 && (
            <div className="animate-fadeInUp">
              <div className="card-custom p-4 mt-3">
                <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                  <i className="bi bi-key me-2 text-primary" />
                  Change Password
                </h6>
                <PasswordChange />
              </div>

              <div className="card-custom p-4 mt-3">
                <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
                  <i className="bi bi-info-circle me-2 text-primary" />
                  Account Information
                </h6>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Email</span>
                    <span style={{ fontWeight: 600 }}>{user?.email}</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Role</span>
                    <span className="badge-confirmed" style={{ fontSize: 11 }}>Doctor</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Status</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                      <i className="bi bi-check-circle-fill me-1" />Active
                    </span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Joined</span>
                    <span style={{ fontWeight: 600 }}>
                      {authProfile?.created_at
                        ? new Date(authProfile.created_at).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric'
                          })
                        : '—'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
