import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChatCompletion, buildChatContext } from '../services/chatService'
import { getOrCreateSession, getSessionMessages, saveMessage, startNewSession, updateSessionTitle } from '../services/chatSessions'
import { bookAppointment } from '../services/appointments'
import { sanitizeInput } from '../security/sanitize'
import { useAuth } from '../context/AuthContext'
import './ChatAssistant.css'

/**
 * Lightweight markdown-to-HTML renderer for chat bubbles.
 */
function parseMarkdown(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="chat-list-item numbered"><span class="chat-list-num">$1.</span> $2</li>')
    .replace(/^[-•]\s+(.+)$/gm, '<li class="chat-list-item bullet">$1</li>')
    .replace(/\n/g, '<br/>')
  return html
}

/**
 * Parse action blocks from AI response.
 * Returns { cleanText, action } where action is the parsed JSON or null.
 */
function parseActionBlock(text) {
  const actionMatch = text.match(/```action\s*\n?([\s\S]*?)```/)
  if (!actionMatch) return { cleanText: text, action: null }

  try {
    const action = JSON.parse(actionMatch[1].trim())
    const cleanText = text.replace(/```action\s*\n?[\s\S]*?```/, '').trim()
    return { cleanText, action }
  } catch {
    return { cleanText: text, action: null }
  }
}

const SEND_COOLDOWN_MS = 3000
const MAX_INPUT_LENGTH = 2000
const WELCOME_MSG = { id: 'welcome', role: 'assistant', content: 'Hi there! I am MediBook AI Assistant. How can I help you today?' }

export default function ChatAssistant() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [chatContext, setChatContext] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [bookingInProgress, setBookingInProgress] = useState(false)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const lastSentRef = useRef(0)
  const contextLoadedRef = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, thinkingContent])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Load session + context when chat opens and user is authenticated
  useEffect(() => {
    if (isOpen && user && !contextLoadedRef.current) {
      contextLoadedRef.current = true
      loadSessionAndContext()
    }
  }, [isOpen, user])

  async function loadSessionAndContext() {
    try {
      // Load or create chat session
      const session = await getOrCreateSession(user.id)
      setSessionId(session.id)

      // Load existing messages
      const savedMessages = await getSessionMessages(session.id)
      if (savedMessages.length > 0) {
        const formattedMessages = savedMessages.map(m => ({
          id: m.id.toString(),
          role: m.role,
          content: m.content,
        }))
        setMessages([WELCOME_MSG, ...formattedMessages])
      }

      // Build context (patient info, doctors, appointments)
      const ctx = await buildChatContext(user.id)
      setChatContext(ctx)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load chat session:', err)
    }
  }

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        abortRef.current?.abort()
      }
      return !prev
    })
  }, [])

  async function handleNewChat() {
    if (!user) return
    try {
      abortRef.current?.abort()
      const session = await startNewSession(user.id)
      setSessionId(session.id)
      setMessages([WELCOME_MSG])
      setPendingAction(null)
      setThinkingContent('')
      setIsTyping(false)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to create new session:', err)
    }
  }

  async function handleBookingConfirm() {
    if (!pendingAction || bookingInProgress) return
    setBookingInProgress(true)

    try {
      const action = pendingAction
      setPendingAction(null)

      await bookAppointment({
        patient_id: user.id,
        doctor_id: action.doctor_id,
        appointment_date: action.date,
        slot_start_time: action.slot,
        reason: `Booked via AI Assistant — ${action.specialization}`,
      })

      const successMsg = `✅ Appointment booked successfully!\n\n**Doctor:** Dr. ${action.doctor_name}\n**Specialization:** ${action.specialization}\n**Date:** ${action.date}\n**Time:** ${action.slot}\n**Fee:** ₹${action.fee || 'N/A'}\n\nYou'll receive a confirmation notification shortly.`

      const msgObj = { id: crypto.randomUUID(), role: 'assistant', content: successMsg }
      setMessages(prev => [...prev, msgObj])

      if (sessionId) await saveMessage(sessionId, 'assistant', successMsg)

      // Refresh context to reflect the new booking
      const ctx = await buildChatContext(user.id)
      setChatContext(ctx)
    } catch (err) {
      const errorMsg = `❌ Booking failed: ${err.message}`
      const msgObj = { id: crypto.randomUUID(), role: 'assistant', content: errorMsg, isError: true }
      setMessages(prev => [...prev, msgObj])
      if (sessionId) await saveMessage(sessionId, 'assistant', errorMsg)
    } finally {
      setBookingInProgress(false)
    }
  }

  function handleBookingCancel() {
    setPendingAction(null)
    const cancelMsg = 'No problem! Booking cancelled. Is there anything else I can help with?'
    const msgObj = { id: crypto.randomUUID(), role: 'assistant', content: cancelMsg }
    setMessages(prev => [...prev, msgObj])
    if (sessionId) saveMessage(sessionId, 'assistant', cancelMsg)
  }

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    const trimmed = inputMessage.trim()
    if (!trimmed || isTyping) return

    const now = Date.now()
    if (now - lastSentRef.current < SEND_COOLDOWN_MS) return
    lastSentRef.current = now

    const sanitizedContent = sanitizeInput(trimmed).slice(0, MAX_INPUT_LENGTH)
    if (!sanitizedContent) return

    const userMessage = { id: crypto.randomUUID(), role: 'user', content: sanitizedContent }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInputMessage('')
    setIsTyping(true)
    setThinkingContent('')
    setPendingAction(null)

    // Persist user message
    if (sessionId) {
      saveMessage(sessionId, 'user', sanitizedContent)
      // Auto-title session from first user message
      if (messages.length <= 1) {
        updateSessionTitle(sessionId, sanitizedContent.slice(0, 80))
      }
    }

    abortRef.current = new AbortController()

    try {
      const assistantId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true }])

      const apiMessages = updatedMessages
        .filter(m => m.id !== 'welcome')
        .map(({ role, content }) => ({ role, content }))

      let fullText = ''

      await streamChatCompletion(apiMessages, ({ text, reasoning }) => {
        fullText = text
        setThinkingContent(reasoning)
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            id: assistantId,
            role: 'assistant',
            content: text,
            isStreaming: true,
          }
          return newMessages
        })
      }, abortRef.current.signal, chatContext)

      // Parse for action blocks
      const { cleanText, action } = parseActionBlock(fullText)

      // Finalize message
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          id: assistantId,
          role: 'assistant',
          content: cleanText || fullText,
          isStreaming: false,
        }
        return newMessages
      })
      setThinkingContent('')

      // Persist assistant message
      if (sessionId) saveMessage(sessionId, 'assistant', cleanText || fullText)

      // Show booking confirmation if action detected
      if (action?.type === 'BOOK_APPOINTMENT') {
        setPendingAction(action)
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages(prev => {
          const newMessages = [...prev]
          if (newMessages[newMessages.length - 1]?.isStreaming) {
            newMessages[newMessages.length - 1].isStreaming = false
          }
          return newMessages
        })
        setThinkingContent('')
        return
      }

      if (import.meta.env.DEV) console.error('Chat error:', error)
      const errorMsg = error?.message || 'Sorry, I encountered an error.'
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMsg,
          isError: true,
          isStreaming: false,
        }
        return newMessages
      })
      setThinkingContent('')
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className={`chat-assistant-container ${isOpen ? 'open' : ''}`}>
      {/* Floating Toggle — only when closed */}
      {!isOpen && (
        <button className="chat-toggle-btn" onClick={handleToggle} aria-label="Open AI Assistant">
          <i className="bi bi-robot"></i>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">
                <i className="bi bi-robot"></i>
              </div>
              <div>
                <h3 className="chat-title">MediBook AI</h3>
                <span className="chat-status">Powered by NVIDIA Nemotron</span>
              </div>
              <button className="chat-header-btn" onClick={handleNewChat} aria-label="New chat" title="New Chat">
                <i className="bi bi-plus-lg"></i>
              </button>
              <button className="chat-minimize-btn" onClick={handleToggle} aria-label="Minimize chat" title="Minimize">
                <i className="bi bi-chevron-down"></i>
              </button>
            </div>
          </div>

          <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble-wrapper ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-bubble-avatar">
                    <i className="bi bi-robot"></i>
                  </div>
                )}
                <div
                  className={`chat-bubble ${msg.isError ? 'error' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(msg.content) || (msg.isStreaming && !thinkingContent ? '...' : '')
                  }}
                />
              </div>
            ))}

            {/* Booking Confirmation Card */}
            {pendingAction?.type === 'BOOK_APPOINTMENT' && (
              <div className="chat-bubble-wrapper assistant">
                <div className="chat-bubble-avatar">
                  <i className="bi bi-robot"></i>
                </div>
                <div className="chat-booking-card">
                  <div className="booking-card-header">
                    <i className="bi bi-calendar-check"></i> Confirm Appointment
                  </div>
                  <div className="booking-card-body">
                    <div className="booking-detail">
                      <span className="booking-label">Doctor</span>
                      <span className="booking-value">Dr. {pendingAction.doctor_name}</span>
                    </div>
                    <div className="booking-detail">
                      <span className="booking-label">Specialization</span>
                      <span className="booking-value">{pendingAction.specialization}</span>
                    </div>
                    <div className="booking-detail">
                      <span className="booking-label">Date</span>
                      <span className="booking-value">{pendingAction.date}</span>
                    </div>
                    <div className="booking-detail">
                      <span className="booking-label">Time</span>
                      <span className="booking-value">{pendingAction.slot}</span>
                    </div>
                    {pendingAction.fee && (
                      <div className="booking-detail">
                        <span className="booking-label">Fee</span>
                        <span className="booking-value">₹{pendingAction.fee}</span>
                      </div>
                    )}
                  </div>
                  <div className="booking-card-actions">
                    <button
                      className="booking-btn confirm"
                      onClick={handleBookingConfirm}
                      disabled={bookingInProgress}
                    >
                      {bookingInProgress ? (
                        <><div className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} /> Booking...</>
                      ) : (
                        <><i className="bi bi-check-lg"></i> Confirm</>
                      )}
                    </button>
                    <button className="booking-btn cancel" onClick={handleBookingCancel} disabled={bookingInProgress}>
                      <i className="bi bi-x-lg"></i> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {thinkingContent && (
              <div className="chat-bubble-wrapper assistant thinking-wrapper">
                <div className="chat-bubble-avatar">
                  <i className="bi bi-robot"></i>
                </div>
                <div className="chat-bubble thinking">
                  <div className="thinking-header">
                    <i className="bi bi-gear-wide-connected spin"></i> Thinking...
                  </div>
                  <div className="thinking-content">{thinkingContent}</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={user ? 'Ask me anything...' : 'Please log in to chat...'}
              disabled={isTyping || !user}
              maxLength={MAX_INPUT_LENGTH}
              aria-label="Type your message"
            />
            <button type="submit" disabled={!inputMessage.trim() || isTyping || !user} aria-label="Send message">
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
