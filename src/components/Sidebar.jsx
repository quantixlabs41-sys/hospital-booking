import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'

const DOCTOR_MENU = [
  { to: '/doctor/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
  { to: '/doctor/appointments', icon: 'bi-calendar2-check', label: 'Appointments' },
  { to: '/doctor/availability', icon: 'bi-clock-history', label: 'My Schedule' },
  { to: '/doctor/profile', icon: 'bi-person-badge', label: 'Profile' },
]

const ADMIN_MENU = [
  { to: '/admin/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
  { to: '/admin/doctors', icon: 'bi-people-fill', label: 'Manage Doctors' },
  { to: '/admin/patients', icon: 'bi-person-lines-fill', label: 'Patients' },
  { to: '/admin/appointments', icon: 'bi-calendar2-week', label: 'Appointments' },
  { to: '/admin/reports', icon: 'bi-graph-up-arrow', label: 'Reports' },
  { to: '/admin/profile', icon: 'bi-person-circle', label: 'My Profile' },
]

export default function Sidebar({ role, collapsed, onToggleCollapse }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const menu = role === 'ADMIN' ? ADMIN_MENU : DOCTOR_MENU

  // Internal collapse state if no external control
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(prev => !prev))

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

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initial = profile?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} role="navigation" aria-label="Sidebar navigation">
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
                {role === 'ADMIN' ? 'Administrator' : 'Doctor'}
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
  )
}
