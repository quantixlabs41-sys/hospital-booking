// supabase/functions/collab-document/index.ts
// Secure, scoped access to collaboration application documents.
//
// The Application Status page is anonymous (email + application ID lookup),
// so storage RLS cannot scope by auth.uid(). This function runs with the
// service role and only returns a short-lived signed URL AFTER verifying
// that the requester owns the application (email + ID must match), OR that
// the caller is an authenticated ADMIN.
//
// The 'collaborate-docs' bucket stays PRIVATE and admin-only at the RLS
// level — no public read policy is required.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SIGNED_URL_TTL = 300 // 5 minutes

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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const body = await req.json().catch(() => ({}))
    const applicationId = parseInt(body.applicationId, 10)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!Number.isFinite(applicationId)) {
      return json({ error: 'Missing or invalid application ID' }, 400)
    }

    // ── Determine authorization: ADMIN (via auth header) OR document owner (email match) ──
    let isAdmin = false
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()
        isAdmin = profile?.role === 'ADMIN'
      }
    }

    // Fetch the application (service role bypasses RLS)
    const { data: application, error: appError } = await supabase
      .from('collaboration_applications')
      .select('id, applicant_email, documents_url')
      .eq('id', applicationId)
      .maybeSingle()

    if (appError || !application) {
      return json({ error: 'Application not found' }, 404)
    }

    // Ownership check: admin OR the email matches the application's email
    const isOwner = !!email && application.applicant_email?.toLowerCase() === email
    if (!isAdmin && !isOwner) {
      return json({ error: 'Not authorized to access this document' }, 403)
    }

    if (!application.documents_url) {
      return json({ error: 'No document attached to this application' }, 404)
    }

    // Sign the URL (service role can sign for a private bucket)
    const { data: signed, error: signError } = await supabase.storage
      .from('collaborate-docs')
      .createSignedUrl(application.documents_url, SIGNED_URL_TTL)

    if (signError || !signed?.signedUrl) {
      return json({ error: 'Could not generate document link' }, 500)
    }

    return json({ url: signed.signedUrl })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
