import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useState, useEffect, useRef } from 'react'

export default function MobileBottomNav() {
  const { user, profile } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY
      if (currentY > lastScrollY.current && currentY > 100) {
        setVisible(false)
      } else {
        setVisible(true)
      }
      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!user) return null

  const role = profile?.role

  const patientTabs = [
    { to: '/', icon: 'bi-house', label: 'Home', match: (p) => p === '/' },
    { to: '/doctors', icon: 'bi-search', label: 'Doctors', match: (p) => p.startsWith('/doctors') },
    { to: '/patient/appointments', icon: 'bi-calendar-check', label: 'Bookings', match: (p) => p.startsWith('/patient/appointments') },
    { to: '/notifications', icon: 'bi-bell', label: 'Alerts', match: (p) => p === '/notifications', badge: unreadCount },
    { to: '/patient/dashboard', icon: 'bi-person', label: 'Profile', match: (p) => p === '/patient/dashboard' }
  ]

  const doctorTabs = [
    { to: '/doctor/dashboard', icon: 'bi-grid', label: 'Dashboard', match: (p) => p === '/doctor/dashboard' },
    { to: '/doctor/appointments', icon: 'bi-calendar-check', label: 'Appointments', match: (p) => p === '/doctor/appointments' },
    { to: '/doctor/availability', icon: 'bi-clock', label: 'Schedule', match: (p) => p === '/doctor/availability' },
    { to: '/notifications', icon: 'bi-bell', label: 'Alerts', match: (p) => p === '/notifications', badge: unreadCount },
    { to: '/doctor/profile', icon: 'bi-person', label: 'Profile', match: (p) => p === '/doctor/profile' }
  ]

  const adminTabs = [
    { to: '/admin/dashboard', icon: 'bi-grid', label: 'Dashboard', match: (p) => p === '/admin/dashboard' },
    { to: '/admin/appointments', icon: 'bi-calendar-check', label: 'Appointments', match: (p) => p === '/admin/appointments' },
    { to: '/admin/doctors', icon: 'bi-people', label: 'Doctors', match: (p) => p === '/admin/doctors' },
    { to: '/notifications', icon: 'bi-bell', label: 'Alerts', match: (p) => p === '/notifications', badge: unreadCount },
    { to: '/admin/reports', icon: 'bi-bar-chart', label: 'Reports', match: (p) => p === '/admin/reports' }
  ]

  let tabs = patientTabs
  if (role === 'DOCTOR') tabs = doctorTabs
  else if (role === 'ADMIN') tabs = adminTabs

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.match(location.pathname)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="mobile-nav-icon-wrapper">
              <i className={`bi ${tab.icon}${isActive ? '-fill' : ''}`} />
              {tab.badge > 0 && (
                <span className="mobile-nav-badge">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span className="mobile-nav-label">{tab.label}</span>
            {isActive && <div className="mobile-nav-indicator" />}
          </Link>
        )
      })}
    </nav>
  )
}
