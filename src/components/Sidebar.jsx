import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { getApplicationStats } from '../services/collaborate'

const DOCTOR_MENU = [
  { to: '/doctor/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
  { to: '/doctor/queue', icon: 'bi-hourglass-split', label: 'Live Queue' },
  { to: '/doctor/appointments', icon: 'bi-calendar2-check', label: 'Appointments' },
  { to: '/doctor/patients', icon: 'bi-people', label: 'Patients' },
  { to: '/doctor/messages', icon: 'bi-chat-dots', label: 'Messages' },
  { to: '/doctor/availability', icon: 'bi-clock-history', label: 'My Schedule' },
  { to: '/doctor/profile', icon: 'bi-person-badge', label: 'Profile' },
  { to: '/complaints', icon: 'bi-megaphone', label: 'Complaints' },
]

const ADMIN_MENU = [
  { to: '/admin/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
  { to: '/admin/collaborate', icon: 'bi-people', label: 'Collaborate', hasBadge: true },
  { to: '/admin/doctors', icon: 'bi-people-fill', label: 'Manage Doctors' },
  { to: '/admin/hospitals', icon: 'bi-hospital', label: 'Manage Hospitals' },
  { to: '/admin/patients', icon: 'bi-person-lines-fill', label: 'Patients' },
  { to: '/admin/appointments', icon: 'bi-calendar2-week', label: 'Appointments' },
  { to: '/admin/payments', icon: 'bi-wallet2', label: 'Payments' },
  { to: '/admin/complaints', icon: 'bi-megaphone', label: 'Complaints' },
  { to: '/admin/users', icon: 'bi-person-vcard', label: 'Users' },
  { to: '/admin/reports', icon: 'bi-graph-up-arrow', label: 'Reports' },
  { to: '/admin/profile', icon: 'bi-person-circle', label: 'My Profile' },
]

const HOSPITAL_MENU = [
  { to: '/hospital/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
  { to: '/hospital/profile', icon: 'bi-hospital', label: 'Hospital Profile' },
  { to: '/hospital/doctors', icon: 'bi-people-fill', label: 'Doctors' },
  { to: '/complaints', icon: 'bi-megaphone', label: 'Complaints' },
]

const MENUS = { ADMIN: ADMIN_MENU, HOSPITAL: HOSPITAL_MENU, DOCTOR: DOCTOR_MENU }
const ROLE_LABELS = { ADMIN: 'Administrator', HOSPITAL: 'Hospital', DOCTOR: 'Doctor' }

export default function Sidebar({ role, collapsed, onToggleCollapse }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const menu = MENUS[role] ?? DOCTOR_MENU
  const [pendingCount, setPendingCount] = useState(0)

  // Internal collapse state if no external control
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(prev => !prev))

  // Mobile drawer (the sidebar is off-canvas below 768px)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  // Close the drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Auto-collapse on medium screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1200 && window.innerWidth > 991) {
        if (!onToggleCollapse) setInternalCollapsed(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onToggleCollapse])

  // Fetch pending application count for admin badge
  useEffect(() => {
    if (role === 'ADMIN') {
      getApplicationStats()
        .then(s => setPendingCount(s.pending))
        .catch(() => {})
    }
  }, [role])

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initial = profile?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <>
      {/* Mobile hamburger — only visible on small screens */}
      <button
        className="sidebar-mobile-toggle d-lg-none"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 1000,
          width: 42, height: 42, borderRadius: 10, border: 'none',
          background: 'var(--primary)', color: 'white', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        <i className="bi bi-list" />
      </button>

      {/* Backdrop when the drawer is open on mobile */}
      {mobileOpen && (
        <div className="overlay d-lg-none" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`} role="navigation" aria-label="Sidebar navigation">
      {/* Collapse toggle button */}
      <button
        className="sidebar-collapse-btn d-none d-lg-flex"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`} />
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <i className="bi bi-heart-pulse-fill" />
        </div>
        <span>Medi<span style={{ color: 'var(--primary-light)' }}>Book</span></span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menu.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.label : undefined}
          >
            <i className={`bi ${item.icon}`} />
            <span>{item.label}</span>
            {item.hasBadge && pendingCount > 0 && !isCollapsed && (
              <span className="sidebar-collab-badge">{pendingCount}</span>
            )}
            
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {!isCollapsed && (
          <div className="d-flex align-items-center gap-3 mb-3 px-2 sidebar-user-info">
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'white' }} className="truncate">
                {profile?.name ?? 'User'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }} className="truncate">
                {ROLE_LABELS[role] ?? 'User'}
              </p>
            </div>
          </div>
        )}
        <button
          className="sidebar-nav-item w-100"
          onClick={handleLogout}
          style={{ border: 'none', background: 'rgba(239,35,60,0.1)', color: '#EF233C', textAlign: isCollapsed ? 'center' : 'left' }}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <i className="bi bi-box-arrow-left" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
    </>
  )
}
