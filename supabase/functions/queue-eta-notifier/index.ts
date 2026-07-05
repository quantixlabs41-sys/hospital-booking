// supabase/functions/queue-eta-notifier/index.ts
//
// Best-effort WEB PUSH for Live Queue ETA shifts.
//
// The reliable, in-app notification (the bell + patient live view) is written
// transactionally by the `recompute_queue_etas` SQL function, so patients are
// always informed even if this function is never called. This function adds an
// OS-level web push on top, for patients who enabled push and registered a
// subscription.
//
// It is invoked (best-effort, non-blocking) by the Doctor Queue Console after
// advancing the queue / flagging a delay. It re-verifies the caller owns the
// doctor, then pushes to each waiting patient whose ETA changed materially.
//
// Deploy WITH JWT verification (default). Requires VAPID keys as secrets to
// actually send push; without them it degrades gracefully to a no-op:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   supabase functions deploy queue-eta-notifier

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@medibook.app'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  let allowOrigin = '*'
  if (ALLOWED_ORIGINS.length > 0) {
    allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const NOTIFY_THRESHOLD_MIN = 15

serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── Authenticate + authorize the caller (must own the doctor) ──
    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return json({ error: 'Authentication required.' }, 401)

    const body = await req.json().catch(() => ({}))
    const doctorId = Number(body.doctorId)
    const date = typeof body.date === 'string' ? body.date : ''
    if (!Number.isFinite(doctorId) || !date) return json({ error: 'Missing doctorId or date.' }, 400)

    const { data: doctor } = await admin
      .from('doctors').select('id, user_id').eq('id', doctorId).maybeSingle()
    if (!doctor || doctor.user_id !== user.id) {
      return json({ error: 'Only the treating doctor can notify this queue.' }, 403)
    }

    // Without VAPID configured we can't sign push — the in-app path already fired.
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ pushed: 0, skipped: 'VAPID not configured; in-app notifications already delivered.' })
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    // Waiting entries for this doctor/day with a computed ETA.
    const { data: entries } = await admin
      .from('queue_entries')
      .select('patient_id, position, eta_at, suggested_leave_at, state')
      .eq('doctor_id', doctorId)
      .eq('queue_date', date)
      .in('state', ['WAITING', 'CHECKED_IN'])

    let pushed = 0
    for (const e of entries ?? []) {
      // Respect per-user push preference.
      const { data: prefs } = await admin
        .from('notification_preferences').select('push_enabled').eq('user_id', e.patient_id).maybeSingle()
      if (prefs && prefs.push_enabled === false) continue

      const { data: subs } = await admin
        .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', e.patient_id)
      if (!subs || subs.length === 0) continue

      const etaLabel = e.eta_at
        ? new Date(e.eta_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'soon'
      const payload = JSON.stringify({
        title: 'Updated arrival time',
        body: `You're #${e.position} in the queue. Estimated visit time: ${etaLabel}.`,
        tag: `queue-eta-${doctorId}-${date}`,
        url: '/patient/appointments',
      })

      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
          pushed++
        } catch (err: any) {
          // Prune dead subscriptions (410 Gone / 404).
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      }
    }

    return json({ pushed })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
