import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef(null)

  const role = profile?.role

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('nav-open')
    } else {
      document.body.classList.remove('nav-open')
    }
    return () => document.body.classList.remove('nav-open')
  }, [mobileOpen])

  // Close on ESC key
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function getInitial() {
    return profile?.name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?'
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      <nav className="navbar-custom" role="navigation" aria-label="Main navigation">
        <div className="container d-flex align-items-center justify-content-between w-100">
          {/* Brand */}
          <Link to="/" className="navbar-brand-custom">
            <i className="bi bi-heart-pulse-fill" style={{ fontSize: 26, color: 'var(--primary)' }} />
            Medi<span className="brand-dot">Book</span>
          </Link>

          {/* Mobile Toggle */}
          <button
            className="d-lg-none btn-ghost"
            style={{ padding: '6px 10px', fontSize: 22 }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="nav-links"
          >
            <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`} />
          </button>

          {/* Nav Links */}
          <div
            id="nav-links"
            ref={navRef}
            className={`d-flex align-items-center gap-2 ${mobileOpen ? 'nav-mobile-open' : 'd-none d-lg-flex'}`}
            role="menubar"
          >
            <Link to="/" className={`nav-link-custom ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
              Home
            </Link>
            <Link to="/doctors" className={`nav-link-custom ${isActive('/doctors') ? 'active' : ''}`}>
              Find Doctors
            </Link>

            {!user ? (
              <>
                <Link to="/collaborate" className={`nav-link-custom ${isActive('/collaborate') ? 'active' : ''}`}>
                  <i className="bi bi-people me-1" />Join as Doctor
                </Link>
                <Link to="/login" className="nav-link-custom">Login</Link>
                <Link to="/register" className="btn-primary-custom btn-sm">
                  Register
                </Link>
              </>
            ) : (
              <>
                {role === 'PATIENT' && (
                  <>
                    <Link to="/patient/dashboard" className={`nav-link-custom ${isActive('/patient') ? 'active' : ''}`}>
                      Dashboard
                    </Link>
                    <Link to="/patient/appointments" className={`nav-link-custom ${isActive('/patient/appointments') ? 'active' : ''}`}>
                      My Appointments
                    </Link>
                  </>
                )}
                {role === 'DOCTOR' && (
                  <Link to="/doctor/dashboard" className={`nav-link-custom ${isActive('/doctor') ? 'active' : ''}`}>
                    Doctor Portal
                  </Link>
                )}
                {role === 'ADMIN' && (
                  <Link to="/admin/dashboard" className={`nav-link-custom ${isActive('/admin') ? 'active' : ''}`}>
                    Admin Portal
                  </Link>
                )}

                {/* Notification Bell */}
                <NotificationBell />

                {/* Profile dropdown */}
                <div className="dropdown ms-2">
                  <button
                    className="d-flex align-items-center gap-2 btn-ghost"
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)' }}
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    aria-label="Account menu"
                  >
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                      {getInitial()}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-700)' }} className="d-none d-md-inline">
                      {profile?.name ?? 'Account'}
                    </span>
                    <i className="bi bi-chevron-down" style={{ fontSize: 11, color: 'var(--gray-400)' }} />
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0" style={{ borderRadius: 'var(--radius-md)', minWidth: 200 }}>
                    <li className="px-3 py-2 border-bottom" style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                      {user.email}
                    </li>
                    {role === 'PATIENT' && (
                      <>
                        <li>
                          <Link className="dropdown-item py-2" to="/patient/dashboard">
                            <i className="bi bi-grid me-2" />Dashboard
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item py-2" to="/patient/profile">
                            <i className="bi bi-person-circle me-2" />My Profile
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item py-2" to="/patient/notification-preferences">
                            <i className="bi bi-bell-slash me-2" />Notification Settings
                          </Link>
                        </li>
                      </>
                    )}
                    {role === 'DOCTOR' && (
                      <>
                        <li>
                          <Link className="dropdown-item py-2" to="/doctor/dashboard">
                            <i className="bi bi-grid me-2" />Dashboard
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item py-2" to="/doctor/profile">
                            <i className="bi bi-person-circle me-2" />My Profile
                          </Link>
                        </li>
                      </>
                    )}
                    {role === 'ADMIN' && (
                      <>
                        <li>
                          <Link className="dropdown-item py-2" to="/admin/dashboard">
                            <i className="bi bi-grid me-2" />Dashboard
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item py-2" to="/admin/profile">
                            <i className="bi bi-person-circle me-2" />My Profile
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item py-2" to="/admin/whatsapp">
                            <i className="bi bi-whatsapp me-2" style={{ color: '#25D366' }} />WhatsApp
                          </Link>
                        </li>
                      </>
                    )}
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item py-2 text-danger" onClick={handleSignOut}>
                        <i className="bi bi-box-arrow-right me-2" />Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="nav-mobile-overlay d-lg-none"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
