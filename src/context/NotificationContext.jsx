import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { getNotifications, getUnreadCount, markAsRead as markAsReadAPI, markAllAsRead as markAllAsReadAPI } from '../services/notifications'
import { toast } from 'react-toastify'

const NotificationContext = createContext({})

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const channelRef = useRef(null)

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const [notifs, count] = await Promise.all([
        getNotifications(user.id, { pageSize: 50 }),
        getUnreadCount(user.id)
      ])
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    loadNotifications()

    // Subscribe to new notifications via Supabase Realtime
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(prev => prev + 1)

          // Show toast for new notification
          toast.info(
            <div>
              <strong style={{ fontSize: 13 }}>{newNotif.title}</strong>
              <p style={{ fontSize: 12, margin: '2px 0 0', opacity: 0.8 }}>{newNotif.body}</p>
            </div>,
            {
              icon: '🔔',
              autoClose: 5000,
              style: { borderLeft: '4px solid var(--primary)' }
            }
          )

          // Play notification sound (subtle)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAB/f39/')
            audio.volume = 0.3
            audio.play().catch(() => {})
          } catch {}
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [user, loadNotifications])

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markAsReadAPI(notificationId)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }, [])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return
    try {
      await markAllAsReadAPI(user.id)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }, [user])

  // Refresh notifications
  const refresh = useCallback(() => {
    loadNotifications()
  }, [loadNotifications])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refresh
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
