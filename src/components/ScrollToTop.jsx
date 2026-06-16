import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop + Focus Management on Route Change.
 * Per Priority 9 (focus-on-route-change) — moves focus to main content
 * after navigation so screen readers announce the new page.
 *
 * Place this component inside <BrowserRouter> in App.jsx.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({ top: 0, behavior: 'instant' })

    // Move focus to main content area for screen readers
    const main = document.getElementById('main-content') || document.querySelector('main')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
      // Remove tabindex after focus so it doesn't interfere with normal tab order
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })
    }
  }, [pathname])

  return null
}
