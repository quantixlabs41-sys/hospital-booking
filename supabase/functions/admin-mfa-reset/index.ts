// supabase/functions/admin-mfa-reset/index.ts
//
// Admin-assisted MFA reset. Removes ALL MFA factors from a target user so they
// can re-enroll after losing their authenticator (and recovery options).
//
// Security:
//  - Caller must be authenticated AND have role ADMIN in public.profiles
//    (checked server-side with the service role — never trusts the client).
//  - Uses the GoTrue Admin MFA API (service role) to list + delete factors.
//  - Writes an audit_logs entry recording the acting admin and target user.
//
// Deploy WITH JWT verification (default) so only signed-in users can call it:
//   supabase functions deploy admin-mfa-reset

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

    const body = await req.json().catch(() => ({}))
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : ''
    if (!targetUserId) return json({ error: 'Missing targetUserId.' }, 400)

    // ── Delete all of the target's MFA factors (service-role admin API) ──
    const { data: factorList, error: listErr } = await admin.auth.admin.mfa.listFactors({
      userId: targetUserId,
    })
    if (listErr) return json({ error: 'Could not read the user\'s factors.' }, 500)

    const factors = factorList?.factors ?? []
    let removed = 0
    for (const f of factors) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
        id: f.id,
        userId: targetUserId,
      })
      if (!delErr) removed++
    }

    // ── Audit trail (best-effort) ──
    await admin.from('audit_logs').insert({
      user_id: user.id,
      event: 'ADMIN_MFA_RESET',
      details: { target_user_id: targetUserId, factors_removed: removed },
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    return json({ success: true, factors_removed: removed })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
