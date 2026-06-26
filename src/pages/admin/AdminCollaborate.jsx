import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import {
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  approveApplication,
  rejectApplication,
  getApplicationStats
} from '../../services/collaborate'
import { getDepartments } from '../../services/admin'
import { SkeletonTable } from '../../components/SkeletonLoader'
import { getPasswordStrength, RULES } from '../../security/validators'
import '../../pages/collaborate/CollaborateApplication.css'

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', badge: 'badge-pending', icon: 'bi-clock', color: '#F59E0B' },
  UNDER_REVIEW: { label: 'Under Review', badge: 'badge-confirmed', icon: 'bi-eye', color: '#0077B6' },
  APPROVED: { label: 'Approved', badge: 'badge-confirmed', icon: 'bi-check-circle', color: '#2DC653' },
  REJECTED: { label: 'Rejected', badge: 'badge-cancelled', icon: 'bi-x-circle', color: '#EF233C' },
}

export default function AdminCollaborate() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, under_review: 0, approved: 0, rejected: 0 })

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  // Detail drawer
  const [selectedApp, setSelectedApp] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  // Approve modal
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approvePassword, setApprovePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [approving, setApproving] = useState(false)

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    loadData()
  }, [statusFilter, typeFilter])

  async function loadData() {
    try {
      setLoading(true)
      const filters = {}
      if (statusFilter !== 'ALL') filters.status = statusFilter
      if (typeFilter) filters.application_type = typeFilter
      if (search.trim()) filters.search = search.trim()

      const [apps, s, depts] = await Promise.all([
        getApplications(filters),
        getApplicationStats(),
        getDepartments()
      ])
      setApplications(apps)
      setStats(s)
      setDepartments(depts)
    } catch (err) {
      toast.error('Failed to load applications')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e?.preventDefault()
    loadData()
  }

  async function handleStartReview(app) {
    try {
      await updateApplicationStatus(app.id, 'UNDER_REVIEW', user.id)
      toast.success('Application moved to Under Review')
      loadData()
      if (showDetail) {
        const updated = await getApplicationById(app.id)
        setSelectedApp(updated)
      }
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  async function openDetail(app) {
    try {
      const detail = await getApplicationById(app.id)
      setSelectedApp(detail)
      setShowDetail(true)
    } catch {
      toast.error('Failed to load application details')
    }
  }

  function closeDetail() {
    setShowDetail(false)
    setSelectedApp(null)
  }

  // ── Approve Flow ──
  function openApproveModal() {
    setApprovePassword('')
    setShowPassword(false)
    setShowApproveModal(true)
  }

  async function handleApprove() {
    if (!approvePassword) {
      toast.error('Please set a password for the new account')
      return
    }
    if (approvePassword.length < RULES.password.minLength) {
      toast.error(`Password must be at least ${RULES.password.minLength} characters`)
      return
    }
    if (!RULES.password.pattern.test(approvePassword)) {
      toast.error('Password must include uppercase, lowercase, number, and special character')
      return
    }

    try {
      setApproving(true)
      const result = await approveApplication(selectedApp.id, approvePassword, user.id)
      toast.success(`Account created for ${result.email}! Login credentials are active.`)
      setShowApproveModal(false)
      closeDetail()
      loadData()
    } catch (err) {
      console.error('Approval error:', err)
      toast.error(err.message || 'Failed to approve application')
    } finally {
      setApproving(false)
    }
  }

  // ── Reject Flow ──
  function openRejectModal() {
    setRejectReason('')
    setShowRejectModal(true)
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      setRejecting(true)
      await rejectApplication(selectedApp.id, rejectReason, user.id)
      toast.success('Application rejected')
      setShowRejectModal(false)
      closeDetail()
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to reject application')
    } finally {
      setRejecting(false)
    }
  }

  const strength = getPasswordStrength(approvePassword)

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  // ── Loading State ──
  if (loading) return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-2)' }} />
          <div className="skeleton skeleton-text short" />
        </div>
      </div>
      <div className="d-flex gap-2 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ width: 100, height: 38, borderRadius: 'var(--radius-full)' }} />
        ))}
      </div>
      <SkeletonTable rows={6} cols={6} />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            <i className="bi bi-people me-2 text-primary" />Collaborate Applications
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Review and approve doctor & hospital applications
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div style={{
            padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: 13,
            fontWeight: 700, background: 'rgba(249,199,79,0.12)', color: '#D97706'
          }}>
            <i className="bi bi-clock me-1" />{stats.pending} Pending
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="collab-status-tabs">
        {[
          { key: 'ALL', label: 'All', count: stats.total },
          { key: 'PENDING', label: 'Pending', count: stats.pending },
          { key: 'UNDER_REVIEW', label: 'Under Review', count: stats.under_review },
          { key: 'APPROVED', label: 'Approved', count: stats.approved },
          { key: 'REJECTED', label: 'Rejected', count: stats.rejected },
        ].map(tab => (
          <button
            key={tab.key}
            className={`collab-status-tab ${statusFilter === tab.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div className="card-custom p-3 mb-4">
        <div className="d-flex gap-3 flex-wrap">
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 220 }}>
            <i className="bi bi-search" />
            <form onSubmit={handleSearch}>
              <input
                type="text"
                className="form-input-custom"
                placeholder="Search by name, email, or hospital..."
                style={{ paddingLeft: 42 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onBlur={handleSearch}
                maxLength={100}
              />
            </form>
          </div>
          <select
            className="form-input-custom"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Types</option>
            <option value="DOCTOR">Doctors</option>
            <option value="HOSPITAL">Hospitals</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="card-custom">
          <div className="empty-state" style={{ padding: 48 }}>
            <i className="bi bi-inbox" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
            <p style={{ fontWeight: 600, color: 'var(--gray-500)', marginTop: 16 }}>No applications found</p>
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              {statusFilter !== 'ALL' ? 'Try changing the status filter' : 'Applications will appear here when submitted'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card-custom p-3">
          {applications.map(app => (
            <div key={app.id} className="collab-app-card" onClick={() => openDetail(app)}>
              <div className="app-card-header">
                <div className={`app-avatar ${app.application_type === 'DOCTOR' ? 'doctor' : 'hospital'}`}>
                  <i className={`bi ${app.application_type === 'DOCTOR' ? 'bi-person-badge' : 'bi-hospital'}`} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--dark)' }}>
                      {app.application_type === 'DOCTOR' ? 'Dr. ' : ''}{app.applicant_name}
                    </span>
                    <span className={STATUS_CONFIG[app.status]?.badge || 'badge-pending'}
                      style={{ fontSize: 11, padding: '2px 10px' }}>
                      {STATUS_CONFIG[app.status]?.label || app.status}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: app.application_type === 'DOCTOR' ? 'rgba(0,119,182,0.08)' : 'rgba(76,201,240,0.08)',
                      color: app.application_type === 'DOCTOR' ? 'var(--primary)' : 'var(--info)'
                    }}>
                      {app.application_type}
                    </span>
                  </div>
                  <div className="app-card-meta mt-1">
                    <span><i className="bi bi-envelope" />{app.applicant_email}</span>
                    <span><i className="bi bi-telephone" />{app.applicant_phone}</span>
                    {app.specialization && <span><i className="bi bi-activity" />{app.specialization}</span>}
                    {app.hospital_name && <span><i className="bi bi-hospital" />{app.hospital_name}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {formatDate(app.created_at)}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    #MB-{String(app.id).padStart(5, '0')}
                  </span>
                </div>
              </div>

              {/* Quick action for pending apps */}
              {app.status === 'PENDING' && (
                <div className="d-flex gap-2 mt-2" style={{ paddingLeft: 58 }}>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 14px', fontSize: 12, color: 'var(--primary)' }}
                    onClick={e => { e.stopPropagation(); handleStartReview(app) }}
                  >
                    <i className="bi bi-eye me-1" />Start Review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {showDetail && selectedApp && (
        <>
          <div className="overlay" onClick={closeDetail} />
          <div className="collab-detail-modal">
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0, fontSize: 18 }}>
                  Application Details
                </h5>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  #MB-{String(selectedApp.id).padStart(5, '0')}
                </span>
              </div>
              <button className="btn-ghost" onClick={closeDetail} style={{ padding: 8 }}>
                <i className="bi bi-x-lg" style={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* Status Badge */}
              <div className="d-flex align-items-center gap-3 mb-4">
                <span className={STATUS_CONFIG[selectedApp.status]?.badge || 'badge-pending'}
                  style={{ fontSize: 13, padding: '6px 16px' }}>
                  <i className={`bi ${STATUS_CONFIG[selectedApp.status]?.icon} me-1`} />
                  {STATUS_CONFIG[selectedApp.status]?.label}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedApp.application_type === 'DOCTOR' ? 'rgba(0,119,182,0.08)' : 'rgba(76,201,240,0.08)',
                  color: selectedApp.application_type === 'DOCTOR' ? 'var(--primary)' : 'var(--info)'
                }}>
                  <i className={`bi ${selectedApp.application_type === 'DOCTOR' ? 'bi-person-badge' : 'bi-hospital'} me-1`} />
                  {selectedApp.application_type}
                </span>
              </div>

              {/* Contact Info */}
              <div className="detail-section">
                <div className="detail-section-title">Contact Information</div>
                <div className="detail-row">
                  <span className="detail-label">Full Name</span>
                  <span className="detail-value">{selectedApp.applicant_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedApp.applicant_email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{selectedApp.applicant_phone}</span>
                </div>
                {selectedApp.departments?.name && (
                  <div className="detail-row">
                    <span className="detail-label">Department</span>
                    <span className="detail-value">{selectedApp.departments.name}</span>
                  </div>
                )}
              </div>

              {/* Doctor Details */}
              {selectedApp.application_type === 'DOCTOR' && (
                <div className="detail-section">
                  <div className="detail-section-title">Professional Details</div>
                  {selectedApp.specialization && (
                    <div className="detail-row">
                      <span className="detail-label">Specialization</span>
                      <span className="detail-value">{selectedApp.specialization}</span>
                    </div>
                  )}
                  {selectedApp.qualification && (
                    <div className="detail-row">
                      <span className="detail-label">Qualification</span>
                      <span className="detail-value">{selectedApp.qualification}</span>
                    </div>
                  )}
                  {selectedApp.experience_years != null && (
                    <div className="detail-row">
                      <span className="detail-label">Experience</span>
                      <span className="detail-value">{selectedApp.experience_years} years</span>
                    </div>
                  )}
                  {selectedApp.consultation_fee != null && (
                    <div className="detail-row">
                      <span className="detail-label">Consultation Fee</span>
                      <span className="detail-value">₹{selectedApp.consultation_fee}</span>
                    </div>
                  )}
                  {selectedApp.registration_number && (
                    <div className="detail-row">
                      <span className="detail-label">Registration No.</span>
                      <span className="detail-value" style={{ fontFamily: 'monospace' }}>{selectedApp.registration_number}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hospital Details */}
              {selectedApp.application_type === 'HOSPITAL' && (
                <div className="detail-section">
                  <div className="detail-section-title">Hospital Details</div>
                  {selectedApp.hospital_name && (
                    <div className="detail-row">
                      <span className="detail-label">Hospital Name</span>
                      <span className="detail-value">{selectedApp.hospital_name}</span>
                    </div>
                  )}
                  {selectedApp.hospital_type && (
                    <div className="detail-row">
                      <span className="detail-label">Type</span>
                      <span className="detail-value">{selectedApp.hospital_type.replace('_', ' ')}</span>
                    </div>
                  )}
                  {selectedApp.bed_count != null && (
                    <div className="detail-row">
                      <span className="detail-label">Bed Count</span>
                      <span className="detail-value">{selectedApp.bed_count}</span>
                    </div>
                  )}
                  {selectedApp.hospital_address && (
                    <div className="detail-row">
                      <span className="detail-label">Address</span>
                      <span className="detail-value">
                        {selectedApp.hospital_address}
                        {selectedApp.hospital_city ? `, ${selectedApp.hospital_city}` : ''}
                        {selectedApp.hospital_state ? `, ${selectedApp.hospital_state}` : ''}
                        {selectedApp.hospital_pincode ? ` - ${selectedApp.hospital_pincode}` : ''}
                      </span>
                    </div>
                  )}
                  {selectedApp.registration_number && (
                    <div className="detail-row">
                      <span className="detail-label">License No.</span>
                      <span className="detail-value" style={{ fontFamily: 'monospace' }}>{selectedApp.registration_number}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bio */}
              {selectedApp.bio && (
                <div className="detail-section">
                  <div className="detail-section-title">Bio / About</div>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--gray-600)', margin: 0 }}>
                    {selectedApp.bio}
                  </p>
                </div>
              )}

              {/* Documents */}
              {selectedApp.documents_url && (
                <div className="detail-section">
                  <div className="detail-section-title">Uploaded Documents</div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                    <i className="bi bi-file-earmark-medical" />
                    <span>{selectedApp.documents_url.split('/').pop()}</span>
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedApp.status === 'REJECTED' && selectedApp.rejection_reason && (
                <div className="detail-section" style={{ background: 'rgba(239,35,60,0.05)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                  <div className="detail-section-title" style={{ color: '#EF233C', borderColor: 'rgba(239,35,60,0.15)' }}>
                    <i className="bi bi-x-circle" />Rejection Reason
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--gray-600)', margin: 0 }}>
                    {selectedApp.rejection_reason}
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div className="detail-section">
                <div className="detail-section-title">Timeline</div>
                <div className="detail-row">
                  <span className="detail-label">Applied</span>
                  <span className="detail-value">{formatDate(selectedApp.created_at)}</span>
                </div>
                {selectedApp.reviewed_at && (
                  <div className="detail-row">
                    <span className="detail-label">Reviewed</span>
                    <span className="detail-value">{formatDate(selectedApp.reviewed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            {(selectedApp.status === 'PENDING' || selectedApp.status === 'UNDER_REVIEW') && (
              <div className="modal-actions">
                {selectedApp.status === 'PENDING' && (
                  <button
                    className="btn-outline-custom flex-fill justify-content-center"
                    style={{ fontSize: 13 }}
                    onClick={() => handleStartReview(selectedApp)}
                  >
                    <i className="bi bi-eye me-1" />Start Review
                  </button>
                )}
                <button
                  className="btn-ghost flex-fill justify-content-center"
                  style={{ fontSize: 13, color: 'var(--danger)', borderColor: 'rgba(239,35,60,0.2)' }}
                  onClick={openRejectModal}
                >
                  <i className="bi bi-x-circle me-1" />Reject
                </button>
                <button
                  className="btn-primary-custom flex-fill justify-content-center"
                  style={{ fontSize: 13 }}
                  onClick={openApproveModal}
                >
                  <i className="bi bi-check-circle me-1" />Approve & Create Account
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Approve Modal — Set Credentials ── */}
      {showApproveModal && selectedApp && (
        <div className="credential-modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="credential-modal" onClick={e => e.stopPropagation()}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>
              <i className="bi bi-shield-lock me-2 text-primary" />Set Login Credentials
            </h5>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
              Create a login account for <strong>{selectedApp.applicant_name}</strong>.
              The email will be used as the username.
            </p>

            {/* Email (readonly) */}
            <div className="mb-3">
              <label className="form-label-custom">Username (Email)</label>
              <input
                type="text"
                className="form-input-custom"
                value={selectedApp.applicant_email}
                disabled
                style={{ background: 'var(--gray-50)', cursor: 'not-allowed' }}
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="form-label-custom required">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input-custom"
                  placeholder="Set a strong password"
                  value={approvePassword}
                  onChange={e => setApprovePassword(e.target.value)}
                  maxLength={128}
                  style={{ paddingRight: 44 }}
                  autoFocus
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
              {approvePassword && (
                <div className="mt-2">
                  <div className="password-strength-meter">
                    <div className="password-strength-fill" style={{ width: `${(strength.level / 5) * 100}%`, background: strength.color }} />
                  </div>
                  <span className="password-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div style={{
              background: 'rgba(0,119,182,0.05)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.7, marginBottom: 24
            }}>
              <i className="bi bi-info-circle me-1 text-primary" />
              Upon approval, a new {selectedApp.application_type.toLowerCase()} account will be created.
              The applicant can login with the email and password you set here.
            </div>

            <div className="d-flex gap-3">
              <button
                className="btn-ghost flex-fill justify-content-center"
                onClick={() => setShowApproveModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary-custom flex-fill justify-content-center"
                onClick={handleApprove}
                disabled={approving || !approvePassword}
              >
                {approving ? (
                  <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Creating...</>
                ) : (
                  <><i className="bi bi-check-circle me-1" />Approve & Create</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && selectedApp && (
        <div className="credential-modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="credential-modal" onClick={e => e.stopPropagation()}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6, color: 'var(--danger)' }}>
              <i className="bi bi-x-circle me-2" />Reject Application
            </h5>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
              Rejecting application from <strong>{selectedApp.applicant_name}</strong>.
              Please provide a reason for the rejection.
            </p>

            <div className="mb-3">
              <label className="form-label-custom required">Rejection Reason</label>
              <textarea
                className="form-input-custom"
                rows={3}
                placeholder="Explain why this application is being rejected..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                maxLength={1000}
                autoFocus
                style={{ resize: 'vertical', minHeight: 80 }}
              />
            </div>

            <div className="d-flex gap-3">
              <button
                className="btn-ghost flex-fill justify-content-center"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary-custom flex-fill justify-content-center"
                style={{ background: 'var(--danger)' }}
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
              >
                {rejecting ? (
                  <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Rejecting...</>
                ) : (
                  <><i className="bi bi-x-circle me-1" />Reject Application</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
