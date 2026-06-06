/**
 * MediBook — DevTools Detection
 * Non-blocking detection — logs events and optionally blurs sensitive content.
 * NOT used to block users, only for monitoring + watermarking.
 */

import { logSecurityEvent } from './auditLog'

let isDevToolsOpen = false
let checkInterval = null

/**
 * Detect DevTools opening via timing heuristic.
 * When DevTools is open, certain operations take significantly longer.
 */
function checkDevTools() {
  const start = performance.now()

  // debugger statement is slow when DevTools is open
  // We use a less aggressive approach: image dimension check
  const el = new Image()
  Object.defineProperty(el, 'id', {
    get: function () {
      isDevToolsOpen = true
    }
  })

  // Console.log with the element triggers the getter when DevTools is open
  console.debug(el)

  // Threshold-based detection
  const widthThreshold = window.outerWidth - window.innerWidth > 160
  const heightThreshold = window.outerHeight - window.innerHeight > 160

  const wasOpen = isDevToolsOpen
  isDevToolsOpen = widthThreshold || heightThreshold

  // State changed — log event
  if (isDevToolsOpen && !wasOpen) {
    logSecurityEvent('DEVTOOLS_OPENED', {
      method: 'dimension_check',
      outerWidth: window.outerWidth,
      innerWidth: window.innerWidth,
      outerHeight: window.outerHeight,
      innerHeight: window.innerHeight
    })

    // Add watermark to sensitive content
    addDevToolsWatermark()
  } else if (!isDevToolsOpen && wasOpen) {
    removeDevToolsWatermark()
  }
}

function addDevToolsWatermark() {
  if (document.getElementById('devtools-watermark')) return

  const watermark = document.createElement('div')
  watermark.id = 'devtools-watermark'
  watermark.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 99999;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 200px,
      rgba(0,119,182,0.03) 200px,
      rgba(0,119,182,0.03) 400px
    );
  `

  const text = document.createElement('div')
  text.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 48px;
    font-weight: 800;
    color: rgba(0,119,182,0.06);
    white-space: nowrap;
    pointer-events: none;
    font-family: var(--font-display), system-ui;
    letter-spacing: 4px;
  `
  text.textContent = 'MEDIBOOK PROTECTED'
  watermark.appendChild(text)

  document.body.appendChild(watermark)
}

function removeDevToolsWatermark() {
  const el = document.getElementById('devtools-watermark')
  if (el) el.remove()
}

export function startDevToolsDetection() {
  // Check every 2 seconds
  checkInterval = setInterval(checkDevTools, 2000)
  // Initial check
  checkDevTools()
}

export function stopDevToolsDetection() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  removeDevToolsWatermark()
}

export function getDevToolsState() {
  return isDevToolsOpen
}
