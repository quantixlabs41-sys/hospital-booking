// supabase/functions/razorpay-create-order/index.ts
//
// Creates a Razorpay order for an appointment's PENDING payment.
//
// Security: the amount is read from the database (the payment the doctor
// requested), NOT from the client, so it can't be tampered with. The caller
// must be the authenticated patient who owns the appointment.
//
// Razorpay is called over its REST API (this runtime is Deno, not Node, so the
// Node SDK is not used). KEY_SECRET never leaves the server.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: 'Payment gateway is not configured.' }, 500)
    }

    // ── Authenticate the caller ──
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: 'Authentication required.' }, 401)

    const body = await req.json().catch(() => ({}))
    const appointmentId = parseInt(body.appointmentId, 10)
    if (!Number.isFinite(appointmentId)) {
      return json({ error: 'Missing or invalid appointmentId.' }, 400)
    }

    // ── Load the PENDING payment (amount is authoritative from DB) ──
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('id, appointment_id, patient_id, amount_paise, currency, status')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    if (pErr || !payment) return json({ error: 'No payment request found for this appointment.' }, 404)
    if (payment.patient_id !== user.id) return json({ error: 'Not authorized for this payment.' }, 403)
    if (payment.status === 'PAID') return json({ error: 'This appointment is already paid.' }, 409)
    if (payment.amount_paise < 100) return json({ error: 'Invalid amount.' }, 400)

    // ── Create the Razorpay order via REST ──
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: payment.amount_paise,
        currency: payment.currency || 'INR',
        receipt: `apt_${appointmentId}_pay_${payment.id}`,
        payment_capture: 1, // auto-capture funds (don't leave payments merely authorized)
        notes: { appointment_id: String(appointmentId), payment_id: String(payment.id) },
      }),
    })

    const order = await rzpRes.json().catch(() => null)
    if (!rzpRes.ok || !order?.id) {
      // Log the key id PREFIX (publishable, safe) + mode so `supabase functions
      // logs razorpay-create-order` reveals which credential the function ran
      // with. Never log the secret.
      console.error('Razorpay order creation failed', {
        status: rzpRes.status,
        keyIdPrefix: (RAZORPAY_KEY_ID || '').slice(0, 12),
        mode: (RAZORPAY_KEY_ID || '').startsWith('rzp_live_') ? 'live'
          : (RAZORPAY_KEY_ID || '').startsWith('rzp_test_') ? 'test' : 'unknown',
        rzpError: order?.error?.description,
      })
      if (rzpRes.status === 401) {
        return json({
          error: 'Online payment is unavailable right now. Please choose "Pay at Clinic", or try again later.',
        }, 502)
      }
      const msg = order?.error?.description || 'Could not create payment order.'
      return json({ error: msg }, 500)
    }

    // ── Persist the order id so verification can look the payment up ──
    await supabase.from('payments').update({ razorpay_order_id: order.id }).eq('id', payment.id)

    return json({
      key_id: RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
