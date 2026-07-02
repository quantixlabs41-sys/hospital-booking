import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy as reactLazy, Suspense, useState, useCallback, useEffect } from 'react'

/**
 * Lazy import with self-healing against stale-chunk 404s.
 *
 * On a new deployment the content-hashed chunk filenames change and the old
 * ones are removed from the production build. A tab that still holds the old
 * index.html (or was open across the deploy) will request a chunk URL that now
 * 404s, which makes React.lazy's dynamic import() reject and the route fail to
 * render. When that happens we force a ONE-TIME full reload so the browser
 * fetches fresh HTML pointing at the current chunk names. A sessionStorage
 * guard prevents an infinite reload loop if the chunk is genuinely broken.
 */
function lazy(factory) {
  return reactLazy(() =>
    factory().catch((err) => {
      const KEY = 'chunk_reload_once'
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
        return new Promise(() => {}) // hold render until the reload happens
      }
      throw err // already retried once — let the ErrorBoundary handle it
    })
  )
}
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
import UpdatePrompt from './components/UpdatePrompt'

// ── Lazy-loaded Pages (route-based code splitting) ──

// Public Pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const DoctorSearch = lazy(() => import('./pages/patient/DoctorSearch'))
const DoctorProfile = lazy(() => import('./pages/patient/DoctorProfile'))
const SpecializationDetail = lazy(() => import('./pages/SpecializationDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Collaborate Pages
const CollaborateApplication = lazy(() => import('./pages/collaborate/CollaborateApplication'))
const ApplicationStatus = lazy(() => import('./pages/collaborate/ApplicationStatus'))

// Legal Pages
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'))
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'))

// Onboarding
const OnboardingWizard = lazy(() => import('./pages/onboarding/OnboardingWizard'))

// MFA (two-factor)
const MfaChallenge = lazy(() => import('./pages/auth/MfaChallenge'))
const MfaSetup = lazy(() => import('./pages/auth/MfaSetup'))

// Shared Pages
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'))
const Complaints = lazy(() => import('./pages/Complaints'))
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'))

// Patient Pages
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'))
const MyAppointments = lazy(() => import('./pages/patient/MyAppointments'))
const NotificationPreferences = lazy(() => import('./pages/patient/NotificationPreferences'))
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'))
const MedicalHistory = lazy(() => import('./pages/patient/MedicalHistory'))
const PatientMessages = lazy(() => import('./pages/patient/PatientMessages'))

// Doctor Pages
const DoctorLayout = lazy(() => import('./pages/doctor/DoctorLayout'))
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'))
const DoctorAppointments = lazy(() => import('./pages/doctor/DoctorAppointments'))
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients'))
const DoctorMessages = lazy(() => import('./pages/doctor/DoctorMessages'))
const DoctorAvailability = lazy(() => import('./pages/doctor/DoctorAvailability'))
const DoctorProfileEdit = lazy(() => import('./pages/doctor/DoctorProfileEdit'))

// Admin Pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const ManageDoctors = lazy(() => import('./pages/admin/ManageDoctors'))
const ManageHospitals = lazy(() => import('./pages/admin/ManageHospitals'))
const ManagePatients = lazy(() => import('./pages/admin/ManagePatients'))
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const AdminCollaborate = lazy(() => import('./pages/admin/AdminCollaborate'))
const AdminComplaints = lazy(() => import('./pages/admin/AdminComplaints'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))

// Hospital Pages
const HospitalLayout = lazy(() => import('./pages/hospital/HospitalLayout'))
const HospitalDashboard = lazy(() => import('./pages/hospital/HospitalDashboard'))
const HospitalProfileEdit = lazy(() => import('./pages/hospital/HospitalProfileEdit'))
const HospitalDoctors = lazy(() => import('./pages/hospital/HospitalDoctors'))

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true)
  }, [])

  // The app mounted successfully → chunks are healthy. Clear the one-shot
  // chunk-reload guard so a FUTURE deploy can trigger its own recovery reload.
  useEffect(() => {
    sessionStorage.removeItem('chunk_reload_once')
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
                  <Route path="/specializations/:slug" element={<SpecializationDetail />} />
                  <Route path="/collaborate" element={<CollaborateApplication />} />
                  <Route path="/collaborate/status" element={<ApplicationStatus />} />

                  {/* ── Legal Pages ── */}
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                  {/* ── Onboarding ── */}
                  <Route path="/onboarding" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR']}>
                      <OnboardingWizard />
                    </ProtectedRoute>
                  } />

                  {/* ── MFA (two-factor) — reachable by any authenticated role ── */}
                  <Route path="/mfa" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN', 'HOSPITAL']}>
                      <MfaChallenge />
                    </ProtectedRoute>
                  } />
                  <Route path="/mfa/setup" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN', 'HOSPITAL']}>
                      <MfaSetup />
                    </ProtectedRoute>
                  } />

                  {/* ── Shared Authenticated Routes ── */}
                  <Route path="/notifications" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
                      <NotificationCenter />
                    </ProtectedRoute>
                  } />
                  <Route path="/complaints" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'HOSPITAL']}>
                      <Complaints />
                    </ProtectedRoute>
                  } />
                  <Route path="/security" element={
                    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN', 'HOSPITAL']}>
                      <SecuritySettings />
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
                  <Route path="/patient/medical-history" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <MedicalHistory />
                    </ProtectedRoute>
                  } />
                  <Route path="/patient/messages" element={
                    <ProtectedRoute allowedRoles={['PATIENT']}>
                      <PatientMessages />
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
                    <Route path="patients" element={<DoctorPatients />} />
                    <Route path="messages" element={<DoctorMessages />} />
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
                    <Route path="hospitals" element={<ManageHospitals />} />
                    <Route path="patients" element={<ManagePatients />} />
                    <Route path="appointments" element={<AdminAppointments />} />
                    <Route path="payments" element={<AdminPayments />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="collaborate" element={<AdminCollaborate />} />
                    <Route path="complaints" element={<AdminComplaints />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="profile" element={<AdminProfile />} />
                  </Route>

                  {/* ── Hospital Routes (nested layout) ── */}
                  <Route path="/hospital" element={
                    <ProtectedRoute allowedRoles={['HOSPITAL']}>
                      <HospitalLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<HospitalDashboard />} />
                    <Route path="profile" element={<HospitalProfileEdit />} />
                    <Route path="doctors" element={<HospitalDoctors />} />
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
            <UpdatePrompt />
          </DeviceProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
