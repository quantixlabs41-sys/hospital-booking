import { supabase } from '../lib/supabase'

/**
 * Save WhatsApp notification preferences
 */
export async function saveWhatsAppPreference(userId, number, enabled) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      whatsapp_enabled: enabled,
      whatsapp_number: number || null,
      whatsapp_verified: false
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Verify WhatsApp number by sending a test message via Edge Function
 */
export async function verifyWhatsAppNumber(userId, number) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('send-whatsapp', {
    body: {
      action: 'verify',
      userId,
      whatsappNumber: number
    }
  })

  if (response.error) throw new Error(response.error.message || 'Failed to send verification')
  return response.data
}

/**
 * Confirm WhatsApp verification (marks number as verified)
 */
export async function confirmWhatsAppVerification(userId) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({ whatsapp_verified: true })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Send a WhatsApp notification for an appointment event
 */
export async function sendWhatsAppNotification(appointmentId, messageType) {
  const response = await supabase.functions.invoke('send-whatsapp', {
    body: {
      action: 'send',
      appointmentId,
      messageType
    }
  })

  if (response.error) throw new Error(response.error.message || 'Failed to send WhatsApp')
  return response.data
}

/**
 * Check if the OpenWA gateway is healthy
 */
export async function getWhatsAppStatus() {
  try {
    const response = await supabase.functions.invoke('send-whatsapp', {
      body: { action: 'health' }
    })

    return {
      connected: response.data?.connected ?? false,
      sessionId: response.data?.sessionId ?? null,
      error: null
    }
  } catch (err) {
    return {
      connected: false,
      sessionId: null,
      error: err.message
    }
  }
}

/**
 * Get WhatsApp delivery logs (admin only)
 */
export async function getWhatsAppLogs(filters = {}, page = 0, pageSize = 20) {
  let query = supabase
    .from('notification_logs')
    .select('*, profiles:patient_id(name, phone)')
    .eq('type', 'WHATSAPP')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.event) query = query.eq('event', filters.event)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Get WhatsApp delivery stats (admin only)
 */
export async function getWhatsAppStats() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [todayRes, weekRes, failedRes] = await Promise.all([
    supabase.from('notification_logs').select('id', { count: 'exact', head: true })
      .eq('type', 'WHATSAPP').gte('created_at', today + 'T00:00:00'),
    supabase.from('notification_logs').select('id', { count: 'exact', head: true })
      .eq('type', 'WHATSAPP').gte('created_at', weekAgo + 'T00:00:00'),
    supabase.from('notification_logs').select('id', { count: 'exact', head: true })
      .eq('type', 'WHATSAPP').eq('status', 'FAILED').gte('created_at', weekAgo + 'T00:00:00')
  ])

  return {
    sentToday: todayRes.count ?? 0,
    sentThisWeek: weekRes.count ?? 0,
    failedThisWeek: failedRes.count ?? 0
  }
}

/**
 * Send test WhatsApp message (admin only)
 */
export async function sendTestWhatsApp(number, message) {
  const response = await supabase.functions.invoke('send-whatsapp', {
    body: {
      action: 'test',
      whatsappNumber: number,
      message
    }
  })

  if (response.error) throw new Error(response.error.message || 'Failed to send test message')
  return response.data
}
