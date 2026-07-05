// supabase/functions/razorpay-verify-payment/index.ts
//
// Verifies a Razorpay payment signature and — only on a match — marks the
// payment PAID and completes the appointment (via mark_payment_paid_online,
// which is granted to the service role only).
//
// Signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET).
// A mismatch returns 400 and NEVER marks the payment as paid.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!

// CORS: lock cross-origin access to the origins listed in the ALLOWED_ORIGINS
// secret (comma-separated). Falls back to '*' when unset so local dev keeps
// working — set it in production to your domain (e.g. https://your-app.vercel.app).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// HMAC-SHA256 hex digest using the Web Crypto API.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time string comparison.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!RAZORPAY_KEY_SECRET) return json({ error: 'Payment gateway is not configured.' }, 500)

    // Caller must be authenticated (the paying patient).
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: 'Authentication required.' }, 401)

    const body = await req.json().catch(() => ({}))
    const orderId = body.razorpay_order_id
    const paymentId = body.razorpay_payment_id
    const signature = body.razorpay_signature

    if (!orderId || !paymentId || !signature) {
      return json({ error: 'Missing payment verification fields.' }, 400)
    }

    // ── Verify the signature ──
    const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)
    if (!timingSafeEqual(expected, String(signature))) {
      return json({ verified: false, error: 'Payment signature verification failed.' }, 400)
    }

    // Confirm the order belongs to this user before settling.
    const { data: payment } = await supabase
      .from('payments')
      .select('id, patient_id, status')
      .eq('razorpay_order_id', orderId)
      .maybeSingle()
    if (!payment) return json({ error: 'Payment record not found.' }, 404)
    if (payment.patient_id !== user.id) return json({ error: 'Not authorized for this payment.' }, 403)

    // ── Settle: mark PAID + complete the appointment (service-role RPC) ──
    const { data: settled, error: rpcErr } = await supabase.rpc('mark_payment_paid_online', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_signature: signature,
    })
    if (rpcErr) return json({ error: rpcErr.message || 'Could not finalize payment.' }, 500)

    return json({
      verified: true,
      receipt_number: settled?.receipt_number ?? null,
      appointment_id: settled?.appointment_id ?? null,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
