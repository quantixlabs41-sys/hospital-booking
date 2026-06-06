import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { DeviceProvider } from './context/DeviceContext'
import { ToastContainer } from 'react-toastify'
import ProtectedRoute from './routes/ProtectedRoute'

// Public Pages
import LandingPage from './pages/LandingPage'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import DoctorSearch from './pages/patient/DoctorSearch'
import DoctorProfile from './pages/patient/DoctorProfile'
import NotFound from './pages/NotFound'

// Shared Pages
import NotificationCenter from './pages/NotificationCenter'

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard'
import MyAppointments from './pages/patient/MyAppointments'
import NotificationPreferences from './pages/patient/NotificationPreferences'

// Doctor Pages
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorAppointments from './pages/doctor/DoctorAppointments'
import DoctorAvailability from './pages/doctor/DoctorAvailability'
import DoctorProfileEdit from './pages/doctor/DoctorProfileEdit'

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageDoctors from './pages/admin/ManageDoctors'
import ManagePatients from './pages/admin/ManagePatients'
import AdminAppointments from './pages/admin/AdminAppointments'
import Reports from './pages/admin/Reports'
import AdminWhatsAppPanel from './pages/admin/AdminWhatsAppPanel'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <DeviceProvider>
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
              </Route>

              {/* ── 404 ── */}
              <Route path="*" element={<NotFound />} />
            </Routes>

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
