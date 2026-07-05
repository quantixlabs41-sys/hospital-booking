// supabase/functions/verify-email/index.ts
//
// Validates an email address at registration using Abstract API's Email
// Validation endpoint. The API key stays server-side (Supabase secret) and is
// NEVER exposed to the browser. Returns a minimal allow/deny verdict, not the
// raw provider payload.
//
// Verdict (block only clearly-bad addresses; allow "unknown" so we never reject
// real users on catch-all domains):
//   - invalid format        → block
//   - disposable address     → block
//   - domain has no MX       → block
//   - deliverability UNDELIVERABLE → block
//   - otherwise (DELIVERABLE / UNKNOWN) → allow
//
// Set the key:  supabase secrets set ABSTRACT_API_KEY=your_key
// Deploy:       supabase functions deploy verify-email

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const ABSTRACT_API_KEY = Deno.env.get('ABSTRACT_API_KEY') || ''

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

// Best-effort per-isolate rate limit to protect the Abstract API quota from
// abuse (registration is a public endpoint).
const RL_WINDOW_MS = 60_000
const RL_MAX = 30
const bucket: number[] = []
function rateLimited(): boolean {
  const now = Date.now()
  while (bucket.length && now - bucket[0] > RL_WINDOW_MS) bucket.shift()
  if (bucket.length >= RL_MAX) return true
  bucket.push(now)
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return json({ allow: false, reason: 'Please enter a valid email address.' })
    }

    // If the key isn't configured, fail OPEN (don't block signups on misconfig).
    if (!ABSTRACT_API_KEY) {
      return json({ allow: true, reason: null, checked: false })
    }

    if (rateLimited()) {
      // Under load, fail open rather than blocking legitimate signups.
      return json({ allow: true, reason: null, checked: false })
    }

    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(ABSTRACT_API_KEY)}&email=${encodeURIComponent(email)}`

    let data: any = null
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.ok) data = await res.json()
    } catch {
      /* network/timeout — fall through to fail-open */
    }

    // Provider unreachable → fail open.
    if (!data) return json({ allow: true, reason: null, checked: false })

    const validFormat = data?.is_valid_format?.value !== false
    const disposable = data?.is_disposable_email?.value === true
    const mxFound = data?.is_mx_found?.value !== false
    const deliverability = String(data?.deliverability || 'UNKNOWN')

    if (!validFormat) {
      return json({ allow: false, reason: 'This email address is not valid.', checked: true })
    }
    if (disposable) {
      return json({ allow: false, reason: 'Temporary/disposable email addresses are not allowed.', checked: true })
    }
    if (!mxFound) {
      return json({ allow: false, reason: "This email's domain can't receive mail. Check the spelling.", checked: true })
    }
    if (deliverability === 'UNDELIVERABLE') {
      return json({ allow: false, reason: "This email address doesn't appear to exist.", checked: true })
    }

    return json({ allow: true, reason: null, checked: true })
  } catch (err) {
    // Never block registration on an unexpected server error — fail open.
    return json({ allow: true, reason: null, checked: false, error: (err as Error).message })
  }
})
