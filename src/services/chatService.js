// chatService.js
// Calls the Supabase Edge Function (chat-assistant) which proxies to NVIDIA NIM.
// Now includes context building for patient history, doctors, and appointments.

import { supabase } from '../lib/supabase'

/**
 * Build real-time context about the patient, their appointments, and available doctors.
 * This context is injected into the AI system prompt server-side.
 *
 * @param {string} userId - The authenticated user's UUID
 * @returns {object} Context object with patient, appointments, and doctors data
 */
export async function buildChatContext(userId) {
  const context = { patient: null, appointments: [], doctors: [] }

  try {
    // 1. Patient profile + medical details
    const [profileRes, patientRes] = await Promise.all([
      supabase.from('profiles').select('name, phone, role, date_of_birth, gender, bio').eq('id', userId).single(),
      supabase.from('patients').select('blood_group, address, emergency_contact').eq('user_id', userId).maybeSingle(),
    ])

    if (profileRes.data) {
      context.patient = {
        name: profileRes.data.name,
        role: profileRes.data.role,
        gender: profileRes.data.gender,
        date_of_birth: profileRes.data.date_of_birth,
        ...(patientRes.data || {}),
      }
    }

    // 2. Recent & upcoming appointments (last 10)
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_start_time, status, reason,
        doctors (id, specialization, consultation_fee, profiles:user_id (name))
      `)
      .eq('patient_id', userId)
      .order('appointment_date', { ascending: false })
      .limit(10)

    if (appointments) {
      context.appointments = appointments.map(apt => ({
        date: apt.appointment_date,
        time: apt.slot_start_time,
        status: apt.status,
        reason: apt.reason,
        doctor_name: apt.doctors?.profiles?.name || 'Unknown',
        specialization: apt.doctors?.specialization || 'General',
        fee: apt.doctors?.consultation_fee,
      }))
    }

    // 3. Active doctors on the platform (top 20)
    const { data: doctors } = await supabase
      .from('doctors')
      .select(`id, specialization, consultation_fee, experience_years, profiles:user_id (name)`)
      .eq('is_active', true)
      .order('experience_years', { ascending: false })
      .limit(20)

    if (doctors) {
      context.doctors = doctors.map(doc => ({
        id: doc.id,
        name: doc.profiles?.name || 'Doctor',
        specialization: doc.specialization,
        fee: doc.consultation_fee,
        experience: doc.experience_years,
      }))
    }
  } catch (err) {
    // Non-fatal — chatbot works without context, just less personalized
    if (import.meta.env.DEV) {
      console.warn('Failed to build chat context:', err)
    }
  }

  return context
}

/**
 * Sends messages to the chat-assistant Edge Function with streaming.
 *
 * @param {Array} messages - Array of { role, content }
 * @param {Function} onChunk - Callback({ text, reasoning })
 * @param {AbortSignal} [signal] - Optional AbortController signal
 * @param {object} [context] - Patient/doctor context from buildChatContext()
 * @param {boolean} [writeMode] - If true, use writing assistant system prompt
 */
export async function streamChatCompletion(messages, onChunk, signal, context = null, writeMode = false) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing. Check your .env file.')
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat-assistant`

  // Only send role + content to the backend
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
      body: JSON.stringify({
        messages: cleanMessages,
        ...(context && { context }),
        ...(writeMode && { writeMode: true }),
      }),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('Unable to reach the AI service. Please check your connection.')
  }

  if (!response.ok) {
    let errorMessage = `AI service error (${response.status}).`
    try {
      const errBody = await response.json()
      if (errBody.error) errorMessage = errBody.error
    } catch { /* not JSON */ }

    if (import.meta.env.DEV) console.error('Chat Edge Function error:', response.status, errorMessage)

    if (response.status === 503) throw new Error('AI service is not configured yet. Please contact the administrator.')
    if (response.status === 504) throw new Error('The AI is taking too long to respond. Please try a shorter message.')
    throw new Error(errorMessage)
  }

  // Parse SSE streaming response
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
      buffer = lines.pop() || ''

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
        } catch { /* ignore malformed */ }
      }
    }

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
        } catch { /* ignore */ }
      }
    }

    if (!currentText && !currentReasoning) {
      throw new Error('The AI returned an empty response. Please try again.')
    }
  } finally {
    reader.releaseLock()
  }
}
