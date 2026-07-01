import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import {
  ONBOARDING_STEPS,
  getOnboardingProgress,
  markStepComplete,
  savePreferences,
  saveConsents,
  getNextStepIndex
} from '../../services/onboarding'
import { updatePatientDetails } from '../../services/profiles'
import { updateDoctorDetails } from '../../services/profiles'
import './OnboardingWizard.css'

// ─── Confetti Helper ───
function Confetti() {
  const colors = ['#0077B6', '#00B4D8', '#2DC653', '#F9C74F', '#EF233C', '#4CC9F0', '#90E0EF']
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 6,
    shape: Math.random() > 0.5 ? '50%' : '2px'
  }))

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape
          }}
        />
      ))}
    </div>
  )
}

export default function OnboardingWizard() {
  const { user, profile, role, refreshProfile, refreshOnboarding } = useAuth()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [direction, setDirection] = useState('forward') // 'forward' | 'back'
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // ── Profile step state ──
  const [profileData, setProfileData] = useState({
    dob: '', gender: '', blood_group: '', address: '', emergency_contact: ''
  })

  // ── Doctor profile step state ──
  const [doctorData, setDoctorData] = useState({
    specialization: '', qualification: '', experience_years: '',
    consultation_fee: '', bio: '', registration_number: ''
  })

  // ── Preferences step state ──
  const [prefs, setPrefs] = useState({
    notification_channel: 'EMAIL',
    language: 'en',
    appointment_reminder: true,
    marketing_emails: false
  })

  // ── Consent step state ──
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    marketing: false,
    data_processing: false
  })

  // ── Load existing progress on mount ──
  useEffect(() => {
    if (!user?.id) return
    async function loadProgress() {
      try {
        const progress = await getOnboardingProgress(user.id)
        setCompletedSteps(progress)
        const nextIdx = getNextStepIndex(progress)
        if (nextIdx >= 0) {
          setCurrentStep(nextIdx)
        } else {
          setIsComplete(true)
        }
      } catch (err) {
        console.error('Failed to load onboarding progress:', err)
      } finally {
        setInitialLoading(false)
      }
    }
    loadProgress()
  }, [user?.id])

  const isStepDone = useCallback((stepKey) => {
    return completedSteps.some(s => s.step_key === stepKey)
  }, [completedSteps])

  // ── Navigation ──
  function goNext() {
    setDirection('forward')
    setCurrentStep(prev => Math.min(prev + 1, ONBOARDING_STEPS.length - 1))
  }

  function goBack() {
    setDirection('back')
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  // ── Step Handlers ──

  async function handleWelcomeComplete() {
    try {
      setLoading(true)
      await markStepComplete(user.id, 'welcome')
      setCompletedSteps(prev => [...prev, { step_key: 'welcome' }])
      goNext()
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProfileComplete() {
    try {
      setLoading(true)

      if (role === 'PATIENT') {
        await updatePatientDetails(user.id, {
          dob: profileData.dob || null,
          gender: profileData.gender || null,
          blood_group: profileData.blood_group || null,
          address: profileData.address || null,
          emergency_contact: profileData.emergency_contact || null
        })
      }

      // Doctor profile data is handled via the doctors table
      // The doctor record should already exist from admin setup

      await markStepComplete(user.id, 'profile_details')
      setCompletedSteps(prev => [...prev, { step_key: 'profile_details' }])
      goNext()
    } catch (err) {
      toast.error(err.message || 'Failed to save profile.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePreferencesComplete() {
    try {
      setLoading(true)
      await savePreferences(user.id, prefs)
      await markStepComplete(user.id, 'preferences')
      setCompletedSteps(prev => [...prev, { step_key: 'preferences' }])
      goNext()
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConsentComplete() {
    if (!consents.terms || !consents.privacy) {
      toast.error('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }

    try {
      setLoading(true)

      const consentRecords = [
        { consent_type: 'TERMS_OF_SERVICE', granted: consents.terms },
        { consent_type: 'PRIVACY_POLICY', granted: consents.privacy },
        { consent_type: 'DATA_PROCESSING', granted: consents.data_processing },
        { consent_type: 'MARKETING_EMAILS', granted: consents.marketing }
      ]

      await saveConsents(user.id, consentRecords)
      await markStepComplete(user.id, 'consent')
      await markStepComplete(user.id, 'completed')
      setCompletedSteps(prev => [
        ...prev,
        { step_key: 'consent' },
        { step_key: 'completed' }
      ])

      // Show celebration
      setShowConfetti(true)
      setIsComplete(true)

      // Refresh auth context
      if (refreshOnboarding) refreshOnboarding()
      if (refreshProfile) refreshProfile()

      toast.success('Welcome to MediBook! 🎉')
    } catch (err) {
      toast.error(err.message || 'Failed to save consent.')
    } finally {
      setLoading(false)
    }
  }

  function handleFinish() {
    const dashboardRoutes = {
      PATIENT: '/patient/dashboard',
      DOCTOR: '/doctor/dashboard'
    }
    navigate(dashboardRoutes[role] || '/', { replace: true })
  }

  // ── Skip Handler ──
  async function handleSkip() {
    try {
      // Mark all remaining steps + completed
      const allKeys = ['welcome', 'profile_details', 'preferences', 'consent', 'completed']
      for (const key of allKeys) {
        if (!isStepDone(key)) {
          await markStepComplete(user.id, key, { skipped: true })
        }
      }
      if (refreshOnboarding) refreshOnboarding()
      toast.info('You can complete your profile later from settings.')
      handleFinish()
    } catch {
      handleFinish()
    }
  }

  if (initialLoading) {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner-custom" style={{ margin: '0 auto 16px', width: 36, height: 36 }} />
          <p style={{ color: '#64748B', fontSize: 15 }}>Loading your onboarding...</p>
        </div>
      </div>
    )
  }

  // ─── Completion Screen ───
  if (isComplete) {
    return (
      <div className="onboarding-overlay">
        {showConfetti && <Confetti />}
        <div className="onboarding-card">
          <div className="onboarding-content" style={{ textAlign: 'center', padding: '60px 36px' }}>
            <div className="completion-check">
              <i className="bi bi-check-lg" />
            </div>
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color: '#03045E',
              margin: '0 0 12px'
            }}>
              You're All Set!
            </h2>
            <p style={{ color: '#64748B', fontSize: 16, margin: '0 0 32px', lineHeight: 1.6 }}>
              Welcome to MediBook, <strong>{profile?.name || 'there'}</strong>! 
              {role === 'PATIENT' 
                ? ' Start exploring doctors and book your first appointment.'
                : ' Set up your availability and start accepting appointments.'}
            </p>
            <button
              className="onboarding-btn onboarding-btn-primary"
              onClick={handleFinish}
              id="onboarding-finish-btn"
              style={{ padding: '14px 40px', fontSize: 16 }}
            >
              {role === 'PATIENT' ? 'Explore Doctors' : 'Go to Dashboard'}
              <i className="bi bi-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const slideClass = direction === 'forward' ? 'onboarding-slide' : 'onboarding-slide-back'

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Step Indicator */}
        <div className="onboarding-steps">
          {ONBOARDING_STEPS.map((step, idx) => (
            <div className="onboarding-step-item" key={step.key}>
              <div
                className={`onboarding-step-dot ${
                  idx < currentStep || isStepDone(step.key) ? 'done' :
                  idx === currentStep ? 'active' : 'pending'
                }`}
              >
                {idx < currentStep || isStepDone(step.key)
                  ? <i className="bi bi-check" />
                  : <span>{idx + 1}</span>
                }
                <span className="onboarding-step-label">{step.label}</span>
              </div>
              {idx < ONBOARDING_STEPS.length - 1 && (
                <div className={`onboarding-step-line ${
                  idx < currentStep ? 'done' : ''
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="onboarding-content">
          <div key={currentStep} className={slideClass}>
            {/* ═══ STEP 0: Welcome ═══ */}
            {currentStep === 0 && (
              <WelcomeStep name={profile?.name} role={role} />
            )}

            {/* ═══ STEP 1: Profile Details ═══ */}
            {currentStep === 1 && (
              <ProfileStep
                role={role}
                data={role === 'PATIENT' ? profileData : doctorData}
                setData={role === 'PATIENT' ? setProfileData : setDoctorData}
              />
            )}

            {/* ═══ STEP 2: Preferences ═══ */}
            {currentStep === 2 && (
              <PreferencesStep prefs={prefs} setPrefs={setPrefs} />
            )}

            {/* ═══ STEP 3: Consent ═══ */}
            {currentStep === 3 && (
              <ConsentStep consents={consents} setConsents={setConsents} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          <div>
            {currentStep > 0 ? (
              <button
                className="onboarding-btn onboarding-btn-secondary"
                onClick={goBack}
                disabled={loading}
                id="onboarding-back-btn"
              >
                <i className="bi bi-arrow-left" /> Back
              </button>
            ) : (
              <button
                className="onboarding-btn onboarding-btn-skip"
                onClick={handleSkip}
                disabled={loading}
                id="onboarding-skip-btn"
              >
                Skip for now
              </button>
            )}
          </div>

          <button
            className="onboarding-btn onboarding-btn-primary"
            onClick={
              currentStep === 0 ? handleWelcomeComplete :
              currentStep === 1 ? handleProfileComplete :
              currentStep === 2 ? handlePreferencesComplete :
              handleConsentComplete
            }
            disabled={loading || (currentStep === 3 && (!consents.terms || !consents.privacy))}
            id="onboarding-next-btn"
          >
            {loading ? (
              <>
                <div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Saving...
              </>
            ) : currentStep === 3 ? (
              <>Complete Setup <i className="bi bi-check-circle" /></>
            ) : (
              <>Continue <i className="bi bi-arrow-right" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// STEP SUB-COMPONENTS
// ═══════════════════════════════════════════

function WelcomeStep({ name, role }) {
  const features = role === 'DOCTOR' ? [
    { icon: 'bi-calendar2-week', title: 'Manage Schedule', desc: 'Set your availability and manage appointment slots.', bg: 'rgba(0,119,182,0.1)', color: '#0077B6' },
    { icon: 'bi-people', title: 'Patient Management', desc: 'View patient details and appointment history.', bg: 'rgba(45,198,83,0.1)', color: '#2DC653' },
    { icon: 'bi-bell', title: 'Smart Alerts', desc: 'Get notified of new bookings and reminders.', bg: 'rgba(249,199,79,0.12)', color: '#D97706' },
  ] : [
    { icon: 'bi-search-heart', title: 'Find Doctors', desc: 'Search by specialization, location, or name.', bg: 'rgba(0,119,182,0.1)', color: '#0077B6' },
    { icon: 'bi-calendar-check', title: 'Easy Booking', desc: 'Book appointments instantly with real-time availability.', bg: 'rgba(45,198,83,0.1)', color: '#2DC653' },
    { icon: 'bi-bell', title: 'Smart Reminders', desc: 'Never miss an appointment with email & in-app reminders.', bg: 'rgba(249,199,79,0.12)', color: '#D97706' },
  ]

  return (
    <>
      <div className="onboarding-step-header">
        <div className="welcome-hero-emoji" aria-hidden="true">
          <i className="bi bi-heart-pulse-fill" style={{ fontSize: 48, color: '#0077B6' }} />
        </div>
        <h2>Welcome, {name || 'there'}!</h2>
        <p>
          {role === 'DOCTOR'
            ? "Let's set up your doctor profile so patients can find and book with you."
            : "Let's set up your account in just a few quick steps."}
        </p>
      </div>
      <div className="welcome-features">
        {features.map(f => (
          <div className="welcome-feature-card" key={f.title}>
            <div className="welcome-feature-icon" style={{ background: f.bg }}>
              <i className={`bi ${f.icon}`} style={{ color: f.color }} />
            </div>
            <h4>{f.title}</h4>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </>
  )
}


function ProfileStep({ role, data, setData }) {
  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  if (role === 'DOCTOR') {
    return (
      <>
        <div className="onboarding-step-header">
          <h2>Professional Details</h2>
          <p>Help patients know about your qualifications and expertise.</p>
        </div>
        <div className="onboarding-form-grid">
          <div>
            <label className="form-label-custom" htmlFor="ob-specialization">Specialization</label>
            <input
              id="ob-specialization"
              type="text"
              className="form-input-custom"
              placeholder="e.g., Cardiology"
              value={data.specialization}
              onChange={e => handleChange('specialization', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label-custom" htmlFor="ob-qualification">Qualification</label>
            <input
              id="ob-qualification"
              type="text"
              className="form-input-custom"
              placeholder="e.g., MBBS, MD"
              value={data.qualification}
              onChange={e => handleChange('qualification', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label-custom" htmlFor="ob-experience">Experience (years)</label>
            <input
              id="ob-experience"
              type="number"
              className="form-input-custom"
              placeholder="e.g., 10"
              min="0"
              value={data.experience_years}
              onChange={e => handleChange('experience_years', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label-custom" htmlFor="ob-fee">Consultation Fee (₹)</label>
            <input
              id="ob-fee"
              type="number"
              className="form-input-custom"
              placeholder="e.g., 500"
              min="0"
              value={data.consultation_fee}
              onChange={e => handleChange('consultation_fee', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label-custom" htmlFor="ob-regnumber">Registration Number</label>
            <input
              id="ob-regnumber"
              type="text"
              className="form-input-custom"
              placeholder="Medical council reg. number"
              value={data.registration_number}
              onChange={e => handleChange('registration_number', e.target.value)}
            />
          </div>
          <div className="full-width">
            <label className="form-label-custom" htmlFor="ob-bio">Bio</label>
            <textarea
              id="ob-bio"
              className="form-input-custom"
              placeholder="Tell patients about yourself..."
              rows={3}
              style={{ resize: 'vertical' }}
              value={data.bio}
              onChange={e => handleChange('bio', e.target.value)}
            />
          </div>
        </div>
      </>
    )
  }

  // Patient profile
  return (
    <>
      <div className="onboarding-step-header">
        <h2>Complete Your Profile</h2>
        <p>This helps doctors provide better care. All fields are optional.</p>
      </div>
      <div className="onboarding-form-grid">
        <div>
          <label className="form-label-custom" htmlFor="ob-dob">Date of Birth</label>
          <input
            id="ob-dob"
            type="date"
            className="form-input-custom"
            value={data.dob}
            onChange={e => handleChange('dob', e.target.value)}
          />
        </div>
        <div>
          <label className="form-label-custom" htmlFor="ob-gender">Gender</label>
          <select
            id="ob-gender"
            className="form-input-custom"
            value={data.gender}
            onChange={e => handleChange('gender', e.target.value)}
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="form-label-custom" htmlFor="ob-blood">Blood Group</label>
          <select
            id="ob-blood"
            className="form-input-custom"
            value={data.blood_group}
            onChange={e => handleChange('blood_group', e.target.value)}
          >
            <option value="">Select blood group</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label-custom" htmlFor="ob-emergency">Emergency Contact</label>
          <input
            id="ob-emergency"
            type="tel"
            className="form-input-custom"
            placeholder="+91 98765 43210"
            value={data.emergency_contact}
            onChange={e => handleChange('emergency_contact', e.target.value)}
          />
        </div>
        <div className="full-width">
          <label className="form-label-custom" htmlFor="ob-address">Address</label>
          <textarea
            id="ob-address"
            className="form-input-custom"
            placeholder="Your home address"
            rows={2}
            style={{ resize: 'vertical' }}
            value={data.address}
            onChange={e => handleChange('address', e.target.value)}
          />
        </div>
      </div>
    </>
  )
}


function PreferencesStep({ prefs, setPrefs }) {
  const channels = [
    { key: 'EMAIL', icon: 'bi-envelope', label: 'Email' },
    { key: 'SMS', icon: 'bi-chat-dots', label: 'SMS' },
    { key: 'ALL', icon: 'bi-bell', label: 'All Channels' },
  ]

  const languages = [
    { key: 'en', label: 'English' },
    { key: 'hi', label: 'Hindi' },
    { key: 'ta', label: 'Tamil' },
    { key: 'te', label: 'Telugu' },
    { key: 'kn', label: 'Kannada' },
    { key: 'ml', label: 'Malayalam' },
    { key: 'bn', label: 'Bengali' },
    { key: 'mr', label: 'Marathi' },
  ]

  return (
    <>
      <div className="onboarding-step-header">
        <h2>Your Preferences</h2>
        <p>Choose how you'd like to receive notifications and reminders.</p>
      </div>

      {/* Notification Channel */}
      <div style={{ marginBottom: 24 }}>
        <label className="form-label-custom" style={{ marginBottom: 10 }}>
          <i className="bi bi-bell" style={{ marginRight: 6, color: '#0077B6' }} />
          Notification Channel
        </label>
        <div className="pref-card-group">
          {channels.map(ch => (
            <div
              key={ch.key}
              className={`pref-card ${prefs.notification_channel === ch.key ? 'selected' : ''}`}
              onClick={() => setPrefs(p => ({ ...p, notification_channel: ch.key }))}
              role="radio"
              aria-checked={prefs.notification_channel === ch.key}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setPrefs(p => ({ ...p, notification_channel: ch.key }))}
            >
              <i className={`bi ${ch.icon}`} />
              <span>{ch.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div style={{ marginBottom: 24 }}>
        <label className="form-label-custom" htmlFor="ob-language">
          <i className="bi bi-translate" style={{ marginRight: 6, color: '#0077B6' }} />
          Preferred Language
        </label>
        <select
          id="ob-language"
          className="form-input-custom"
          value={prefs.language}
          onChange={e => setPrefs(p => ({ ...p, language: e.target.value }))}
        >
          {languages.map(l => (
            <option key={l.key} value={l.key}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>Appointment Reminders</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Get reminded before your appointments</div>
          </div>
          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={prefs.appointment_reminder}
              onChange={e => setPrefs(p => ({ ...p, appointment_reminder: e.target.checked }))}
            />
            <span className="onboarding-toggle-slider" />
          </label>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>Marketing Emails</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Receive health tips and platform updates</div>
          </div>
          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={prefs.marketing_emails}
              onChange={e => setPrefs(p => ({ ...p, marketing_emails: e.target.checked }))}
            />
            <span className="onboarding-toggle-slider" />
          </label>
        </div>
      </div>
    </>
  )
}


function ConsentStep({ consents, setConsents }) {
  const toggle = (key) => setConsents(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <>
      <div className="onboarding-step-header">
        <h2>Terms & Consent</h2>
        <p>Please review and accept the following to complete your registration.</p>
      </div>

      {/* Terms of Service — REQUIRED */}
      <div
        className={`consent-item ${consents.terms ? 'checked' : ''}`}
        onClick={() => toggle('terms')}
        role="checkbox"
        aria-checked={consents.terms}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && toggle('terms')}
      >
        <div className={`consent-checkbox ${consents.terms ? 'checked' : ''}`}>
          {consents.terms && <i className="bi bi-check" />}
        </div>
        <div className="consent-text">
          <h4>
            Terms of Service
            <span className="consent-required">Required</span>
          </h4>
          <p>
            I agree to the{' '}
            <Link to="/terms-of-service" target="_blank" onClick={e => e.stopPropagation()}>
              Terms of Service
            </Link>
            {' '}governing the use of MediBook platform.
          </p>
        </div>
      </div>

      {/* Privacy Policy — REQUIRED */}
      <div
        className={`consent-item ${consents.privacy ? 'checked' : ''}`}
        onClick={() => toggle('privacy')}
        role="checkbox"
        aria-checked={consents.privacy}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && toggle('privacy')}
      >
        <div className={`consent-checkbox ${consents.privacy ? 'checked' : ''}`}>
          {consents.privacy && <i className="bi bi-check" />}
        </div>
        <div className="consent-text">
          <h4>
            Privacy Policy
            <span className="consent-required">Required</span>
          </h4>
          <p>
            I agree to the{' '}
            <Link to="/privacy-policy" target="_blank" onClick={e => e.stopPropagation()}>
              Privacy Policy
            </Link>
            {' '}and understand how my data is collected and used.
          </p>
        </div>
      </div>

      {/* Data Processing — Optional */}
      <div
        className={`consent-item ${consents.data_processing ? 'checked' : ''}`}
        onClick={() => toggle('data_processing')}
        role="checkbox"
        aria-checked={consents.data_processing}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && toggle('data_processing')}
      >
        <div className={`consent-checkbox ${consents.data_processing ? 'checked' : ''}`}>
          {consents.data_processing && <i className="bi bi-check" />}
        </div>
        <div className="consent-text">
          <h4>Data Processing</h4>
          <p>
            I consent to the processing of my health data for appointment management and healthcare service facilitation.
          </p>
        </div>
      </div>

      {/* Marketing — Optional */}
      <div
        className={`consent-item ${consents.marketing ? 'checked' : ''}`}
        onClick={() => toggle('marketing')}
        role="checkbox"
        aria-checked={consents.marketing}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && toggle('marketing')}
      >
        <div className={`consent-checkbox ${consents.marketing ? 'checked' : ''}`}>
          {consents.marketing && <i className="bi bi-check" />}
        </div>
        <div className="consent-text">
          <h4>Marketing Communications</h4>
          <p>
            I'd like to receive health tips, platform updates, and promotional communications from MediBook.
          </p>
        </div>
      </div>

      {/* Info note */}
      <div style={{
        marginTop: 16,
        padding: '12px 16px',
        background: 'rgba(0, 119, 182, 0.05)',
        borderRadius: 10,
        borderLeft: '3px solid #0077B6',
        fontSize: 13,
        color: '#475569',
        lineHeight: 1.6
      }}>
        <i className="bi bi-info-circle" style={{ marginRight: 6, color: '#0077B6' }} />
        You can update your consent preferences at any time from your profile settings.
        Only Terms of Service and Privacy Policy are required.
      </div>
    </>
  )
}
