// chatService.js
// Calls the Supabase Edge Function (chat-assistant) which proxies to NVIDIA NIM.
// The API key is stored in Supabase Secrets — never exposed to the client.

/**
 * Sends messages to the chat-assistant Edge Function with streaming.
 *
 * The Edge Function handles:
 *   - System prompt injection (server-side, tamper-proof)
 *   - NVIDIA API key management (via Supabase Secrets)
 *   - Input validation and length capping
 *
 * @param {Array} messages - Array of { role: 'user' | 'assistant', content: string }
 * @param {Function} onChunk - Callback({ text: string, reasoning: string })
 * @param {AbortSignal} [signal] - Optional AbortController signal to cancel the request
 */
export async function streamChatCompletion(messages, onChunk, signal) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing. Check your .env file.')
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat-assistant`

  // Only send role + content to the backend (strip internal UI fields)
  const cleanMessages = messages.map(({ role, content }) => ({ role, content }))

  let response
  try {
    response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ messages: cleanMessages }),
    })
  } catch (err) {
    // Network error or abort
    if (err.name === 'AbortError') throw err
    throw new Error('Unable to reach the AI service. Please check your connection.')
  }

  if (!response.ok) {
    let errorMessage = `AI service error (${response.status}).`
    try {
      const errBody = await response.json()
      if (errBody.error) {
        errorMessage = errBody.error
      }
    } catch {
      // Response wasn't JSON, use default message
    }

    if (import.meta.env.DEV) {
      console.error('Chat Edge Function error:', response.status, errorMessage)
    }

    // Give user-friendly messages for known error codes
    if (response.status === 503) {
      throw new Error('AI service is not configured yet. Please contact the administrator.')
    }
    if (response.status === 504) {
      throw new Error('The AI is taking too long to respond. Please try a shorter message.')
    }
    throw new Error(errorMessage)
  }

  // Parse SSE streaming response with proper buffering for partial chunks
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentText = ''
  let currentReasoning = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue

        try {
          const data = JSON.parse(trimmed.slice(6))
          const delta = data.choices?.[0]?.delta || {}

          // Handle reasoning content (if model supports it)
          if (delta.reasoning_content) {
            currentReasoning += delta.reasoning_content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
          // Handle regular content
          if (delta.content) {
            currentText += delta.content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
        } catch {
          // Ignore malformed JSON lines
        }
      }
    }

    // Flush remaining bytes
    const remaining = decoder.decode()
    if (remaining) {
      buffer += remaining
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6))
          const delta = data.choices?.[0]?.delta || {}
          if (delta.reasoning_content) {
            currentReasoning += delta.reasoning_content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
          if (delta.content) {
            currentText += delta.content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
        } catch {
          // Ignore
        }
      }
    }

    // If we got no content at all, throw a meaningful error
    if (!currentText && !currentReasoning) {
      throw new Error('The AI returned an empty response. Please try again.')
    }
  } finally {
    reader.releaseLock()
  }
}
