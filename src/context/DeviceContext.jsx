import { createContext, useContext } from 'react'
import useDeviceDetect from '../hooks/useDeviceDetect'

const DeviceContext = createContext({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  deviceType: 'desktop',
  orientation: 'landscape',
  screenWidth: 1920
})

export function DeviceProvider({ children }) {
  const device = useDeviceDetect()

  return (
    <DeviceContext.Provider value={device}>
      {children}
    </DeviceContext.Provider>
  )
}

export const useDevice = () => useContext(DeviceContext)
