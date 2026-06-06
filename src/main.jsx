import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'react-toastify/dist/ReactToastify.css'

// ── Security Initialization ──
import { initTamperDetection } from './security/tamperDetect.js'
import { initAntiScraping } from './security/antiScrape.js'
import { startDevToolsDetection } from './security/devtoolsDetect.js'

// Initialize security modules
const cleanupTamper = initTamperDetection()
const cleanupAntiScrape = initAntiScraping()
startDevToolsDetection()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
