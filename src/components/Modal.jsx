import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Accessible Modal with focus trap, ESC key close, overlay click close.
 * Uses React Portal for proper z-index layering.
 * Per Priority 1 (keyboard-nav) and Priority 7 (modal-motion).
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Called when modal should close
 * @param {string} title - Modal title (used for aria-labelledby)
 * @param {'sm'|'md'|'lg'} size - Modal width variant
 * @param {React.ReactNode} children - Modal body content
 * @param {React.ReactNode} footer - Optional footer content
 * @param {boolean} closeOnOverlay - Whether clicking overlay closes modal (default: true)
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  className = '',
}) {
  const modalRef = useRef(null)
  const previousActiveElement = useRef(null)

  const sizeMap = { sm: 384, md: 512, lg: 640, xl: 768 }
  const maxWidth = sizeMap[size] || sizeMap.md

  // Focus trap: get all focusable elements inside the modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return []
    return modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  }, [])

  // Trap focus inside modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'Tab') {
      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }, [onClose, getFocusableElements])

  // Lock body scroll and manage focus
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      document.body.style.overflow = 'hidden'

      // Focus the modal after render
      requestAnimationFrame(() => {
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
          focusable[0].focus()
        } else if (modalRef.current) {
          modalRef.current.focus()
        }
      })
    }

    return () => {
      document.body.style.overflow = ''
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, getFocusableElements])

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-overlay"
      onClick={closeOnOverlay ? onClose : undefined}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal-dialog-custom ${className}`}
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-custom">
          <h3 id="modal-title" className="modal-title-custom">{title}</h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-custom">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer-custom">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
