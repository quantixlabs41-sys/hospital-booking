import { Link, useLocation } from 'react-router-dom'

/**
 * Auto-generated breadcrumbs from route path.
 * Per Priority 9 (breadcrumb-web) — shown for 3+ level pages.
 *
 * Route label map converts URL segments to readable names.
 * Example: /admin/doctors -> Admin > Doctors
 */
const LABEL_MAP = {
  admin: 'Admin',
  doctor: 'Doctor Portal',
  patient: 'Patient',
  dashboard: 'Dashboard',
  doctors: 'Doctors',
  patients: 'Patients',
  appointments: 'Appointments',
  reports: 'Reports',
  profile: 'Profile',
  availability: 'Schedule',
  notifications: 'Notifications',
  'notification-preferences': 'Notification Settings',
  'forgot-password': 'Forgot Password',
  register: 'Register',
  login: 'Login',
}

export default function Breadcrumbs({ customTrail }) {
  const location = useLocation()

  // Build breadcrumb trail from URL path
  const segments = location.pathname.split('/').filter(Boolean)

  // Only show breadcrumbs for 2+ segments (3+ level deep including Home)
  if (!customTrail && segments.length < 2) return null

  const trail = customTrail || segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const label = LABEL_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    const isLast = index === segments.length - 1
    return { label, path, isLast }
  })

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/" aria-label="Home">
        <i className="bi bi-house-door" />
      </Link>
      <span className="separator" aria-hidden="true">
        <i className="bi bi-chevron-right" />
      </span>
      {trail.map((crumb, i) => (
        <span key={crumb.path || i} style={{ display: 'contents' }}>
          {crumb.isLast ? (
            <span className="current" aria-current="page">{crumb.label}</span>
          ) : (
            <>
              <Link to={crumb.path}>{crumb.label}</Link>
              <span className="separator" aria-hidden="true">
                <i className="bi bi-chevron-right" />
              </span>
            </>
          )}
        </span>
      ))}
    </nav>
  )
}
