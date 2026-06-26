// chatSessions.js
// Manages chat session persistence in Supabase.
// Each user has sessions containing ordered messages.

import { supabase } from '../lib/supabase'

/**
 * Get or create the active chat session for a user.
 * Returns the most recent session, or creates a new one.
 */
export async function getOrCreateSession(userId) {
  // Try to get the most recent session
  const { data: existing, error: fetchErr } = await supabase
    .from('chat_sessions')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) throw fetchErr

  if (existing) return existing

  // No session exists — create one
  return createSession(userId)
}

/**
 * Create a new chat session.
 */
export async function createSession(userId, title = 'New Chat') {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert([{ user_id: userId, title }])
    .select('id, title, updated_at')
    .single()

  if (error) throw error
  return data
}

/**
 * Load all messages for a session, ordered chronologically.
 */
export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Save a single message to a session.
 * Also touches the session's updated_at via trigger.
 */
export async function saveMessage(sessionId, role, content) {
  if (!content?.trim()) return null

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{ session_id: sessionId, role, content }])
    .select('id, role, content, created_at')
    .single()

  if (error) throw error

  // Touch the session to update its updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  return data
}

/**
 * Start a new chat session (clears current context).
 * Returns the new session.
 */
export async function startNewSession(userId) {
  return createSession(userId, 'New Chat')
}

/**
 * Update session title (auto-generated from first user message).
 */
export async function updateSessionTitle(sessionId, title) {
  const { error } = await supabase
    .from('chat_sessions')
    .update({ title: title.slice(0, 100) })
    .eq('id', sessionId)

  if (error) throw error
}
