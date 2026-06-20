import { useState, useRef, useEffect } from 'react'
import { streamChatCompletion } from '../services/chatService'
import './ChatAssistant.css'

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi there! I am MediBook AI Assistant. How can I help you today?' }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, thinkingContent])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputMessage.trim() || isTyping) return

    const userMessage = { role: 'user', content: inputMessage.trim() }
    const updatedMessages = [...messages, userMessage]
    
    setMessages(updatedMessages)
    setInputMessage('')
    setIsTyping(true)
    setThinkingContent('')

    try {
      // Add a placeholder assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }])

      await streamChatCompletion(updatedMessages, ({ text, reasoning }) => {
        setThinkingContent(reasoning)
        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: text,
            isStreaming: true
          }
          return newMessages
        })
      })

      // Finalize the message
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].isStreaming = false
        return newMessages
      })
      setThinkingContent('')
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your request.',
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
        onClick={() => setIsOpen(!isOpen)}
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

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble-wrapper ${msg.role}`}>
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
            />
            <button type="submit" disabled={!inputMessage.trim() || isTyping}>
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
