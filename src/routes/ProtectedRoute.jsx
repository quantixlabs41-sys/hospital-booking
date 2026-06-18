import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SkeletonDashboard } from '../components/SkeletonLoader'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading, onboardingComplete } = useAuth()
  const location = useLocation()

  // Still loading auth state
  if (loading) {
    return <SkeletonDashboard />
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but profile not loaded yet — this is a critical security gate
  // We must NOT render protected content without a confirmed role
  if (!profile) {
    return <SkeletonDashboard />
  }

  // Profile loaded but user's role is not in the allowed list
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const roleRoutes = {
      PATIENT: '/patient/dashboard',
      DOCTOR: '/doctor/dashboard',
      ADMIN: '/admin/dashboard'
    }
    return <Navigate to={roleRoutes[profile.role] ?? '/'} replace />
  }

  // Onboarding gate: redirect PATIENT/DOCTOR to onboarding if not complete
  // Skip if already on /onboarding to avoid redirect loops
  if (
    onboardingComplete === false &&
    (profile.role === 'PATIENT' || profile.role === 'DOCTOR') &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  // All checks passed
  return children
}
