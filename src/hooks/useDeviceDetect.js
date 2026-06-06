import { useState, useEffect, useCallback } from 'react'

/**
 * Multi-signal device detection hook.
 * Uses CSS media queries, touch capability, and resize events.
 */
export default function useDeviceDetect() {
  const getDeviceInfo = useCallback(() => {
    const width = window.innerWidth
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const hasNoHover = window.matchMedia('(hover: none)').matches
    const isPortrait = window.innerHeight > window.innerWidth

    // Multi-signal mobile detection
    const isMobileWidth = width <= 768
    const isTabletWidth = width > 768 && width <= 1024
    const isDesktopWidth = width > 1024

    // A device is "mobile" if it has a small screen OR is touch-primary
    const isMobile = isMobileWidth || (isTouchDevice && isCoarsePointer && width <= 768)
    const isTablet = isTabletWidth || (isTouchDevice && isCoarsePointer && width > 768 && width <= 1024)
    const isDesktop = isDesktopWidth && !isCoarsePointer

    let deviceType = 'desktop'
    if (isMobile) deviceType = 'mobile'
    else if (isTablet) deviceType = 'tablet'

    return {
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      isCoarsePointer,
      hasNoHover,
      orientation: isPortrait ? 'portrait' : 'landscape',
      screenWidth: width,
      screenHeight: window.innerHeight,
      deviceType
    }
  }, [])

  const [device, setDevice] = useState(getDeviceInfo)

  useEffect(() => {
    let rafId = null

    function handleResize() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setDevice(getDeviceInfo())
      })
    }

    // Listen to resize and orientation change
    window.addEventListener('resize', handleResize, { passive: true })
    window.addEventListener('orientationchange', handleResize, { passive: true })

    // Also listen for media query changes
    const mobileQuery = window.matchMedia('(max-width: 768px)')
    const tabletQuery = window.matchMedia('(max-width: 1024px)')

    const handleMediaChange = () => handleResize()
    mobileQuery.addEventListener('change', handleMediaChange)
    tabletQuery.addEventListener('change', handleMediaChange)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      mobileQuery.removeEventListener('change', handleMediaChange)
      tabletQuery.removeEventListener('change', handleMediaChange)
    }
  }, [getDeviceInfo])

  return device
}
