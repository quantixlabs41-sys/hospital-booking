// supabase/functions/send-whatsapp/index.ts
// Secure WhatsApp proxy Edge Function
// Validates auth, formats messages, sends via OpenWA REST API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENWA_BASE_URL = Deno.env.get('OPENWA_BASE_URL') || 'http://localhost:2785'
const OPENWA_API_KEY = Deno.env.get('OPENWA_API_KEY')!
const OPENWA_SESSION_ID = Deno.env.get('OPENWA_SESSION_ID') || 'medibook-hospital'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Message Templates ───

function formatBookingConfirmed(data: any): string {
  return `📋 *Appointment Confirmed*
──────────────────
🏥 MediBook Hospital

👤 Patient: ${data.patientName}
👨‍⚕️ Doctor: Dr. ${data.doctorName} (${data.specialization})
📅 Date: ${data.date}
🕐 Time: ${data.time}

Please arrive 15 minutes early.
To manage your appointment, visit MediBook.

_This is an automated message from MediBook._`
}

function formatReminder24H(data: any): string {
  return `⏰ *Appointment Reminder*
──────────────────
Hi ${data.patientName}! 👋

This is a reminder that your appointment is *tomorrow*:

👨‍⚕️ Dr. ${data.doctorName}
📅 ${data.date} at ${data.time}

Don't forget to bring any relevant medical records.

_MediBook Hospital_`
}

function formatReminder1H(data: any): string {
  return `⏰ *Appointment Reminder - 1 Hour*
──────────────────
Hi ${data.patientName}! 👋

Your appointment is in *1 hour*:

👨‍⚕️ Dr. ${data.doctorName}
📅 ${data.date} at ${data.time}

Please ensure you're on your way!

_MediBook Hospital_`
}

function formatCancellation(data: any): string {
  return `❌ *Appointment Cancelled*
──────────────────
Hi ${data.patientName},

Your appointment with Dr. ${data.doctorName} on ${data.date} at ${data.time} has been cancelled.

${data.cancelReason ? `Reason: ${data.cancelReason}` : ''}

To rebook, visit MediBook.

_MediBook Hospital_`
}

function formatVerification(name: string): string {
  return `✅ *MediBook - WhatsApp Verification*
──────────────────
Hi ${name}! 👋

Your WhatsApp number has been linked to your MediBook account.
You will now receive appointment reminders on WhatsApp.

To unsubscribe, go to Notification Preferences in the app.

_MediBook Hospital_`
}

function formatMessage(messageType: string, data: any): string {
  switch (messageType) {
    case 'BOOKING_CONFIRMED': return formatBookingConfirmed(data)
    case 'REMINDER_24H': return formatReminder24H(data)
    case 'REMINDER_1H': return formatReminder1H(data)
    case 'CANCELLATION': return formatCancellation(data)
    case 'VERIFICATION': return formatVerification(data.patientName)
    default: return `MediBook Hospital: ${data.message || 'Notification'}`
  }
}

// ─── WhatsApp Gateway API Helper ───

async function sendViaOpenWA(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${OPENWA_BASE_URL}/api/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OPENWA_API_KEY,
        },
        body: JSON.stringify({ chatId, text }),
      }
    )

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: 'Unknown error' }))
      return { ok: false, error: `Gateway error ${response.status}: ${errBody.error || 'Unknown'}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` }
  }
}

async function checkOpenWAHealth(): Promise<{ connected: boolean; sessionId: string | null }> {
  try {
    const response = await fetch(`${OPENWA_BASE_URL}/api/health`)
    const data = await response.json()
    return {
      connected: data.connected ?? false,
      sessionId: data.connected ? OPENWA_SESSION_ID : null,
    }
  } catch {
    return { connected: false, sessionId: null }
  }
}

// ─── Main Handler ───

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    // ── Health Check ──
    if (action === 'health') {
      const health = await checkOpenWAHealth()
      return new Response(JSON.stringify(health), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Verify WhatsApp Number ──
    if (action === 'verify') {
      const { whatsappNumber, userId } = body

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', userId).single()

      const chatId = `${whatsappNumber}@c.us`
      const message = formatVerification(profile?.name || 'User')
      const result = await sendViaOpenWA(chatId, message)

      if (result.ok) {
        // Update preferences
        await supabase.from('notification_preferences').upsert({
          user_id: userId,
          whatsapp_number: whatsappNumber,
          whatsapp_enabled: true,
          whatsapp_verified: true,
        }, { onConflict: 'user_id' })
      }

      return new Response(JSON.stringify({ success: result.ok, error: result.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Send Test Message (Admin only) ──
    if (action === 'test') {
      // Verify admin role
      const { data: adminProfile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      if (adminProfile?.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const chatId = `${body.whatsappNumber}@c.us`
      const result = await sendViaOpenWA(chatId, body.message || 'Test from MediBook 🏥')

      return new Response(JSON.stringify({ success: result.ok, error: result.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Send Appointment Notification ──
    if (action === 'send') {
      const { appointmentId, messageType } = body

      // Fetch appointment with related data
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .select(`
          *,
          profiles:patient_id(name, phone),
          doctors!inner(specialization, user_id, profiles:user_id(name))
        `)
        .eq('id', appointmentId)
        .single()

      if (apptError || !appointment) {
        return new Response(JSON.stringify({ error: 'Appointment not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check patient's WhatsApp preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', appointment.patient_id)
        .single()

      if (!prefs?.whatsapp_enabled || !prefs?.whatsapp_number || !prefs?.whatsapp_verified) {
        return new Response(JSON.stringify({ skipped: true, reason: 'WhatsApp not enabled or verified' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Format the message
      const messageData = {
        patientName: appointment.profiles?.name || 'Patient',
        doctorName: appointment.doctors?.profiles?.name || 'Doctor',
        specialization: appointment.doctors?.specialization || '',
        date: appointment.appointment_date,
        time: appointment.slot_start_time,
        cancelReason: appointment.cancel_reason || '',
      }

      const message = formatMessage(messageType, messageData)
      const chatId = `${prefs.whatsapp_number}@c.us`

      // Send via OpenWA
      const result = await sendViaOpenWA(chatId, message)

      // Log to notification_logs
      await supabase.from('notification_logs').insert({
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        type: 'WHATSAPP',
        event: messageType,
        recipient: prefs.whatsapp_number,
        message_body: message,
        status: result.ok ? 'SENT' : 'FAILED',
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok ? null : result.error,
      })

      return new Response(JSON.stringify({ success: result.ok, error: result.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
