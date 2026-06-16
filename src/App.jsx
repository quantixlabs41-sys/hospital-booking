import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { DeviceProvider } from './context/DeviceContext'
import { ToastContainer } from 'react-toastify'
import ProtectedRoute from './routes/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'
import ScrollToTop from './components/ScrollToTop'

// ── Lazy-loaded Pages (route-based code splitting) ──

// Public Pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const DoctorSearch = lazy(() => import('./pages/patient/DoctorSearch'))
const DoctorProfile = lazy(() => import('./pages/patient/DoctorProfile'))
const NotFound = lazy(() => import('./pages/NotFound'))

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <DeviceProvider>
            <ErrorBoundary>
              <ScrollToTop />
              <main id="main-content">
              <Suspense fallback={<LoadingSpinner fullPage text="Loading..." />}>
                <Routes>
                  {/* ── Public Routes ── */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/doctors" element={<DoctorSearch />} />
                  <Route path="/doctors/:id" element={<DoctorProfile />} />

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
          </DeviceProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
