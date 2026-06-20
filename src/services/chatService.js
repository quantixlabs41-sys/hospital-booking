// chatService.js
// Calls the NVIDIA NIM API directly from the browser using the VITE_NVIDIA_API_KEY env variable.

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'

// System prompt to give the assistant relevant context about the app
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

/**
 * Sends messages directly to the NVIDIA NIM API with streaming
 * @param {Array} messages - Array of { role: 'user' | 'assistant', content: string }
 * @param {Function} onChunk - Callback({ text: string, reasoning: string })
 */
export async function streamChatCompletion(messages, onChunk) {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY

  if (!apiKey) {
    throw new Error('VITE_NVIDIA_API_KEY is not set in your .env file. Please restart the dev server after adding it.')
  }

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [SYSTEM_PROMPT, ...messages],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 1024,
      stream: true,
      extra_body: {
        chat_template_kwargs: { enable_thinking: true },
        reasoning_budget: 512,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('NVIDIA API error:', response.status, errText)
    throw new Error(`NVIDIA API error ${response.status}: ${errText}`)
  }

  // Parse SSE streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let currentText = ''
  let currentReasoning = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue

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
        // Ignore partial chunk parse errors
      }
    }
  }
}
