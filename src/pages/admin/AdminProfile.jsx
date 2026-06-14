import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getProfile, updateProfile, uploadAvatar, deleteAvatar } from '../../services/profiles'
import { toast } from 'react-toastify'
import AvatarUpload from '../../components/AvatarUpload'
import PasswordChange from '../../components/PasswordChange'
import ProfileTabs from '../../components/ProfileTabs'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validateField, validatePhone } from '../../security/validators'

export default function AdminProfile() {
  const { user, profile: authProfile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const [profileData, setProfileData] = useState({
    name: '', phone: '', bio: '', avatar_url: null
  })

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    try {
      setLoading(true)
      const data = await getProfile(user.id)
      setProfileData({
        name: data.name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || null
      })
    } catch (err) {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    const errs = {}
    const nameResult = validateField('name', profileData.name, { required: true })
    if (!nameResult.valid) errs.name = nameResult.message
    const phoneResult = validatePhone(profileData.phone)
    if (!phoneResult.valid) errs.phone = phoneResult.message
    const bioResult = validateField('bio', profileData.bio)
    if (!bioResult.valid) errs.bio = bioResult.message
    if (Object.keys(errs).length > 0) {
      Object.values(errs).forEach(msg => toast.error(msg))
      return
    }
    try {
      setSaving(true)
      await updateProfile(user.id, {
        name: profileData.name.trim(),
        phone: profileData.phone.trim(),
        bio: profileData.bio.trim()
      })
      await refreshProfile()
      toast.success('Profile updated!')
    } catch (err) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(file) {
    try {
      setUploading(true)
      const url = await uploadAvatar(user.id, file)
      setProfileData(prev => ({ ...prev, avatar_url: url }))
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
      setProfileData(prev => ({ ...prev, avatar_url: null }))
      await refreshProfile()
      toast.success('Photo removed')
    } catch (err) {
      toast.error('Failed to remove photo')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading profile..." />

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          My Profile
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Manage your administrator account settings
        </p>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="card-custom card-static p-4 text-center">
            <div className="d-flex justify-content-center mb-3">
              <AvatarUpload
                currentUrl={profileData.avatar_url}
                name={profileData.name}
                size={100}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                uploading={uploading}
              />
            </div>
            <div className="profile-card-info">
              <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>
                {profileData.name || 'Administrator'}
              </h5>
            </div>
            <span style={{
              background: 'rgba(3,4,94,0.1)', color: 'var(--dark)',
              padding: '4px 12px', borderRadius: 'var(--radius-full)',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase'
            }}>
              Administrator
            </span>

            <hr className="divider" />

            <div className="d-flex flex-column gap-2 text-start profile-card-info">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-envelope" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">{user?.email}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-telephone" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">{profileData.phone || '—'}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-calendar3" style={{ color: 'var(--gray-400)', width: 20, flexShrink: 0 }} />
                <span className="profile-contact-text">
                  Joined {authProfile?.created_at
                    ? new Date(authProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : '—'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Area */}
        <div className="col-lg-8">
          <ProfileTabs
            tabs={['Account Details', 'Security']}
            activeTab={activeTab}
            onChange={setActiveTab}
            icons={['bi-person-gear', 'bi-shield-lock']}
          />

          {/* Tab 1: Account Details */}
          {activeTab === 0 && (
            <div className="card-custom p-4 mt-3 animate-fadeInUp">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                <i className="bi bi-pencil-square me-2 text-primary" />
                Edit Account Details
              </h6>
              <form onSubmit={handleSave}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label-custom" htmlFor="admin-profile-name">Full Name *</label>
                    <input
                      id="admin-profile-name"
                      type="text"
                      className="form-input-custom"
                      value={profileData.name}
                      onChange={e => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom" htmlFor="admin-profile-phone">Phone</label>
                    <input
                      id="admin-profile-phone"
                      type="tel"
                      className="form-input-custom"
                      placeholder="+91 98765 43210"
                      value={profileData.phone}
                      onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      maxLength={15}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label-custom" htmlFor="admin-profile-bio">Bio / Notes</label>
                    <textarea
                      id="admin-profile-bio"
                      className="form-input-custom"
                      rows={3}
                      placeholder="A short bio or administrative notes..."
                      value={profileData.bio}
                      onChange={e => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                      maxLength={500}
                    />
                    <div className={`char-counter ${profileData.bio.length > 450 ? (profileData.bio.length > 490 ? 'danger' : 'warning') : ''}`}>
                      {profileData.bio.length}/500
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-4">
                  <button type="submit" className="btn-primary-custom" disabled={saving}>
                    {saving ? (
                      <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                    ) : (
                      <><i className="bi bi-check-lg" /> Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Security */}
          {activeTab === 1 && (
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
                  Session Information
                </h6>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Email</span>
                    <span style={{ fontWeight: 600 }}>{user?.email}</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Role</span>
                    <span style={{
                      background: 'rgba(3,4,94,0.1)', color: 'var(--dark)',
                      padding: '2px 10px', borderRadius: 'var(--radius-full)',
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase'
                    }}>Administrator</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Status</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                      <i className="bi bi-check-circle-fill me-1" />Active
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
