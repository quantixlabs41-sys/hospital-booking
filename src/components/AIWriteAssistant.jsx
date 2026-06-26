import { useState, useRef, useEffect } from 'react'
import { aiWriteText } from '../services/aiWriteService'
import './AIWriteAssistant.css'

/**
 * AI Writing Assistant — sparkle button that generates/improves text for form fields.
 *
 * @param {string} fieldName - Name of the field (e.g. 'bio', 'address')
 * @param {string} currentValue - Current text in the field
 * @param {object} context - Additional context for generation (name, role, specialization, etc.)
 * @param {Function} onGenerated - Callback with generated text
 * @param {string} [placeholder] - Custom placeholder text for the generate option
 */
export default function AIWriteAssistant({ fieldName, currentValue, context = {}, onGenerated, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMode, setLoadingMode] = useState(null)
  const popoverRef = useRef(null)

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  async function handleAction(mode) {
    setLoading(true)
    setLoadingMode(mode)
    try {
      const result = await aiWriteText(mode, fieldName, currentValue, context)
      onGenerated(result)
      setIsOpen(false)
    } catch (err) {
      console.error('AI Write error:', err)
      // Could show a toast here, but keeping it simple
    } finally {
      setLoading(false)
      setLoadingMode(null)
    }
  }

  const hasText = currentValue?.trim()?.length > 0

  return (
    <div className="ai-write-container" ref={popoverRef}>
      <button
        type="button"
        className={`ai-write-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AI Writing Assistant"
        aria-label="AI Writing Assistant"
      >
        <span className="ai-write-sparkle">✨</span>
        <span className="ai-write-label">AI Write</span>
      </button>

      {isOpen && (
        <div className="ai-write-popover">
          <div className="ai-write-popover-header">
            <i className="bi bi-stars"></i> AI Writing Assistant
          </div>
          <div className="ai-write-popover-options">
            <button
              className="ai-write-option"
              onClick={() => handleAction('generate')}
              disabled={loading}
            >
              <i className="bi bi-magic"></i>
              <div>
                <div className="ai-write-option-title">
                  {loading && loadingMode === 'generate' ? 'Generating...' : 'Generate for me'}
                </div>
                <div className="ai-write-option-desc">
                  {placeholder || `AI writes a ${fieldName} from scratch`}
                </div>
              </div>
              {loading && loadingMode === 'generate' && (
                <div className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} />
              )}
            </button>

            {hasText && (
              <>
                <button
                  className="ai-write-option"
                  onClick={() => handleAction('improve')}
                  disabled={loading}
                >
                  <i className="bi bi-pencil-square"></i>
                  <div>
                    <div className="ai-write-option-title">
                      {loading && loadingMode === 'improve' ? 'Improving...' : 'Improve my text'}
                    </div>
                    <div className="ai-write-option-desc">Make it clearer and better written</div>
                  </div>
                  {loading && loadingMode === 'improve' && (
                    <div className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  )}
                </button>

                <button
                  className="ai-write-option"
                  onClick={() => handleAction('professional')}
                  disabled={loading}
                >
                  <i className="bi bi-briefcase"></i>
                  <div>
                    <div className="ai-write-option-title">
                      {loading && loadingMode === 'professional' ? 'Rewriting...' : 'Make it professional'}
                    </div>
                    <div className="ai-write-option-desc">Rewrite in a polished, formal tone</div>
                  </div>
                  {loading && loadingMode === 'professional' && (
                    <div className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
