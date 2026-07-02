import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SkeletonDashboard } from '../components/SkeletonLoader'

// Routes that must stay reachable while an MFA gate is active, otherwise the
// user could be redirected into a loop with no way to satisfy the gate.
const MFA_ROUTES = ['/mfa', '/mfa/setup']

export default function ProtectedRoute({ children, allowedRoles }) {
  const {
    user, profile, loading, onboardingComplete,
    mfaLoaded, mfaStepUpRequired, mfaEnrollmentRequired,
  } = useAuth()
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

  const onMfaRoute = MFA_ROUTES.includes(location.pathname)

  // ── MFA gates ──
  // Wait until assurance level + factor status are known before deciding, to
  // avoid briefly rendering protected content or redirecting incorrectly.
  if (!mfaLoaded && !onMfaRoute) {
    return <SkeletonDashboard />
  }

  // 1. Step-up: the user has a verified factor but this session is still aal1.
  //    Block everything except the challenge screen until they verify.
  if (mfaStepUpRequired && location.pathname !== '/mfa') {
    return <Navigate to="/mfa" state={{ from: location }} replace />
  }

  // 2. Mandatory enrollment: a privileged role with no verified factor must
  //    enroll before reaching any protected route.
  if (mfaEnrollmentRequired && !mfaStepUpRequired && location.pathname !== '/mfa/setup') {
    return <Navigate to="/mfa/setup" state={{ from: location }} replace />
  }

  // Profile loaded but user's role is not in the allowed list
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const roleRoutes = {
      PATIENT: '/patient/dashboard',
      DOCTOR: '/doctor/dashboard',
      ADMIN: '/admin/dashboard',
      HOSPITAL: '/hospital/dashboard'
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
