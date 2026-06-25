import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChatCompletion } from '../services/chatService'
import { sanitizeInput } from '../security/sanitize'
import './ChatAssistant.css'

// Rate limit: minimum ms between message sends
const SEND_COOLDOWN_MS = 3000
// Max input length
const MAX_INPUT_LENGTH = 2000

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: 'Hi there! I am MediBook AI Assistant. How can I help you today?' }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const lastSentRef = useRef(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, thinkingContent])

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Cancel in-flight request when chat panel is closed
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing the panel — cancel any in-flight request
        abortRef.current?.abort()
      }
      return !prev
    })
  }, [])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    const trimmed = inputMessage.trim()
    if (!trimmed || isTyping) return

    // Rate limiting — enforce cooldown between sends
    const now = Date.now()
    if (now - lastSentRef.current < SEND_COOLDOWN_MS) return
    lastSentRef.current = now

    // Sanitize user input and enforce length cap
    const sanitizedContent = sanitizeInput(trimmed).slice(0, MAX_INPUT_LENGTH)
    if (!sanitizedContent) return

    const userMessage = { id: crypto.randomUUID(), role: 'user', content: sanitizedContent }
    const updatedMessages = [...messages, userMessage]
    
    setMessages(updatedMessages)
    setInputMessage('')
    setIsTyping(true)
    setThinkingContent('')

    // Create a new AbortController for this request
    abortRef.current = new AbortController()

    try {
      const assistantId = crypto.randomUUID()
      // Add a placeholder assistant message
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true }])

      // Pass only role+content to the API (strip internal fields like id, isStreaming, isError)
      const apiMessages = updatedMessages.map(({ role, content }) => ({ role, content }))

      await streamChatCompletion(apiMessages, ({ text, reasoning }) => {
        setThinkingContent(reasoning)
        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            id: assistantId,
            role: 'assistant',
            content: text,
            isStreaming: true
          }
          return newMessages
        })
      }, abortRef.current.signal)

      // Finalize the message
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].isStreaming = false
        return newMessages
      })
      setThinkingContent('')
    } catch (error) {
      // Don't show error if request was intentionally aborted
      if (error.name === 'AbortError') {
        setMessages((prev) => {
          const newMessages = [...prev]
          if (newMessages[newMessages.length - 1]?.isStreaming) {
            newMessages[newMessages.length - 1].isStreaming = false
          }
          return newMessages
        })
        setThinkingContent('')
        return
      }

      if (import.meta.env.DEV) {
        console.error('Chat error:', error)
      }
      const errorMsg = error?.message || 'Sorry, I encountered an error while processing your request.'
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMsg,
          isError: true,
          isStreaming: false
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
      {/* Floating Toggle Button */}
      <button 
        className="chat-toggle-btn"
        onClick={handleToggle}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? (
          <i className="bi bi-x-lg"></i>
        ) : (
          <i className="bi bi-robot"></i>
        )}
      </button>

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
                <div className={`chat-bubble ${msg.isError ? 'error' : ''}`}>
                  {msg.content || (msg.isStreaming && !thinkingContent ? '...' : '')}
                </div>
              </div>
            ))}
            
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
              placeholder="Ask me anything..."
              disabled={isTyping}
              maxLength={MAX_INPUT_LENGTH}
              aria-label="Type your message"
            />
            <button type="submit" disabled={!inputMessage.trim() || isTyping} aria-label="Send message">
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
