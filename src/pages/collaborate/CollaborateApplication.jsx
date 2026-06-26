import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { submitApplication, checkEmailExists, uploadApplicationDocument } from '../../services/collaborate'
import { getDepartments } from '../../services/admin'
import { sanitizeName, sanitizeEmail, sanitizePhone, sanitizeInput } from '../../security/sanitize'
import { validateField, validatePhone, RULES } from '../../security/validators'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import './CollaborateApplication.css'

const STEPS = [
  { key: 'type', label: 'Type', icon: 'bi-grid' },
  { key: 'personal', label: 'Details', icon: 'bi-person' },
  { key: 'professional', label: 'Professional', icon: 'bi-briefcase' },
  { key: 'additional', label: 'More Info', icon: 'bi-file-earmark-text' },
  { key: 'review', label: 'Review', icon: 'bi-check2-all' },
]

const INITIAL_FORM = {
  application_type: '',
  applicant_name: '',
  applicant_email: '',
  applicant_phone: '',
  specialization: '',
  qualification: '',
  experience_years: '',
  consultation_fee: '',
  registration_number: '',
  department_id: '',
  bio: '',
  hospital_name: '',
  hospital_address: '',
  hospital_city: '',
  hospital_state: '',
  hospital_pincode: '',
  hospital_type: '',
  bed_count: '',
}

export default function CollaborateApplication() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [errors, setErrors] = useState({})
  const [departments, setDepartments] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [appId, setAppId] = useState(null)
  const [documentFile, setDocumentFile] = useState(null)

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {})
  }, [])

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  // ── Validation per step ──
  function validateStep(stepIndex) {
    const errs = {}

    if (stepIndex === 0) {
      if (!form.application_type) errs.application_type = 'Please select an application type'
    }

    if (stepIndex === 1) {
      const nameResult = validateField('name', form.applicant_name, { required: true })
      if (!nameResult.valid) errs.applicant_name = nameResult.message

      if (!form.applicant_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.applicant_email)) {
        errs.applicant_email = 'Please enter a valid email address'
      }

      const phoneResult = validatePhone(form.applicant_phone, true)
      if (!phoneResult.valid) errs.applicant_phone = phoneResult.message

      if (form.application_type === 'HOSPITAL') {
        if (!form.hospital_name?.trim()) errs.hospital_name = 'Hospital name is required'
      }
    }

    if (stepIndex === 2) {
      if (form.application_type === 'DOCTOR') {
        if (!form.specialization?.trim()) errs.specialization = 'Specialization is required'
        if (!form.registration_number?.trim()) errs.registration_number = 'Medical registration number is required'
      }
      if (form.application_type === 'HOSPITAL') {
        if (!form.hospital_type) errs.hospital_type = 'Please select hospital type'
        if (!form.hospital_address?.trim()) errs.hospital_address = 'Hospital address is required'
        if (!form.hospital_city?.trim()) errs.hospital_city = 'City is required'
        if (!form.hospital_state?.trim()) errs.hospital_state = 'State is required'
      }
    }

    // Step 3 (additional) — no mandatory fields
    // Step 4 (review) — no validation needed

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleNext() {
    if (!validateStep(step)) return

    // Check email uniqueness on step 1
    if (step === 1) {
      try {
        const check = await checkEmailExists(form.applicant_email.trim().toLowerCase())
        if (check.exists) {
          setErrors(prev => ({ ...prev, applicant_email: check.reason }))
          return
        }
      } catch {
        // If check fails, continue anyway (DB constraint will catch duplicates)
      }
    }

    setStep(s => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    try {
      setSubmitting(true)

      // Upload document if provided
      let documentsUrl = null
      if (documentFile) {
        documentsUrl = await uploadApplicationDocument(documentFile, form.applicant_email)
      }

      const payload = {
        ...form,
        applicant_name: sanitizeName(form.applicant_name),
        applicant_email: sanitizeEmail(form.applicant_email),
        applicant_phone: sanitizePhone(form.applicant_phone),
        specialization: form.specialization ? sanitizeInput(form.specialization) : null,
        qualification: form.qualification ? sanitizeInput(form.qualification) : null,
        registration_number: form.registration_number ? sanitizeInput(form.registration_number) : null,
        bio: form.bio ? sanitizeInput(form.bio) : null,
        hospital_name: form.hospital_name ? sanitizeInput(form.hospital_name) : null,
        hospital_address: form.hospital_address ? sanitizeInput(form.hospital_address) : null,
        hospital_city: form.hospital_city ? sanitizeInput(form.hospital_city) : null,
        hospital_state: form.hospital_state ? sanitizeInput(form.hospital_state) : null,
        hospital_pincode: form.hospital_pincode ? sanitizeInput(form.hospital_pincode) : null,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        consultation_fee: form.consultation_fee ? parseFloat(form.consultation_fee) : null,
        bed_count: form.bed_count ? parseInt(form.bed_count) : null,
        department_id: form.department_id || null,
        documents_url: documentsUrl,
      }

      const result = await submitApplication(payload)
      setAppId(result?.id)
      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (err) {
      console.error('Submission error:', err)
      if (err.message?.includes('idx_collab_apps_active_email')) {
        toast.error('An application with this email is already pending.')
      } else {
        toast.error(err.message || 'Failed to submit application. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success Screen ──
  if (submitted) {
    return (
      <div className="collaborate-page">
        <Navbar />
        <div className="collaborate-container">
          <div className="collaborate-form-card">
            <div className="collaborate-success">
              <div className="success-icon">
                <i className="bi bi-check-lg" />
              </div>
              <h2>Application Submitted!</h2>
              <p>
                Thank you for your interest in joining MediBook. Your application has been
                received and is now under review by our admin team.
              </p>
              {appId && (
                <div className="app-id">
                  Application ID: #MB-{String(appId).padStart(5, '0')}
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                You will receive your login credentials via email once your application
                is approved. This usually takes 1-3 business days.
              </p>
              <div className="d-flex gap-3 justify-content-center mt-4">
                <Link to="/" className="btn-primary-custom">
                  <i className="bi bi-house me-2" />Back to Home
                </Link>
                <Link to="/doctors" className="btn-outline-custom">
                  Browse Doctors
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // ── Render Steps ──
  return (
    <div className="collaborate-page">
      <Navbar />
      <div className="collaborate-container">
        {/* Header */}
        <div className="collaborate-header">
          <h1>Join MediBook Platform</h1>
          <p>Apply as a Doctor or Hospital to list your services and reach more patients</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div key={s.key} className="step-indicator-item">
              <div className={`step-dot ${i === step ? 'active' : i < step ? 'completed' : 'inactive'}`}>
                {i < step ? <i className="bi bi-check-lg" /> : i + 1}
                <span className="step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < step ? 'completed' : 'inactive'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="collaborate-form-card" key={step}>
          {/* Step 0: Choose Type */}
          {step === 0 && (
            <>
              <h3 className="step-title">
                <i className="bi bi-grid me-2 text-primary" />How would you like to collaborate?
              </h3>
              <p className="step-subtitle">Select the type of application that best describes you</p>

              <div className="type-selection">
                <div
                  className={`type-card ${form.application_type === 'DOCTOR' ? 'selected' : ''}`}
                  onClick={() => updateField('application_type', 'DOCTOR')}
                >
                  <div className="check-badge"><i className="bi bi-check" /></div>
                  <div className="type-icon doctor-icon">
                    <i className="bi bi-person-badge" />
                  </div>
                  <h4>Doctor</h4>
                  <p>Individual practitioner looking to list your practice and accept appointments</p>
                </div>

                <div
                  className={`type-card ${form.application_type === 'HOSPITAL' ? 'selected' : ''}`}
                  onClick={() => updateField('application_type', 'HOSPITAL')}
                >
                  <div className="check-badge"><i className="bi bi-check" /></div>
                  <div className="type-icon hospital-icon">
                    <i className="bi bi-hospital" />
                  </div>
                  <h4>Hospital / Clinic</h4>
                  <p>Healthcare organization wanting to list your facility and manage doctors</p>
                </div>
              </div>
              {errors.application_type && (
                <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.application_type}</span>
              )}
            </>
          )}

          {/* Step 1: Personal / Organization Details */}
          {step === 1 && (
            <>
              <h3 className="step-title">
                <i className="bi bi-person-circle me-2 text-primary" />
                {form.application_type === 'DOCTOR' ? 'Personal Details' : 'Organization Details'}
              </h3>
              <p className="step-subtitle">
                {form.application_type === 'DOCTOR'
                  ? 'Tell us about yourself — this info will be used for your profile'
                  : 'Tell us about your healthcare organization'}
              </p>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label-custom required">
                    {form.application_type === 'DOCTOR' ? 'Full Name' : 'Contact Person Name'}
                  </label>
                  <div className="search-input-wrapper">
                    <i className="bi bi-person" />
                    <input
                      type="text"
                      className={`form-input-custom ${errors.applicant_name ? 'error' : ''}`}
                      placeholder={form.application_type === 'DOCTOR' ? 'Dr. John Doe' : 'Rajesh Kumar'}
                      value={form.applicant_name}
                      onChange={e => updateField('applicant_name', e.target.value)}
                      maxLength={100}
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                  {errors.applicant_name && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.applicant_name}</span>}
                </div>

                <div className="col-md-6">
                  <label className="form-label-custom required">Email Address</label>
                  <div className="search-input-wrapper">
                    <i className="bi bi-envelope" />
                    <input
                      type="email"
                      className={`form-input-custom ${errors.applicant_email ? 'error' : ''}`}
                      placeholder="you@example.com"
                      value={form.applicant_email}
                      onChange={e => updateField('applicant_email', e.target.value)}
                      maxLength={254}
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                  {errors.applicant_email && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.applicant_email}</span>}
                </div>

                <div className="col-md-6">
                  <label className="form-label-custom required">Phone Number</label>
                  <div className="search-input-wrapper">
                    <i className="bi bi-telephone" />
                    <input
                      type="tel"
                      className={`form-input-custom ${errors.applicant_phone ? 'error' : ''}`}
                      placeholder="+91 98765 43210"
                      value={form.applicant_phone}
                      onChange={e => updateField('applicant_phone', e.target.value)}
                      maxLength={15}
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                  {errors.applicant_phone && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.applicant_phone}</span>}
                </div>

                {form.application_type === 'HOSPITAL' && (
                  <div className="col-md-6">
                    <label className="form-label-custom required">Hospital / Clinic Name</label>
                    <div className="search-input-wrapper">
                      <i className="bi bi-hospital" />
                      <input
                        type="text"
                        className={`form-input-custom ${errors.hospital_name ? 'error' : ''}`}
                        placeholder="Apollo Hospitals"
                        value={form.hospital_name}
                        onChange={e => updateField('hospital_name', e.target.value)}
                        maxLength={200}
                        style={{ paddingLeft: 42 }}
                      />
                    </div>
                    {errors.hospital_name && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.hospital_name}</span>}
                  </div>
                )}

                <div className="col-md-6">
                  <label className="form-label-custom">Department</label>
                  <select
                    className="form-input-custom"
                    value={form.department_id}
                    onChange={e => updateField('department_id', e.target.value)}
                  >
                    <option value="">Select department (optional)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Professional Details */}
          {step === 2 && (
            <>
              <h3 className="step-title">
                <i className="bi bi-briefcase me-2 text-primary" />Professional Details
              </h3>
              <p className="step-subtitle">
                {form.application_type === 'DOCTOR'
                  ? 'Share your medical expertise and qualifications'
                  : 'Provide details about your healthcare facility'}
              </p>

              <div className="row g-3">
                {form.application_type === 'DOCTOR' ? (
                  <>
                    <div className="col-md-6">
                      <label className="form-label-custom required">Specialization</label>
                      <input
                        type="text"
                        className={`form-input-custom ${errors.specialization ? 'error' : ''}`}
                        placeholder="e.g. Cardiology, Neurology"
                        value={form.specialization}
                        onChange={e => updateField('specialization', e.target.value)}
                        maxLength={100}
                      />
                      {errors.specialization && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.specialization}</span>}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Qualification</label>
                      <input
                        type="text"
                        className="form-input-custom"
                        placeholder="e.g. MBBS, MD, MS"
                        value={form.qualification}
                        onChange={e => updateField('qualification', e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom">Experience (years)</label>
                      <input
                        type="number"
                        className="form-input-custom"
                        min={0}
                        max={70}
                        placeholder="0"
                        value={form.experience_years}
                        onChange={e => updateField('experience_years', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom">Consultation Fee (₹)</label>
                      <input
                        type="number"
                        className="form-input-custom"
                        min={0}
                        max={100000}
                        placeholder="500"
                        value={form.consultation_fee}
                        onChange={e => updateField('consultation_fee', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom required">Registration No.</label>
                      <input
                        type="text"
                        className={`form-input-custom ${errors.registration_number ? 'error' : ''}`}
                        placeholder="MCI/State Reg No."
                        value={form.registration_number}
                        onChange={e => updateField('registration_number', e.target.value)}
                        maxLength={50}
                      />
                      {errors.registration_number && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.registration_number}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-md-6">
                      <label className="form-label-custom required">Hospital Type</label>
                      <select
                        className={`form-input-custom ${errors.hospital_type ? 'error' : ''}`}
                        value={form.hospital_type}
                        onChange={e => updateField('hospital_type', e.target.value)}
                      >
                        <option value="">Select type</option>
                        <option value="PRIVATE">Private Hospital</option>
                        <option value="GOVERNMENT">Government Hospital</option>
                        <option value="CLINIC">Clinic</option>
                        <option value="MULTI_SPECIALTY">Multi-Specialty Hospital</option>
                      </select>
                      {errors.hospital_type && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.hospital_type}</span>}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Number of Beds</label>
                      <input
                        type="number"
                        className="form-input-custom"
                        min={0}
                        max={10000}
                        placeholder="50"
                        value={form.bed_count}
                        onChange={e => updateField('bed_count', e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label-custom required">Hospital Address</label>
                      <input
                        type="text"
                        className={`form-input-custom ${errors.hospital_address ? 'error' : ''}`}
                        placeholder="Full street address"
                        value={form.hospital_address}
                        onChange={e => updateField('hospital_address', e.target.value)}
                        maxLength={300}
                      />
                      {errors.hospital_address && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.hospital_address}</span>}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom required">City</label>
                      <input
                        type="text"
                        className={`form-input-custom ${errors.hospital_city ? 'error' : ''}`}
                        placeholder="Mumbai"
                        value={form.hospital_city}
                        onChange={e => updateField('hospital_city', e.target.value)}
                        maxLength={100}
                      />
                      {errors.hospital_city && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.hospital_city}</span>}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom required">State</label>
                      <input
                        type="text"
                        className={`form-input-custom ${errors.hospital_state ? 'error' : ''}`}
                        placeholder="Maharashtra"
                        value={form.hospital_state}
                        onChange={e => updateField('hospital_state', e.target.value)}
                        maxLength={100}
                      />
                      {errors.hospital_state && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.hospital_state}</span>}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label-custom">PIN Code</label>
                      <input
                        type="text"
                        className="form-input-custom"
                        placeholder="400001"
                        value={form.hospital_pincode}
                        onChange={e => updateField('hospital_pincode', e.target.value)}
                        maxLength={10}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Registration / License No.</label>
                      <input
                        type="text"
                        className="form-input-custom"
                        placeholder="Hospital License Number"
                        value={form.registration_number}
                        onChange={e => updateField('registration_number', e.target.value)}
                        maxLength={50}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 3: Additional Info */}
          {step === 3 && (
            <>
              <h3 className="step-title">
                <i className="bi bi-file-earmark-text me-2 text-primary" />Additional Information
              </h3>
              <p className="step-subtitle">
                Help us know you better — this information strengthens your application
              </p>

              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label-custom">
                    {form.application_type === 'DOCTOR' ? 'Professional Bio' : 'About the Hospital'}
                  </label>
                  <textarea
                    className="form-input-custom"
                    rows={4}
                    placeholder={form.application_type === 'DOCTOR'
                      ? 'Tell patients about your experience, areas of expertise, and approach to care...'
                      : 'Describe your hospital — services offered, specialties, achievements...'}
                    value={form.bio}
                    onChange={e => updateField('bio', e.target.value)}
                    maxLength={2000}
                    style={{ resize: 'vertical', minHeight: 100 }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                    {(form.bio || '').length} / 2000
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label-custom">
                    Supporting Documents
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '0 0 8px' }}>
                    Upload your medical license, registration certificate, or hospital license (PDF, JPG, PNG — max 5MB)
                  </p>
                  <input
                    type="file"
                    className="form-input-custom"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setDocumentFile(e.target.files?.[0] || null)}
                    style={{ padding: '10px 14px' }}
                  />
                  {documentFile && (
                    <div className="d-flex align-items-center gap-2 mt-2" style={{ fontSize: 13, color: 'var(--success)' }}>
                      <i className="bi bi-file-earmark-check" />
                      {documentFile.name} ({(documentFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <>
              <h3 className="step-title">
                <i className="bi bi-check2-all me-2 text-primary" />Review Your Application
              </h3>
              <p className="step-subtitle">
                Please verify all information before submitting. You can go back to edit any section.
              </p>

              {/* Application Type */}
              <div className="review-section">
                <div className="review-section-title">
                  <i className="bi bi-grid" />Application Type
                </div>
                <div className="review-grid">
                  <div className="review-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="review-label">Type</div>
                    <div className="review-value d-flex align-items-center gap-2">
                      <i className={`bi ${form.application_type === 'DOCTOR' ? 'bi-person-badge' : 'bi-hospital'}`}
                        style={{ color: 'var(--primary)' }} />
                      {form.application_type === 'DOCTOR' ? 'Doctor' : 'Hospital / Clinic'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="review-section">
                <div className="review-section-title">
                  <i className="bi bi-person-circle" />Contact Information
                </div>
                <div className="review-grid">
                  <div className="review-item">
                    <div className="review-label">Name</div>
                    <div className="review-value">{form.applicant_name}</div>
                  </div>
                  <div className="review-item">
                    <div className="review-label">Email</div>
                    <div className="review-value">{form.applicant_email}</div>
                  </div>
                  <div className="review-item">
                    <div className="review-label">Phone</div>
                    <div className="review-value">{form.applicant_phone}</div>
                  </div>
                  {form.application_type === 'HOSPITAL' && form.hospital_name && (
                    <div className="review-item">
                      <div className="review-label">Hospital Name</div>
                      <div className="review-value">{form.hospital_name}</div>
                    </div>
                  )}
                  {form.department_id && (
                    <div className="review-item">
                      <div className="review-label">Department</div>
                      <div className="review-value">{departments.find(d => String(d.id) === String(form.department_id))?.name || '—'}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Details */}
              <div className="review-section">
                <div className="review-section-title">
                  <i className="bi bi-briefcase" />Professional Details
                </div>
                <div className="review-grid">
                  {form.application_type === 'DOCTOR' ? (
                    <>
                      {form.specialization && (
                        <div className="review-item">
                          <div className="review-label">Specialization</div>
                          <div className="review-value">{form.specialization}</div>
                        </div>
                      )}
                      {form.qualification && (
                        <div className="review-item">
                          <div className="review-label">Qualification</div>
                          <div className="review-value">{form.qualification}</div>
                        </div>
                      )}
                      {form.experience_years && (
                        <div className="review-item">
                          <div className="review-label">Experience</div>
                          <div className="review-value">{form.experience_years} years</div>
                        </div>
                      )}
                      {form.consultation_fee && (
                        <div className="review-item">
                          <div className="review-label">Consultation Fee</div>
                          <div className="review-value">₹{form.consultation_fee}</div>
                        </div>
                      )}
                      {form.registration_number && (
                        <div className="review-item">
                          <div className="review-label">Registration No.</div>
                          <div className="review-value">{form.registration_number}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {form.hospital_type && (
                        <div className="review-item">
                          <div className="review-label">Hospital Type</div>
                          <div className="review-value">{form.hospital_type.replace('_', ' ')}</div>
                        </div>
                      )}
                      {form.bed_count && (
                        <div className="review-item">
                          <div className="review-label">Bed Count</div>
                          <div className="review-value">{form.bed_count}</div>
                        </div>
                      )}
                      {form.hospital_address && (
                        <div className="review-item" style={{ gridColumn: '1 / -1' }}>
                          <div className="review-label">Address</div>
                          <div className="review-value">
                            {form.hospital_address}{form.hospital_city ? `, ${form.hospital_city}` : ''}{form.hospital_state ? `, ${form.hospital_state}` : ''}{form.hospital_pincode ? ` - ${form.hospital_pincode}` : ''}
                          </div>
                        </div>
                      )}
                      {form.registration_number && (
                        <div className="review-item">
                          <div className="review-label">License No.</div>
                          <div className="review-value">{form.registration_number}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bio */}
              {form.bio && (
                <div className="review-section">
                  <div className="review-section-title">
                    <i className="bi bi-file-text" />Bio
                  </div>
                  <div className="review-item" style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md, 10px)', padding: '14px 16px' }}>
                    <div className="review-value" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--gray-600)', fontWeight: 400 }}>
                      {form.bio}
                    </div>
                  </div>
                </div>
              )}

              {/* Document */}
              {documentFile && (
                <div className="review-section">
                  <div className="review-section-title">
                    <i className="bi bi-paperclip" />Attached Document
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    <i className="bi bi-file-earmark-check" />
                    {documentFile.name}
                  </div>
                </div>
              )}

              {/* Consent Note */}
              <div style={{
                background: 'rgba(0,119,182,0.05)',
                borderRadius: 'var(--radius-md, 10px)',
                padding: '14px 18px',
                fontSize: 12,
                color: 'var(--gray-500)',
                lineHeight: 1.7,
                marginTop: 16
              }}>
                <i className="bi bi-shield-check me-2" style={{ color: 'var(--primary)' }} />
                By submitting this application, you agree to our <Link to="/terms-of-service">Terms of Service</Link> and <Link to="/privacy-policy">Privacy Policy</Link>.
                Your information will be reviewed by our admin team and kept confidential.
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="collaborate-actions">
            {step > 0 && (
              <button type="button" className="btn-back" onClick={handleBack}>
                <i className="bi bi-arrow-left" />Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn-primary-custom"
                onClick={handleNext}
              >
                Continue <i className="bi bi-arrow-right ms-1" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary-custom"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ minWidth: 180 }}
              >
                {submitting ? (
                  <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Submitting...</>
                ) : (
                  <><i className="bi bi-send me-2" />Submit Application</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="d-flex justify-content-center gap-4 mt-4 flex-wrap" style={{ opacity: 0.7 }}>
          {[
            { icon: 'bi-shield-lock', text: 'Secure Submission' },
            { icon: 'bi-clock-history', text: '1-3 Day Review' },
            { icon: 'bi-patch-check', text: 'Admin Verified' },
          ].map(t => (
            <div key={t.text} className="d-flex align-items-center gap-2">
              <i className={`bi ${t.icon}`} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
