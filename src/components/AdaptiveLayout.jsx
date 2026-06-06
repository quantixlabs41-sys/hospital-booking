import { useDevice } from '../context/DeviceContext'
import Navbar from './Navbar'
import MobileBottomNav from './MobileBottomNav'
import Footer from './Footer'
import { useAuth } from '../context/AuthContext'

/**
 * AdaptiveLayout wraps pages and adjusts the chrome
 * (navbar, bottom nav, footer) based on device type.
 */
export default function AdaptiveLayout({ children, hideNavbar = false, hideFooter = false }) {
  const { isMobile } = useDevice()
  const { user } = useAuth()

  return (
    <div className={`adaptive-layout ${isMobile ? 'adaptive-mobile' : 'adaptive-desktop'}`}>
      {/* Navbar: always visible on desktop, conditional on mobile */}
      {!hideNavbar && <Navbar />}

      {/* Main content area */}
      <main className={isMobile && user ? 'main-with-bottom-nav' : ''}>
        {children}
      </main>

      {/* Footer: hidden on mobile when logged in (bottom nav replaces it) */}
      {!hideFooter && !(isMobile && user) && <Footer />}

      {/* Mobile bottom nav: only on mobile when authenticated */}
      {isMobile && user && <MobileBottomNav />}
    </div>
  )
}
