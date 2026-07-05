// supabase/functions/collaborate-create-account/index.ts
//
// Creates the login account for an approved collaboration applicant
// (DOCTOR or HOSPITAL). Runs with the service role so it:
//   • bypasses the project's CAPTCHA protection on the public signup
//     endpoint (an admin approving an application is not a bot), and
//   • never disturbs the acting admin's own session.
//
// Security:
//  - Caller must be authenticated AND have role ADMIN in public.profiles
//    (verified server-side with the service role — the client is not trusted).
//  - The password never touches the public signup endpoint; the account is
//    created pre-confirmed via the GoTrue Admin API.
//
// Deploy WITH JWT verification (default) so only signed-in users can call it:
//   supabase functions deploy collaborate-create-account

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── Authenticate the caller ──
    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user }, error: authErr } = await admin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) return json({ error: 'Authentication required.' }, 401)

    // ── Authorize: caller must be an ADMIN ──
    const { data: caller } = await admin
      .from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'ADMIN') return json({ error: 'Admin privileges required.' }, 403)

    // ── Validate input ──
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name : ''
    const phone = typeof body.phone === 'string' ? body.phone : ''
    const role = body.role === 'HOSPITAL' ? 'HOSPITAL' : body.role === 'DOCTOR' ? 'DOCTOR' : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400)
    if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
    if (!role) return json({ error: 'Role must be DOCTOR or HOSPITAL.' }, 400)

    // ── Create the account (pre-confirmed, bypasses captcha) ──
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role },
    })

    if (createErr) {
      // Surface a friendly message for the common "already registered" case.
      const msg = createErr.message || 'Could not create the account.'
      const already = /already|exists|registered/i.test(msg)
      return json({ error: already ? 'An account with this email already exists.' : msg }, already ? 409 : 400)
    }

    const userId = created?.user?.id
    if (!userId) return json({ error: 'Account creation failed — no user id returned.' }, 500)

    return json({ success: true, userId })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
