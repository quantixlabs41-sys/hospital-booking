import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useState, useCallback } from 'react'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { DeviceProvider } from './context/DeviceContext'
import { ToastContainer } from 'react-toastify'
import ProtectedRoute from './routes/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { SkeletonDashboard } from './components/SkeletonLoader'
import ScrollToTop from './components/ScrollToTop'
import SplashScreen from './components/SplashScreen'
import ChatAssistant from './components/ChatAssistant'

// ── Lazy-loaded Pages (route-based code splitting) ──

// Public Pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const DoctorSearch = lazy(() => import('./pages/patient/DoctorSearch'))
const DoctorProfile = lazy(() => import('./pages/patient/DoctorProfile'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Collaborate Pages
const CollaborateApplication = lazy(() => import('./pages/collaborate/CollaborateApplication'))

// Legal Pages
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'))
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'))

// Onboarding
const OnboardingWizard = lazy(() => import('./pages/onboarding/OnboardingWizard'))

// Shared Pages
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'))

// Patient Pages
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'))
const MyAppointments = lazy(() => import('./pages/patient/MyAppointments'))
const NotificationPreferences = lazy(() => import('./pages/patient/NotificationPreferences'))
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'))

// Doctor Pages
const DoctorLayout = lazy(() => import('./pages/doctor/DoctorLayout'))
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'))
const DoctorAppointments = lazy(() => import('./pages/doctor/DoctorAppointments'))
const DoctorAvailability = lazy(() => import('./pages/doctor/DoctorAvailability'))
const DoctorProfileEdit = lazy(() => import('./pages/doctor/DoctorProfileEdit'))

// Admin Pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const ManageDoctors = lazy(() => import('./pages/admin/ManageDoctors'))
const ManagePatients = lazy(() => import('./pages/admin/ManagePatients'))
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const AdminWhatsAppPanel = lazy(() => import('./pages/admin/AdminWhatsAppPanel'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const AdminCollaborate = lazy(() => import('./pages/admin/AdminCollaborate'))

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Splash Screen — shown on cold start */}
        {!splashDone && (
          <SplashScreen
            onComplete={handleSplashComplete}
            isReady={true}
          />
        )}

        <NotificationProvider>
          <DeviceProvider>
            <ErrorBoundary>
              <ScrollToTop />
              <main id="main-content">
              <Suspense fallback={<SkeletonDashboard />}>
                <Routes>
                  {/* ── Public Routes ── */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/doctors" element={<DoctorSearch />} />
                  <Route path="/doctors/:id" element={<DoctorProfile />} />
                  <Route path="/collaborate" element={<CollaborateApplication />} />

                  {/* ── Legal Pages ── */}
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                  {/* ── Onboarding ── */}
                  <Route path="/onboarding" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR']}>
                      <OnboardingWizard />
                    </ProtectedRoute>
                  } />

                  {/* ── Shared Authenticated Routes ── */}
                  <Route path="/notifications" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
                      <NotificationCenter />
                    </ProtectedRoute>
                  } />

                  {/* ── Patient Routes ── */}
                  <Route path="/patient/dashboard" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <PatientDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/patient/appointments" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <MyAppointments />
                    </ProtectedRoute>
                  } />
                  <Route path="/patient/notification-preferences" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <NotificationPreferences />
                    </ProtectedRoute>
                  } />
                  <Route path="/patient/profile" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <PatientProfile />
                    </ProtectedRoute>
                  } />

                  {/* ── Doctor Routes (nested layout) ── */}
                  <Route path="/doctor" element={
                    <ProtectedRoute allowedRoles={['DOCTOR']}>
                      <DoctorLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<DoctorDashboard />} />
                    <Route path="appointments" element={<DoctorAppointments />} />
                    <Route path="availability" element={<DoctorAvailability />} />
                    <Route path="profile" element={<DoctorProfileEdit />} />
                  </Route>

                  {/* ── Admin Routes (nested layout) ── */}
                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="doctors" element={<ManageDoctors />} />
                    <Route path="patients" element={<ManagePatients />} />
                    <Route path="appointments" element={<AdminAppointments />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="whatsapp" element={<AdminWhatsAppPanel />} />
                    <Route path="collaborate" element={<AdminCollaborate />} />
                    <Route path="profile" element={<AdminProfile />} />
                  </Route>

                  {/* ── 404 ── */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </main>
            </ErrorBoundary>

            {/* Accessible toast announcer (Priority 8 — toast-accessibility) */}
            <div aria-live="polite" aria-atomic="true" className="sr-only" id="toast-announcer" />

            <ToastContainer
              position="top-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
            <ChatAssistant />
          </DeviceProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
