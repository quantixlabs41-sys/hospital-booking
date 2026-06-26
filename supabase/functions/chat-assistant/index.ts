// chat-assistant Edge Function
// Proxies chat requests to NVIDIA NIM API securely.
// Supports: context-aware medical chat, appointment booking actions, and AI writing mode.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base system prompt — extended dynamically with patient/doctor context
const BASE_SYSTEM_PROMPT = `You are MediBook AI, a friendly and knowledgeable medical assistant embedded in the MediBook hospital management system.

You help patients with:
- Understanding symptoms and when to seek medical care
- Explaining medical terms in simple language
- Guiding users on how to book appointments with the right specialist
- Providing general healthcare and wellness advice
- Booking appointments with doctors on the platform

IMPORTANT RULES:
- Always recommend users consult a licensed doctor for diagnosis and treatment.
- Keep responses concise and easy to understand.
- Do NOT provide specific diagnoses.
- If in doubt, always advise the user to visit a doctor.
- When listing items, use numbered lists (1. 2. 3.) and **bold** for key terms.`

const BOOKING_INSTRUCTIONS = `
APPOINTMENT BOOKING:
When the user wants to book an appointment, guide them step by step:
1. Ask which specialization they need (or suggest based on their symptoms)
2. Show available doctors from the AVAILABLE DOCTORS list
3. Ask for preferred date
4. Once all details are confirmed, respond with a structured action block:

\`\`\`action
{"type":"BOOK_APPOINTMENT","doctor_id":<number>,"doctor_name":"<name>","specialization":"<spec>","date":"<YYYY-MM-DD>","slot":"<HH:MM>","fee":<number>}
\`\`\`

NEVER emit the action block without the user explicitly confirming the doctor, date, and time.
Only suggest doctors from the AVAILABLE DOCTORS list below.`

const WRITE_SYSTEM_PROMPT = `You are a professional writing assistant. Write clear, warm, and concise text as requested. Return ONLY the text — no explanations, no quotes, no markdown headers. Keep it natural and conversational.`

/**
 * Build a dynamic system prompt with patient context and doctor data.
 */
function buildSystemPrompt(context: any): string {
  let prompt = BASE_SYSTEM_PROMPT

  if (!context) return prompt

  // Patient context
  if (context.patient) {
    const p = context.patient
    prompt += `\n\nPATIENT CONTEXT:`
    if (p.name) prompt += `\n- Name: ${p.name}`
    if (p.gender) prompt += `\n- Gender: ${p.gender}`
    if (p.date_of_birth) prompt += `\n- Date of Birth: ${p.date_of_birth}`
    if (p.blood_group) prompt += `\n- Blood Group: ${p.blood_group}`
    if (p.address) prompt += `\n- Address: ${p.address}`
  }

  // Appointment history
  if (context.appointments?.length > 0) {
    prompt += `\n\nAPPOINTMENT HISTORY:`
    const upcoming = context.appointments.filter((a: any) => ['PENDING', 'CONFIRMED'].includes(a.status))
    const past = context.appointments.filter((a: any) => a.status === 'COMPLETED')
    const cancelled = context.appointments.filter((a: any) => a.status === 'CANCELLED')

    if (upcoming.length > 0) {
      prompt += `\nUpcoming:`
      upcoming.forEach((a: any) => {
        prompt += `\n- Dr. ${a.doctor_name} (${a.specialization}) on ${a.date} at ${a.time} [${a.status}]`
      })
    }
    if (past.length > 0) {
      prompt += `\nCompleted: ${past.length} appointment(s)`
    }
    if (cancelled.length > 0) {
      prompt += `\nCancelled: ${cancelled.length} appointment(s)`
    }
  }

  // Available doctors for booking
  if (context.doctors?.length > 0) {
    prompt += BOOKING_INSTRUCTIONS
    prompt += `\n\nAVAILABLE DOCTORS:`
    context.doctors.forEach((d: any) => {
      prompt += `\n- ID:${d.id} | Dr. ${d.name} — ${d.specialization}, ₹${d.fee || 'N/A'}, ${d.experience || '?'}yr exp`
    })
  }

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messages, context, writeMode } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format. Expected a non-empty array.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and sanitize messages
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

    const apiKey = Deno.env.get('NVIDIA_API_KEY')
    if (!apiKey) {
      console.error('NVIDIA_API_KEY is not set in Supabase Secrets')
      return new Response(
        JSON.stringify({ error: 'AI service is not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Choose system prompt based on mode
    const systemPrompt = writeMode
      ? WRITE_SYSTEM_PROMPT
      : buildSystemPrompt(context)

    const payload = {
      model: 'meta/llama-3.3-70b-instruct',
      messages: [{ role: 'system', content: systemPrompt }, ...sanitizedMessages],
      temperature: writeMode ? 0.8 : 0.7,
      top_p: 0.95,
      max_tokens: writeMode ? 512 : 2048,
      stream: true,
    }

    console.log(`[chat-assistant] mode=${writeMode ? 'write' : 'chat'}, msgs=${sanitizedMessages.length}, hasContext=${!!context}`)

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
