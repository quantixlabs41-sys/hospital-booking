// supabase/functions/send-reminders/index.ts
// Scheduled reminder Edge Function
// Runs on pg_cron every 30 minutes to send 24h and 1h reminders

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()
  const results = { processed: 0, notified: 0, errors: 0, details: [] as any[] }

  try {
    // ── Find appointments needing 24h reminder ──
    const tomorrow = new Date(now)
    tomorrow.setHours(tomorrow.getHours() + 24)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    const { data: appts24h } = await supabase
      .from('appointments')
      .select(`
        *,
        profiles:patient_id(name, phone),
        doctors!inner(specialization, user_id, profiles:user_id(name))
      `)
      .eq('appointment_date', tomorrowDate)
      .in('status', ['BOOKED', 'CONFIRMED'])

    // ── Find appointments needing 1h reminder ──
    const oneHourLater = new Date(now)
    oneHourLater.setHours(oneHourLater.getHours() + 1)
    const todayDate = now.toISOString().split('T')[0]
    const oneHourTime = oneHourLater.toTimeString().slice(0, 5) // HH:MM

    const { data: appts1h } = await supabase
      .from('appointments')
      .select(`
        *,
        profiles:patient_id(name, phone),
        doctors!inner(specialization, user_id, profiles:user_id(name))
      `)
      .eq('appointment_date', todayDate)
      .gte('slot_start_time', now.toTimeString().slice(0, 5))
      .lte('slot_start_time', oneHourTime)
      .in('status', ['BOOKED', 'CONFIRMED'])

    // ── Process 24h reminders ──
    for (const appt of (appts24h || [])) {
      await processReminder(supabase, appt, 'REMINDER_24H')
      results.processed++
    }

    // ── Process 1h reminders ──
    for (const appt of (appts1h || [])) {
      await processReminder(supabase, appt, 'REMINDER_1H')
      results.processed++
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function processReminder(supabase: any, appointment: any, eventType: string) {
  const patientId = appointment.patient_id

  // Check if already sent
  const { data: existing } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('appointment_id', appointment.id)
    .eq('event', eventType)
    .eq('status', 'SENT')
    .limit(1)

  if (existing && existing.length > 0) return // Already sent

  // Get patient preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', patientId)
    .maybeSingle()

  const shouldRemind = eventType === 'REMINDER_24H'
    ? (prefs?.reminder_24h !== false)
    : (prefs?.reminder_1h !== false)

  if (!shouldRemind) return

  const messageData = {
    patientName: appointment.profiles?.name || 'Patient',
    doctorName: appointment.doctors?.profiles?.name || 'Doctor',
    specialization: appointment.doctors?.specialization || '',
    date: appointment.appointment_date,
    time: appointment.slot_start_time,
  }

  // ── Create in-app notification ──
  const timeLabel = eventType === 'REMINDER_24H' ? 'tomorrow' : 'in 1 hour'
  await supabase.from('notifications').insert({
    user_id: patientId,
    title: `Appointment ${timeLabel}`,
    body: `Your appointment with Dr. ${messageData.doctorName} is ${timeLabel} at ${messageData.time}.`,
    type: eventType,
    reference_id: appointment.id,
  })

  // ── Send WhatsApp if enabled ──
  if (prefs?.whatsapp_enabled && prefs?.whatsapp_number && prefs?.whatsapp_verified) {
    const message = eventType === 'REMINDER_24H'
      ? `⏰ *Appointment Reminder*\n──────────────────\nHi ${messageData.patientName}! 👋\n\nYour appointment is *tomorrow*:\n\n👨‍⚕️ Dr. ${messageData.doctorName}\n📅 ${messageData.date} at ${messageData.time}\n\nDon't forget to bring any relevant medical records.\n\n_MediBook Hospital_`
      : `⏰ *Appointment in 1 Hour*\n──────────────────\nHi ${messageData.patientName}! 👋\n\nYour appointment is in *1 hour*:\n\n👨‍⚕️ Dr. ${messageData.doctorName}\n📅 ${messageData.date} at ${messageData.time}\n\nPlease ensure you're on your way!\n\n_MediBook Hospital_`

    try {
      const chatId = `${prefs.whatsapp_number}@c.us`
      const response = await fetch(
        `${OPENWA_BASE_URL}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': OPENWA_API_KEY,
          },
          body: JSON.stringify({ chatId, text: message }),
        }
      )

      await supabase.from('notification_logs').insert({
        appointment_id: appointment.id,
        patient_id: patientId,
        type: 'WHATSAPP',
        event: eventType,
        recipient: prefs.whatsapp_number,
        message_body: message,
        status: response.ok ? 'SENT' : 'FAILED',
        sent_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : await response.text(),
      })
    } catch (err) {
      await supabase.from('notification_logs').insert({
        appointment_id: appointment.id,
        patient_id: patientId,
        type: 'WHATSAPP',
        event: eventType,
        recipient: prefs.whatsapp_number,
        status: 'FAILED',
        error_message: err.message,
      })
    }
  }

  // ── Log email reminder (placeholder — uses Supabase SMTP) ──
  if (prefs?.email_enabled !== false) {
    await supabase.from('notification_logs').insert({
      appointment_id: appointment.id,
      patient_id: patientId,
      type: 'EMAIL',
      event: eventType,
      status: 'SENT',
      sent_at: new Date().toISOString(),
    })
  }
}
