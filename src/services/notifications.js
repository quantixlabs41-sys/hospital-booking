import { supabase } from '../lib/supabase'

/**
 * Fetch notifications for a user with optional filters and pagination
 */
export async function getNotifications(userId, { filter = 'all', page = 0, pageSize = 20 } = {}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filter === 'unread') query = query.eq('is_read', false)
  if (filter === 'reminders') query = query.in('type', ['REMINDER_24H', 'REMINDER_1H'])
  if (filter === 'system') query = query.eq('type', 'SYSTEM')

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) throw error
  return count ?? 0
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) throw error
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) throw error
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) throw error
}

/**
 * Create a notification (used by services after appointment actions)
 */
export async function createNotification({ userId, title, body, type, referenceId }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      title,
      body,
      type,
      reference_id: referenceId ?? null
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(userId) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Save notification preferences (upsert)
 */
export async function saveNotificationPreferences(userId, prefs) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...prefs
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Subscribe to push notifications
 */
export async function savePushSubscription(userId, subscription, deviceInfo = '') {
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_info: deviceInfo
    }, { onConflict: 'user_id,endpoint' })

  if (error) throw error
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type) {
  const icons = {
    APPOINTMENT_BOOKED: 'bi-calendar-plus',
    APPOINTMENT_CONFIRMED: 'bi-calendar-check',
    APPOINTMENT_CANCELLED: 'bi-calendar-x',
    APPOINTMENT_COMPLETED: 'bi-check-circle',
    REMINDER_24H: 'bi-alarm',
    REMINDER_1H: 'bi-bell',
    SYSTEM: 'bi-info-circle'
  }
  return icons[type] ?? 'bi-bell'
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type) {
  const colors = {
    APPOINTMENT_BOOKED: 'var(--primary)',
    APPOINTMENT_CONFIRMED: 'var(--success)',
    APPOINTMENT_CANCELLED: 'var(--danger)',
    APPOINTMENT_COMPLETED: 'var(--info)',
    REMINDER_24H: 'var(--warning)',
    REMINDER_1H: 'var(--warning)',
    SYSTEM: 'var(--gray-500)'
  }
  return colors[type] ?? 'var(--primary)'
}

/**
 * Format time-ago string
 */
export function timeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
