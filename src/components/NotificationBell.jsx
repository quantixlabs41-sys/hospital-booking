import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { getNotificationIcon, getNotificationColor, timeAgo } from '../services/notifications'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [shake, setShake] = useState(false)
  const dropdownRef = useRef(null)
  const prevCount = useRef(unreadCount)

  // Shake animation when new notification arrives
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setShake(true)
      const timer = setTimeout(() => setShake(false), 600)
      return () => clearTimeout(timer)
    }
    prevCount.current = unreadCount
  }, [unreadCount])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const recentNotifications = notifications.slice(0, 8)

  function handleNotifClick(notif) {
    if (!notif.is_read) markAsRead(notif.id)
    setOpen(false)
  }

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        id="notification-bell-toggle"
      >
        <i className={`bi bi-bell${unreadCount > 0 ? '-fill' : ''} ${shake ? 'bell-shake' : ''}`} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown" id="notification-dropdown">
          {/* Header */}
          <div className="notif-dropdown-header">
            <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, margin: 0 }}>
              Notifications
            </h6>
            {unreadCount > 0 && (
              <button
                className="notif-mark-all-btn"
                onClick={() => markAllAsRead()}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="notif-dropdown-list">
            {recentNotifications.length === 0 ? (
              <div className="notif-empty">
                <i className="bi bi-bell-slash" style={{ fontSize: 32, color: 'var(--gray-300)' }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notif-item ${!notif.is_read ? 'notif-unread' : ''}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <div
                    className="notif-icon"
                    style={{ background: `${getNotificationColor(notif.type)}15`, color: getNotificationColor(notif.type) }}
                  >
                    <i className={`bi ${getNotificationIcon(notif.type)}`} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{notif.title}</div>
                    <div className="notif-body">{notif.body}</div>
                    <div className="notif-time">{timeAgo(notif.created_at)}</div>
                  </div>
                  {!notif.is_read && <div className="notif-unread-dot" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            className="notif-dropdown-footer"
            onClick={() => setOpen(false)}
          >
            View all notifications <i className="bi bi-arrow-right" />
          </Link>
        </div>
      )}
    </div>
  )
}
