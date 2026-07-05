// supabase/functions/mfa-recovery-reset/index.ts
//
// Self-service MFA recovery. A signed-in user who lost their authenticator
// (session is at aal1, blocked at the step-up screen) submits a recovery code.
// If the code is valid, we remove that user's own MFA factors so they can
// re-enroll. This never mints aal2 directly — it is a factor RESET path.
//
// Security:
//  - The recovery code is verified as the CALLER (their JWT) via the
//    mfa_consume_recovery_code RPC, which is scoped to auth.uid() — a user can
//    only spend their own codes.
//  - Factor deletion uses the service-role Admin MFA API for that same user id.
//  - A wrong/no code deletes nothing and returns 400.
//
// Deploy with JWT verification ON (default):
//   supabase functions deploy mfa-recovery-reset

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'



const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
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
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    // Identify the caller.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Authentication required.' }, 401)

    const body = await req.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : ''
    if (!code.trim()) return json({ error: 'Enter a recovery code.' }, 400)

    // Verify + consume the code AS THE CALLER (RPC is scoped to auth.uid()).
    const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })
    const { data: ok, error: rpcErr } = await asUser.rpc('mfa_consume_recovery_code', { p_code: code })
    if (rpcErr) return json({ error: 'Could not verify the recovery code.' }, 500)
    if (ok !== true) return json({ error: 'Invalid or already-used recovery code.' }, 400)

    // Remove the caller's MFA factors (service-role admin API).
    const { data: factorList } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
    const factors = factorList?.factors ?? []
    let removed = 0
    for (const f of factors) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
      if (!delErr) removed++
    }

    await admin.from('audit_logs').insert({
      user_id: user.id,
      event: 'MFA_RECOVERY_RESET',
      details: { factors_removed: removed },
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    return json({ success: true, factors_removed: removed })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
