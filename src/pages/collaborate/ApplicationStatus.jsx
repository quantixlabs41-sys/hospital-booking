import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getApplicationByEmailAndId, getDocumentDownloadUrl, getPhotoPublicUrl } from '../../services/collaborate'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import './CollaborateApplication.css'
import './ApplicationStatus.css'

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending Review',
    icon: 'bi-clock-history',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    description: 'Your application has been received and is waiting to be reviewed by our admin team.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    icon: 'bi-eye',
    color: '#0077B6',
    bg: 'rgba(0,119,182,0.08)',
    description: 'Your application is currently being reviewed. We will notify you once a decision is made.',
  },
  APPROVED: {
    label: 'Approved',
    icon: 'bi-check-circle-fill',
    color: '#2DC653',
    bg: 'rgba(45,198,83,0.08)',
    description: 'Congratulations! Your application has been approved. You can now login to your account.',
  },
  REJECTED: {
    label: 'Rejected',
    icon: 'bi-x-circle-fill',
    color: '#EF233C',
    bg: 'rgba(239,35,60,0.08)',
    description: 'Unfortunately, your application was not approved at this time.',
  },
}

const ADMIN_EMAIL = 'admin@medibook.com'

export default function ApplicationStatus() {
  const [email, setEmail] = useState('')
  const [appId, setAppId] = useState('')
  const [loading, setLoading] = useState(false)
  const [application, setApplication] = useState(null)
  const [searched, setSearched] = useState(false)
  const [downloadingDoc, setDownloadingDoc] = useState(false)
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false)
  const [showDocViewer, setShowDocViewer] = useState(false)
  const [docViewerUrl, setDocViewerUrl] = useState(null)
  const [loadingDocView, setLoadingDocView] = useState(false)
  const printRef = useRef(null)

  async function handleLookup(e) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }
    if (!appId.trim()) {
      toast.error('Please enter your application ID')
      return
    }

    // Parse the application ID — accept formats like "123", "MB-00123", "#MB-00123"
    let parsedId = appId.trim().replace(/^#?MB-0*/i, '')
    if (!/^\d+$/.test(parsedId)) {
      toast.error('Invalid application ID format. Example: MB-00001 or 1')
      return
    }

    try {
      setLoading(true)
      const data = await getApplicationByEmailAndId(email.trim(), parseInt(parsedId))

      if (!data) {
        setApplication(null)
        setSearched(true)
        toast.error('No application found with the given email and ID')
        return
      }

      setApplication(data)
      setSearched(true)
    } catch (err) {
      console.error('Lookup error:', err)
      toast.error('Failed to look up application. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadDocument() {
    if (!application?.documents_url) return
    try {
      setDownloadingDoc(true)
      const url = await getDocumentDownloadUrl(application.documents_url)
      if (url) {
        window.open(url, '_blank')
      } else {
        toast.error('Could not generate download link. Please try again.')
      }
    } catch (err) {
      toast.error('Failed to download document')
    } finally {
      setDownloadingDoc(false)
    }
  }

  const handleViewDocument = useCallback(async () => {
    if (!application?.documents_url) return
    try {
      setLoadingDocView(true)
      const url = await getDocumentDownloadUrl(application.documents_url)
      if (url) {
        setDocViewerUrl(url)
        setShowDocViewer(true)
      } else {
        toast.error('Could not generate preview link.')
      }
    } catch (err) {
      toast.error('Failed to load document preview')
    } finally {
      setLoadingDocView(false)
    }
  }, [application])

  function getDocFileName() {
    if (!application?.documents_url) return ''
    return application.documents_url.split('/').pop()
  }

  function isDocImage() {
    const name = getDocFileName().toLowerCase()
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')
  }

  function handlePrintApplication() {
    if (!printRef.current) return

    const printContent = printRef.current.innerHTML
    const printWindow = window.open('', '_blank', 'width=800,height=900')

    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to download the application form.')
      return
    }

    const photoUrl = application?.photo_url ? getPhotoPublicUrl(application.photo_url) : null

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Application Form - #MB-${String(application.id).padStart(5, '0')}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1a1a2e;
            line-height: 1.6;
            padding: 40px;
            background: white;
          }
          .print-header {
            text-align: center;
            padding-bottom: 24px;
            border-bottom: 3px solid #0077B6;
            margin-bottom: 32px;
          }
          .print-header h1 {
            font-size: 24px;
            font-weight: 800;
            color: #0077B6;
            margin-bottom: 4px;
          }
          .print-header p {
            font-size: 13px;
            color: #666;
          }
          .print-app-id {
            display: inline-block;
            background: #f0f7ff;
            padding: 6px 16px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 14px;
            color: #0077B6;
            margin-top: 10px;
          }
          .print-status {
            text-align: center;
            margin-bottom: 24px;
            padding: 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 14px;
          }
          .print-photo {
            text-align: center;
            margin-bottom: 24px;
          }
          .print-photo img {
            width: 120px;
            height: 120px;
            border-radius: 12px;
            object-fit: cover;
            border: 3px solid #e0e0e0;
          }
          .print-section {
            margin-bottom: 24px;
          }
          .print-section-title {
            font-size: 15px;
            font-weight: 700;
            color: #0077B6;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          .print-row {
            display: flex;
            padding: 6px 0;
            border-bottom: 1px solid #f5f5f5;
          }
          .print-label {
            width: 180px;
            font-weight: 600;
            font-size: 13px;
            color: #666;
            flex-shrink: 0;
          }
          .print-value {
            flex: 1;
            font-size: 13px;
            color: #1a1a2e;
          }
          .print-footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 2px solid #f0f0f0;
            text-align: center;
            font-size: 11px;
            color: #999;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>MediBook Application Form</h1>
          <p>Collaboration Application Details</p>
          <div class="print-app-id">Application ID: #MB-${String(application.id).padStart(5, '0')}</div>
        </div>

        <div class="print-status" style="background: ${STATUS_CONFIG[application.status]?.bg || '#f5f5f5'}; color: ${STATUS_CONFIG[application.status]?.color || '#666'};">
          Status: ${STATUS_CONFIG[application.status]?.label || application.status}
        </div>

        ${photoUrl ? `
          <div class="print-photo">
            <img src="${photoUrl}" alt="Applicant Photo" />
          </div>
        ` : ''}

        <div class="print-section">
          <div class="print-section-title">Application Type</div>
          <div class="print-row">
            <span class="print-label">Type</span>
            <span class="print-value">${application.application_type === 'DOCTOR' ? 'Doctor' : 'Hospital / Clinic'}</span>
          </div>
        </div>

        <div class="print-section">
          <div class="print-section-title">Contact Information</div>
          <div class="print-row">
            <span class="print-label">Name</span>
            <span class="print-value">${application.applicant_name}</span>
          </div>
          <div class="print-row">
            <span class="print-label">Email</span>
            <span class="print-value">${application.applicant_email}</span>
          </div>
          <div class="print-row">
            <span class="print-label">Phone</span>
            <span class="print-value">${application.applicant_phone}</span>
          </div>
          ${application.departments?.name ? `
            <div class="print-row">
              <span class="print-label">Department</span>
              <span class="print-value">${application.departments.name}</span>
            </div>
          ` : ''}
        </div>

        ${application.application_type === 'DOCTOR' ? `
          <div class="print-section">
            <div class="print-section-title">Professional Details</div>
            ${application.specialization ? `<div class="print-row"><span class="print-label">Specialization</span><span class="print-value">${application.specialization}</span></div>` : ''}
            ${application.qualification ? `<div class="print-row"><span class="print-label">Qualification</span><span class="print-value">${application.qualification}</span></div>` : ''}
            ${application.experience_years != null ? `<div class="print-row"><span class="print-label">Experience</span><span class="print-value">${application.experience_years} years</span></div>` : ''}
            ${application.consultation_fee != null ? `<div class="print-row"><span class="print-label">Consultation Fee</span><span class="print-value">₹${application.consultation_fee}</span></div>` : ''}
            ${application.registration_number ? `<div class="print-row"><span class="print-label">Registration No.</span><span class="print-value">${application.registration_number}</span></div>` : ''}
          </div>
        ` : `
          <div class="print-section">
            <div class="print-section-title">Hospital Details</div>
            ${application.hospital_name ? `<div class="print-row"><span class="print-label">Hospital Name</span><span class="print-value">${application.hospital_name}</span></div>` : ''}
            ${application.hospital_type ? `<div class="print-row"><span class="print-label">Type</span><span class="print-value">${application.hospital_type.replace('_', ' ')}</span></div>` : ''}
            ${application.bed_count != null ? `<div class="print-row"><span class="print-label">Bed Count</span><span class="print-value">${application.bed_count}</span></div>` : ''}
            ${application.hospital_address ? `<div class="print-row"><span class="print-label">Address</span><span class="print-value">${application.hospital_address}${application.hospital_city ? ', ' + application.hospital_city : ''}${application.hospital_state ? ', ' + application.hospital_state : ''}${application.hospital_pincode ? ' - ' + application.hospital_pincode : ''}</span></div>` : ''}
            ${application.registration_number ? `<div class="print-row"><span class="print-label">License No.</span><span class="print-value">${application.registration_number}</span></div>` : ''}
          </div>
        `}

        ${application.bio ? `
          <div class="print-section">
            <div class="print-section-title">Bio / About</div>
            <p style="font-size: 13px; color: #444; line-height: 1.8; padding: 8px 0;">${application.bio}</p>
          </div>
        ` : ''}

        ${application.documents_url ? `
          <div class="print-section">
            <div class="print-section-title">Uploaded Documents</div>
            <div class="print-row">
              <span class="print-label">Document</span>
              <span class="print-value">${application.documents_url.split('/').pop()}</span>
            </div>
          </div>
        ` : ''}

        <div class="print-section">
          <div class="print-section-title">Timeline</div>
          <div class="print-row">
            <span class="print-label">Applied On</span>
            <span class="print-value">${formatDate(application.created_at)}</span>
          </div>
          ${application.reviewed_at ? `
            <div class="print-row">
              <span class="print-label">Reviewed On</span>
              <span class="print-value">${formatDate(application.reviewed_at)}</span>
            </div>
          ` : ''}
        </div>

        <div class="print-footer">
          <p>MediBook — Healthcare Collaboration Platform</p>
          <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            }, 500);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const statusCfg = application ? STATUS_CONFIG[application.status] : null
  const photoUrl = application?.photo_url ? getPhotoPublicUrl(application.photo_url) : null

  return (
    <div className="collaborate-page">
      <Navbar />
      <div className="collaborate-container">
        {/* ── Premium Header Banner ── */}
        <div className="status-hero">
          <div className="status-hero-glow" />
          <div className="status-hero-particles">
            <span /><span /><span /><span /><span />
          </div>
          <div className="status-hero-icon">
            <i className="bi bi-clipboard2-pulse" />
          </div>
          <h1 className="status-hero-title">Application Status</h1>
          <div className="status-hero-badge">
            <i className="bi bi-shield-lock me-1" />Secure Lookup
          </div>
          <p className="status-hero-desc">
            Track your collaboration application in real-time. Enter your details below.
          </p>
        </div>

        {/* ── Lookup Form Card ── */}
        <div className="status-lookup-card">
          <div className="status-lookup-header">
            <div className="status-lookup-icon">
              <i className="bi bi-search" />
            </div>
            <div>
              <h3 className="status-lookup-title">Track Your Application</h3>
              <p className="status-lookup-subtitle">
                Enter your registered email and application ID to view your status
              </p>
            </div>
          </div>

          <form onSubmit={handleLookup} className="status-lookup-form">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label-custom required">Email Address</label>
                <div className="search-input-wrapper">
                  <i className="bi bi-envelope" />
                  <input
                    type="email"
                    className="form-input-custom"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    maxLength={254}
                    style={{ paddingLeft: 42 }}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label-custom required">Application ID</label>
                <div className="search-input-wrapper">
                  <i className="bi bi-hash" />
                  <input
                    type="text"
                    className="form-input-custom"
                    placeholder="MB-00001"
                    value={appId}
                    onChange={e => setAppId(e.target.value)}
                    maxLength={20}
                    style={{ paddingLeft: 42 }}
                  />
                </div>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button
                  type="submit"
                  className="btn-primary-custom w-100"
                  disabled={loading}
                  style={{ height: 48 }}
                >
                  {loading ? (
                    <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Searching...</>
                  ) : (
                    <><i className="bi bi-search me-2" />Check Status</>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Helper text */}
          <div className="status-lookup-help">
            <i className="bi bi-info-circle" />
            Don't have an Application ID? <Link to="/collaborate" style={{ fontWeight: 700, color: 'var(--primary)' }}>Submit a new application</Link>
          </div>
        </div>

        {/* No Results */}
        {searched && !application && (
          <div className="status-no-result">
            <i className="bi bi-inbox" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
            <h4>Application Not Found</h4>
            <p>
              No application matches the provided email and ID. Please check your details
              and try again, or <Link to="/collaborate">submit a new application</Link>.
            </p>
          </div>
        )}

        {/* Application Details */}
        {application && (
          <div className="status-result" ref={printRef}>
            {/* Status Banner */}
            <div className="status-banner" style={{ background: statusCfg?.bg, borderColor: statusCfg?.color }}>
              <div className="status-banner-icon" style={{ color: statusCfg?.color }}>
                <i className={`bi ${statusCfg?.icon}`} />
              </div>
              <div className="status-banner-content">
                <div className="status-banner-label" style={{ color: statusCfg?.color }}>
                  {statusCfg?.label}
                </div>
                <p className="status-banner-desc">{statusCfg?.description}</p>
              </div>
              <div className="status-banner-id">
                #MB-{String(application.id).padStart(5, '0')}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="status-actions">
              <button className="btn-primary-custom" onClick={handlePrintApplication}>
                <i className="bi bi-download me-2" />Download Application Form
              </button>
              {application.documents_url && (
                <button
                  className="btn-outline-custom"
                  onClick={handleDownloadDocument}
                  disabled={downloadingDoc}
                >
                  {downloadingDoc ? (
                    <><div className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} /> Downloading...</>
                  ) : (
                    <><i className="bi bi-file-earmark-arrow-down me-2" />Download Documents</>
                  )}
                </button>
              )}
            </div>

            {/* Photo + Type */}
            <div className="status-identity-row">
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="Applicant"
                  className="status-photo status-photo-clickable"
                  onClick={() => setShowPhotoLightbox(true)}
                  title="Click to view full photo"
                />
              )}
              <div>
                <h4 className="status-name">
                  {application.application_type === 'DOCTOR' ? 'Dr. ' : ''}{application.applicant_name}
                </h4>
                <span className="status-type-badge" style={{
                  background: application.application_type === 'DOCTOR' ? 'rgba(0,119,182,0.08)' : 'rgba(76,201,240,0.08)',
                  color: application.application_type === 'DOCTOR' ? 'var(--primary)' : 'var(--info, #4CC9F0)'
                }}>
                  <i className={`bi ${application.application_type === 'DOCTOR' ? 'bi-person-badge' : 'bi-hospital'} me-1`} />
                  {application.application_type === 'DOCTOR' ? 'Doctor' : 'Hospital / Clinic'}
                </span>
              </div>
            </div>

            {/* Applicant Photo Section */}
            {photoUrl && (
              <div className="status-section">
                <div className="status-section-title">
                  <i className="bi bi-camera" />Applicant Photo
                </div>
                <div className="status-photo-card">
                  <img
                    src={photoUrl}
                    alt="Applicant photo"
                    className="status-photo-large"
                    onClick={() => setShowPhotoLightbox(true)}
                  />
                  <div className="status-photo-info">
                    <div className="status-photo-filename">
                      <i className="bi bi-image me-2" />
                      {application.photo_url?.split('/').pop() || 'photo'}
                    </div>
                    <button
                      className="status-photo-view-btn"
                      onClick={() => setShowPhotoLightbox(true)}
                    >
                      <i className="bi bi-arrows-fullscreen me-1" />View Full Size
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="status-section">
              <div className="status-section-title">
                <i className="bi bi-person-circle" />Contact Information
              </div>
              <div className="status-grid">
                <div className="status-field">
                  <span className="status-label">Full Name</span>
                  <span className="status-value">{application.applicant_name}</span>
                </div>
                <div className="status-field">
                  <span className="status-label">Email</span>
                  <span className="status-value">{application.applicant_email}</span>
                </div>
                <div className="status-field">
                  <span className="status-label">Phone</span>
                  <span className="status-value">{application.applicant_phone}</span>
                </div>
                {application.departments?.name && (
                  <div className="status-field">
                    <span className="status-label">Department</span>
                    <span className="status-value">{application.departments.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Details (Doctor) */}
            {application.application_type === 'DOCTOR' && (
              <div className="status-section">
                <div className="status-section-title">
                  <i className="bi bi-briefcase" />Professional Details
                </div>
                <div className="status-grid">
                  {application.specialization && (
                    <div className="status-field">
                      <span className="status-label">Specialization</span>
                      <span className="status-value">{application.specialization}</span>
                    </div>
                  )}
                  {application.qualification && (
                    <div className="status-field">
                      <span className="status-label">Qualification</span>
                      <span className="status-value">{application.qualification}</span>
                    </div>
                  )}
                  {application.experience_years != null && (
                    <div className="status-field">
                      <span className="status-label">Experience</span>
                      <span className="status-value">{application.experience_years} years</span>
                    </div>
                  )}
                  {application.consultation_fee != null && (
                    <div className="status-field">
                      <span className="status-label">Consultation Fee</span>
                      <span className="status-value">₹{application.consultation_fee}</span>
                    </div>
                  )}
                  {application.registration_number && (
                    <div className="status-field">
                      <span className="status-label">Registration No.</span>
                      <span className="status-value" style={{ fontFamily: 'monospace' }}>{application.registration_number}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hospital Details */}
            {application.application_type === 'HOSPITAL' && (
              <div className="status-section">
                <div className="status-section-title">
                  <i className="bi bi-hospital" />Hospital Details
                </div>
                <div className="status-grid">
                  {application.hospital_name && (
                    <div className="status-field">
                      <span className="status-label">Hospital Name</span>
                      <span className="status-value">{application.hospital_name}</span>
                    </div>
                  )}
                  {application.hospital_type && (
                    <div className="status-field">
                      <span className="status-label">Type</span>
                      <span className="status-value">{application.hospital_type.replace('_', ' ')}</span>
                    </div>
                  )}
                  {application.bed_count != null && (
                    <div className="status-field">
                      <span className="status-label">Bed Count</span>
                      <span className="status-value">{application.bed_count}</span>
                    </div>
                  )}
                  {application.hospital_address && (
                    <div className="status-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="status-label">Address</span>
                      <span className="status-value">
                        {application.hospital_address}
                        {application.hospital_city ? `, ${application.hospital_city}` : ''}
                        {application.hospital_state ? `, ${application.hospital_state}` : ''}
                        {application.hospital_pincode ? ` - ${application.hospital_pincode}` : ''}
                      </span>
                    </div>
                  )}
                  {application.registration_number && (
                    <div className="status-field">
                      <span className="status-label">License No.</span>
                      <span className="status-value" style={{ fontFamily: 'monospace' }}>{application.registration_number}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bio */}
            {application.bio && (
              <div className="status-section">
                <div className="status-section-title">
                  <i className="bi bi-file-text" />Bio / About
                </div>
                <p className="status-bio">{application.bio}</p>
              </div>
            )}

            {/* Documents */}
            {application.documents_url && (
              <div className="status-section">
                <div className="status-section-title">
                  <i className="bi bi-paperclip" />Uploaded Documents
                </div>
                <div className="status-document-card">
                  <div className="status-doc-icon-wrapper">
                    <i className={`bi ${isDocImage() ? 'bi-file-earmark-image' : 'bi-file-earmark-pdf'}`} />
                  </div>
                  <div className="status-doc-details">
                    <span className="status-doc-name">{getDocFileName()}</span>
                    <span className="status-doc-type">
                      {isDocImage() ? 'Image Document' : 'PDF Document'}
                    </span>
                  </div>
                  <div className="status-doc-actions">
                    <button
                      className="status-doc-btn status-doc-btn-view"
                      onClick={handleViewDocument}
                      disabled={loadingDocView}
                    >
                      {loadingDocView ? (
                        <><div className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading...</>
                      ) : (
                        <><i className="bi bi-eye me-1" />View</>
                      )}
                    </button>
                    <button
                      className="status-doc-btn status-doc-btn-download"
                      onClick={handleDownloadDocument}
                      disabled={downloadingDoc}
                    >
                      {downloadingDoc ? (
                        <><div className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} /> Downloading...</>
                      ) : (
                        <><i className="bi bi-download me-1" />Download</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Approved — Credentials Info */}
            {application.status === 'APPROVED' && (
              <div className="status-section status-credentials-section">
                <div className="status-section-title" style={{ color: '#2DC653', borderColor: 'rgba(45,198,83,0.2)' }}>
                  <i className="bi bi-shield-lock" />Account Credentials
                </div>
                <div className="status-credential-box">
                  <div className="status-field">
                    <span className="status-label">Login Email</span>
                    <span className="status-value" style={{ fontWeight: 700 }}>{application.applicant_email}</span>
                  </div>
                  <div className="status-field">
                    <span className="status-label">Password</span>
                    <span className="status-value" style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>
                      Set by admin — contact for details
                    </span>
                  </div>
                </div>
                <div className="status-admin-contact">
                  <i className="bi bi-envelope me-2" style={{ color: 'var(--primary)' }} />
                  <span>
                    For your login password, please contact the admin at{' '}
                    <a href={`mailto:${ADMIN_EMAIL}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {ADMIN_EMAIL}
                    </a>
                  </span>
                </div>
                <div className="status-login-cta">
                  <Link to="/login" className="btn-primary-custom">
                    <i className="bi bi-box-arrow-in-right me-2" />Go to Login
                  </Link>
                </div>
              </div>
            )}

            {/* Rejected — Reason */}
            {application.status === 'REJECTED' && application.rejection_reason && (
              <div className="status-section status-rejected-section">
                <div className="status-section-title" style={{ color: '#EF233C', borderColor: 'rgba(239,35,60,0.2)' }}>
                  <i className="bi bi-x-circle" />Rejection Reason
                </div>
                <p className="status-rejection-text">{application.rejection_reason}</p>
                <div className="status-admin-contact" style={{ marginTop: 12 }}>
                  <i className="bi bi-envelope me-2" style={{ color: 'var(--primary)' }} />
                  <span>
                    If you have questions, contact the admin at{' '}
                    <a href={`mailto:${ADMIN_EMAIL}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {ADMIN_EMAIL}
                    </a>
                  </span>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="status-section">
              <div className="status-section-title">
                <i className="bi bi-clock-history" />Timeline
              </div>
              <div className="status-timeline">
                <div className="timeline-item completed">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <span className="timeline-label">Application Submitted</span>
                    <span className="timeline-date">{formatDate(application.created_at)}</span>
                  </div>
                </div>
                {(application.status === 'UNDER_REVIEW' || application.status === 'APPROVED' || application.status === 'REJECTED') && (
                  <div className="timeline-item completed">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <span className="timeline-label">Review Started</span>
                      <span className="timeline-date">{application.reviewed_at ? formatDate(application.reviewed_at) : 'In progress'}</span>
                    </div>
                  </div>
                )}
                {application.status === 'APPROVED' && (
                  <div className="timeline-item completed success">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <span className="timeline-label">Application Approved</span>
                      <span className="timeline-date">{formatDate(application.reviewed_at)}</span>
                    </div>
                  </div>
                )}
                {application.status === 'REJECTED' && (
                  <div className="timeline-item completed rejected">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <span className="timeline-label">Application Rejected</span>
                      <span className="timeline-date">{formatDate(application.reviewed_at)}</span>
                    </div>
                  </div>
                )}
                {application.status === 'PENDING' && (
                  <div className="timeline-item pending">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <span className="timeline-label">Awaiting Admin Review</span>
                      <span className="timeline-date">Estimated: 1-3 business days</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Photo Lightbox Modal ── */}
        {showPhotoLightbox && photoUrl && (
          <div className="status-lightbox-overlay" onClick={() => setShowPhotoLightbox(false)}>
            <div className="status-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="status-lightbox-close" onClick={() => setShowPhotoLightbox(false)}>
                <i className="bi bi-x-lg" />
              </button>
              <img src={photoUrl} alt="Applicant photo - full size" className="status-lightbox-img" />
              <div className="status-lightbox-caption">
                <i className="bi bi-person-circle me-2" />
                {application?.applicant_name} — Applicant Photo
              </div>
            </div>
          </div>
        )}

        {/* ── Document Viewer Modal ── */}
        {showDocViewer && docViewerUrl && (
          <div className="status-lightbox-overlay" onClick={() => setShowDocViewer(false)}>
            <div className="status-docviewer-content" onClick={e => e.stopPropagation()}>
              <div className="status-docviewer-header">
                <div className="status-docviewer-title">
                  <i className={`bi ${isDocImage() ? 'bi-file-earmark-image' : 'bi-file-earmark-pdf'} me-2`} />
                  {getDocFileName()}
                </div>
                <div className="status-docviewer-actions">
                  <a
                    href={docViewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="status-doc-btn status-doc-btn-download"
                    style={{ textDecoration: 'none' }}
                  >
                    <i className="bi bi-box-arrow-up-right me-1" />Open in New Tab
                  </a>
                  <button className="status-lightbox-close" onClick={() => setShowDocViewer(false)}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
              <div className="status-docviewer-body">
                {isDocImage() ? (
                  <img src={docViewerUrl} alt="Document preview" className="status-docviewer-img" />
                ) : (
                  <iframe
                    src={docViewerUrl}
                    title="Document viewer"
                    className="status-docviewer-iframe"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="d-flex justify-content-center mt-4 gap-3">
          <Link to="/collaborate" className="btn-outline-custom" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
            <i className="bi bi-pencil-square me-2" />Submit New Application
          </Link>
          <Link to="/" className="btn-outline-custom" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
            <i className="bi bi-house me-2" />Back to Home
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
