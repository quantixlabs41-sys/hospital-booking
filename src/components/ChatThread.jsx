import { useState, useEffect, useRef, useCallback } from 'react'
import { getMessages, sendMessage, markConversationRead, subscribeToConversation } from '../services/chat'
import { toast } from 'react-toastify'

/**
 * Chat-style message thread for one conversation.
 *
 * Props:
 * - conversationId
 * - currentUserId
 * - title       — name shown in the header (the other party)
 * - subtitle    — optional (e.g. specialization)
 * - onActivity  — called after sending/receiving so the parent can refresh the list
 */
export default function ChatThread({ conversationId, currentUserId, title, subtitle, onActivity, onBack }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  // Load history + mark read + subscribe to realtime inserts.
  useEffect(() => {
    if (!conversationId) return
    let alive = true
    setLoading(true)

    async function load() {
      try {
        const msgs = await getMessages(conversationId)
        if (!alive) return
        setMessages(msgs)
        scrollToBottom()
        await markConversationRead(conversationId, currentUserId)
        onActivity?.()
      } catch (err) {
        toast.error(err.message || 'Could not load messages.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()

    const unsubscribe = subscribeToConversation(conversationId, async (msg) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      scrollToBottom()
      if (msg.sender_id !== currentUserId) {
        try {
          await markConversationRead(conversationId, currentUserId)
          onActivity?.()
        } catch { /* ignore */ }
      }
    })

    return () => { alive = false; unsubscribe() }
  }, [conversationId, currentUserId, scrollToBottom, onActivity])

  async function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    try {
      setSending(true)
      const sent = await sendMessage(conversationId, currentUserId, text)
      // Realtime echoes our own insert too; guard against duplicates.
      setMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent])
      scrollToBottom()
      onActivity?.()
    } catch (err) {
      toast.error(err.message || 'Could not send.')
      setDraft(text) // restore so the user doesn't lose their message
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-thread" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 12, background: 'white' }}>
        {onBack && (
          <button
            className="btn-ghost"
            style={{ padding: '4px 8px', marginLeft: -6 }}
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <i className="bi bi-arrow-left" style={{ fontSize: 18 }} />
          </button>
        )}
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
          {title?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--gray-400)' }} className="truncate">{subtitle}</div>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', background: 'var(--gray-50)', minHeight: 0 }}>
        {loading ? (
          <div className="text-center py-4"><div className="spinner-custom" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center" style={{ color: 'var(--gray-400)', fontSize: 13, marginTop: 24 }}>
            No messages yet. Say hello 👋
          </div>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === currentUserId
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                  background: mine ? 'var(--primary)' : 'white',
                  color: mine ? 'white' : 'var(--gray-800)',
                  borderBottomRightRadius: mine ? 2 : 12,
                  borderBottomLeftRadius: mine ? 12 : 2,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.body}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {mine && <i className={`bi ${m.read_at ? 'bi-check2-all' : 'bi-check2'} ms-1`} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--gray-200)', background: 'white' }}>
        <input
          type="text"
          className="form-input-custom"
          placeholder="Type a message..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={4000}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-primary-custom" disabled={sending || !draft.trim()} style={{ padding: '0 18px' }}>
          <i className="bi bi-send-fill" />
        </button>
      </form>
    </div>
  )
}
