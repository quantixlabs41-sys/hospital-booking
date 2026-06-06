import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { getNotifications, getNotificationIcon, getNotificationColor, timeAgo } from '../services/notifications'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function NotificationCenter() {
  const { user } = useAuth()
  const { markAsRead, markAllAsRead, unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (user) loadNotifications(true)
  }, [user, filter])

  async function loadNotifications(reset = false) {
    try {
      setLoading(true)
      const currentPage = reset ? 0 : page
      const data = await getNotifications(user.id, { filter, page: currentPage, pageSize: 20 })
      if (reset) {
        setNotifications(data)
        setPage(0)
      } else {
        setNotifications(prev => [...prev, ...data])
      }
      setHasMore(data.length === 20)
    } catch {
      // Silently handle
    } finally {
      setLoading(false)
    }
  }

  function loadMore() {
    setPage(prev => prev + 1)
    loadNotifications(false)
  }

  function handleNotifClick(notif) {
    if (!notif.is_read) markAsRead(notif.id)
    // Navigate to related appointment if reference exists
    if (notif.reference_id && notif.type !== 'SYSTEM') {
      navigate('/patient/appointments')
    }
  }

  const filters = [
    { key: 'all', label: 'All', icon: 'bi-inbox' },
    { key: 'unread', label: 'Unread', icon: 'bi-envelope', count: unreadCount },
    { key: 'reminders', label: 'Reminders', icon: 'bi-alarm' },
    { key: 'system', label: 'System', icon: 'bi-gear' }
  ]

  return (
    <div>
      <Navbar />

      <div className="page-header">
        <div className="container">
          <div className="section-badge">Notifications</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', position: 'relative', zIndex: 1 }}>
            Notification Center
          </h1>
        </div>
      </div>

      <div className="container py-5">
        {/* Filters */}
        <div className="d-flex gap-2 mb-4 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              className="btn-ghost d-flex align-items-center gap-2"
              style={{
                background: filter === f.key ? 'var(--primary)' : undefined,
                color: filter === f.key ? 'white' : undefined,
              }}
              onClick={() => setFilter(f.key)}
            >
              <i className={`bi ${f.icon}`} />
              {f.label}
              {f.count > 0 && (
                <span style={{
                  background: filter === f.key ? 'rgba(255,255,255,0.3)' : 'var(--danger)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  minWidth: 18,
                  textAlign: 'center'
                }}>
                  {f.count}
                </span>
              )}
            </button>
          ))}

          {unreadCount > 0 && (
            <button
              className="btn-ghost ms-auto"
              style={{ fontSize: 13 }}
              onClick={() => markAllAsRead()}
            >
              <i className="bi bi-check-all me-1" /> Mark all as read
            </button>
          )}
        </div>

        {/* Notification List */}
        {loading && notifications.length === 0 ? (
          <LoadingSpinner text="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-bell-slash" />
            <p>No {filter !== 'all' ? filter : ''} notifications</p>
          </div>
        ) : (
          <div className="notification-list stagger-children">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`notification-card ${!notif.is_read ? 'notification-unread' : ''}`}
                onClick={() => handleNotifClick(notif)}
                role="button"
                tabIndex={0}
              >
                <div
                  className="notification-card-icon"
                  style={{
                    background: `${getNotificationColor(notif.type)}12`,
                    color: getNotificationColor(notif.type)
                  }}
                >
                  <i className={`bi ${getNotificationIcon(notif.type)}`} />
                </div>
                <div className="notification-card-content">
                  <div className="d-flex align-items-center gap-2">
                    <strong style={{ fontSize: 15 }}>{notif.title}</strong>
                    {!notif.is_read && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--primary)', flexShrink: 0
                      }} />
                    )}
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--gray-500)', margin: '4px 0 0' }}>
                    {notif.body}
                  </p>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="text-center mt-4">
                <button
                  className="btn-outline-custom"
                  onClick={loadMore}
                  disabled={loading}
                  style={{ fontSize: 14 }}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
