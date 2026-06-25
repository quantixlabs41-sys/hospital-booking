// chat-assistant Edge Function
// Proxies chat requests to NVIDIA NIM API securely.
// API key is stored in Supabase Secrets, never exposed to the client.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompt lives server-side — clients cannot tamper with it
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are MediBook AI, a friendly and knowledgeable medical assistant embedded in the MediBook hospital management system. 
You help patients with:
- Understanding symptoms and when to seek medical care
- Explaining medical terms in simple language
- Guiding users on how to book appointments with the right specialist
- Providing general healthcare and wellness advice

Always recommend users consult a licensed doctor for diagnosis and treatment. Keep responses concise and easy to understand.
Do NOT provide specific diagnoses. If in doubt, always advise the user to visit a doctor.`
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messages } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format. Expected a non-empty array.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate message structure — only allow user/assistant roles from client
    const sanitizedMessages = messages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role,
        content: String(m.content || '').slice(0, 4000),
      }))

    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid messages provided.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // API key from Supabase Secrets (never exposed to the client)
    const apiKey = Deno.env.get('NVIDIA_API_KEY')

    if (!apiKey) {
      console.error('NVIDIA_API_KEY is not set in Supabase Secrets')
      return new Response(
        JSON.stringify({ error: 'AI service is not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the request payload
    // Using a lighter/faster model to avoid 504 timeouts on Edge Functions
    const payload: Record<string, unknown> = {
      model: 'meta/llama-3.3-70b-instruct',
      messages: [SYSTEM_PROMPT, ...sanitizedMessages],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2048,
      stream: true,
    }

    console.log(`[chat-assistant] Calling NVIDIA NIM with ${sanitizedMessages.length} messages, model: ${payload.model}`)

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[chat-assistant] NVIDIA API error: status=${response.status} body=${errText}`)

      // Return a user-friendly error with the actual status for debugging
      return new Response(
        JSON.stringify({
          error: `AI service returned error ${response.status}. Please try again.`,
          details: Deno.env.get('ENVIRONMENT') === 'development' ? errText : undefined,
        }),
        {
          status: response.status >= 500 ? 502 : response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Proxy the streaming response directly back to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[chat-assistant] Unhandled error:', error?.message || error)
    return new Response(
      JSON.stringify({ error: error?.message || 'An unexpected error occurred.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
