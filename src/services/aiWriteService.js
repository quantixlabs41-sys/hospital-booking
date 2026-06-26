// aiWriteService.js
// AI-powered text generation for profile fields (bio, medical info, etc.)
// Uses the same chat-assistant Edge Function with a writing-specific prompt.

/**
 * Generate or improve text using AI.
 *
 * @param {'generate' | 'improve' | 'professional'} mode
 * @param {string} fieldName - The field being written (e.g. 'bio', 'medical history')
 * @param {string} currentValue - Current text in the field (empty for generate)
 * @param {object} context - Additional context { name, role, ... }
 * @returns {Promise<string>} The generated text
 */
export async function aiWriteText(mode, fieldName, currentValue, context = {}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing.')
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat-assistant`

  // Build a writing-specific prompt
  let userPrompt = ''

  if (mode === 'generate') {
    userPrompt = `Write a brief, warm, and professional ${fieldName} for a ${context.role || 'user'} named "${context.name || 'the user'}".`
    if (context.specialization) {
      userPrompt += ` They specialize in ${context.specialization}.`
    }
    if (context.experience) {
      userPrompt += ` They have ${context.experience} years of experience.`
    }
    userPrompt += ` Keep it under 300 characters, conversational, and in first person.`
  } else if (mode === 'improve') {
    userPrompt = `Improve the following ${fieldName} text. Make it clearer, more professional, and well-written. Keep the same meaning and length. Return ONLY the improved text, nothing else:\n\n"${currentValue}"`
  } else if (mode === 'professional') {
    userPrompt = `Rewrite the following ${fieldName} in a professional, polished tone. Return ONLY the rewritten text, nothing else:\n\n"${currentValue}"`
  }

  const messages = [{ role: 'user', content: userPrompt }]

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      messages,
      writeMode: true, // tells edge function to use a writing system prompt
    }),
  })

  if (!response.ok) {
    throw new Error('AI writing service failed. Please try again.')
  }

  // Parse the streaming response and collect the full text
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
        try {
          const data = JSON.parse(trimmed.slice(6))
          const content = data.choices?.[0]?.delta?.content
          if (content) result += content
        } catch {
          // Ignore malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Clean up any surrounding quotes the AI might add
  result = result.trim().replace(/^["']|["']$/g, '')

  if (!result) {
    throw new Error('AI returned empty text. Please try again.')
  }

  return result
}
