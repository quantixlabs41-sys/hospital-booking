import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages } = await req.json()
    
    // In production, this comes from Supabase Secrets
    // For local development, we get it from .env
    const apiKey = Deno.env.get('NVIDIA_API_KEY')
    
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY is not configured in Edge Function secrets.')
    }

    // Call NVIDIA NIM API
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        messages: messages,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 1024,
        stream: true,
        extra_body: {
            chat_template_kwargs: { enable_thinking: true },
            reasoning_budget: 1024
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('NVIDIA API error:', response.status, errText)
      throw new Error(`NVIDIA API responded with status ${response.status}`)
    }

    // Proxy the streaming response directly back to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('Error in chat-assistant function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
