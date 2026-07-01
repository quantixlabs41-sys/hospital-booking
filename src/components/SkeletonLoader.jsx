/**
 * Skeleton loading components for progressive loading.
 * Per Priority 3 (progressive-loading) — replaces full-page spinners.
 *
 * Variants: Card, Table, Profile, KPI, Text
 * CSS classes defined in index.css (.skeleton, .skeleton-*)
 */

export function SkeletonCard({ count = 1 }) {
  return (
    <div className="d-flex flex-wrap gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ flex: '1 1 280px' }} />
      ))}
    </div>
  )
}

export function SkeletonKPI({ count = 4 }) {
  return (
    <div className="d-flex flex-wrap gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-kpi" style={{ flex: '1 1 200px' }} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card-custom" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header row */}
      <div className="d-flex gap-3 p-3" style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton skeleton-text" style={{ width: `${100 / cols - 2}%`, marginBottom: 0 }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="d-flex gap-3 p-3" style={{ borderBottom: '1px solid var(--gray-100)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton skeleton-text" style={{ width: `${100 / cols - 2}%`, marginBottom: 0 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonProfile() {
  return (
    <div className="d-flex align-items-center gap-3">
      <div className="skeleton skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-text medium" />
        <div className="skeleton skeleton-text short" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, heading = false }) {
  return (
    <div>
      {heading && <div className="skeleton skeleton-heading" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton skeleton-text ${i === lines - 1 ? 'short' : i % 2 === 0 ? '' : 'medium'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonDoctorCard({ count = 3 }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-md-6 col-lg-4">
          <div className="card-custom p-3">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="skeleton skeleton-avatar" style={{ width: 64, height: 64 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text medium" />
                <div className="skeleton skeleton-text short" />
              </div>
            </div>
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text medium" />
            <div className="d-flex gap-2 mt-3">
              <div className="skeleton" style={{ height: 36, flex: 1, borderRadius: 'var(--radius-full)' }} />
              <div className="skeleton" style={{ height: 36, flex: 1, borderRadius: 'var(--radius-full)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Full-page skeleton layout for dashboard pages.
 * Replaces <LoadingSpinner fullPage /> during Suspense.
 */
export function SkeletonDashboard() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-6)' }} />
      <SkeletonKPI count={4} />
      <div className="mt-4">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}

/** Profile page skeleton: sidebar card + form area */
export function SkeletonProfilePage() {
  return (
    <div>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-4)' }} />
      <div className="skeleton skeleton-text short" style={{ marginBottom: 'var(--space-6)' }} />
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card-custom p-4 d-flex flex-column align-items-center gap-3">
            <div className="skeleton skeleton-avatar" style={{ width: 100, height: 100 }} />
            <div className="skeleton skeleton-text medium" style={{ width: '60%' }} />
            <div className="skeleton skeleton-text short" style={{ width: '40%' }} />
            <div style={{ width: '100%', borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 10 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="d-flex gap-2 mb-3">
            <div className="skeleton" style={{ height: 40, width: 120, borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ height: 40, width: 120, borderRadius: 'var(--radius-md)' }} />
          </div>
          <div className="card-custom p-4">
            <div className="skeleton skeleton-heading" style={{ width: '40%', marginBottom: 'var(--space-5)' }} />
            <div className="row g-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="col-md-6">
                  <div className="skeleton skeleton-text short" style={{ marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Appointment card grid skeleton */
export function SkeletonAppointmentCards({ count = 6 }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-md-6 col-xl-4">
          <div className="card-custom p-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="skeleton skeleton-avatar" style={{ width: 44, height: 44 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text medium" />
                <div className="skeleton skeleton-text short" />
              </div>
              <div className="skeleton" style={{ width: 72, height: 24, borderRadius: 'var(--radius-full)' }} />
            </div>
            <div className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 36, borderRadius: 'var(--radius-full)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Schedule/availability skeleton — 7 day cards */
export function SkeletonSchedule() {
  return (
    <div>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-4)' }} />
      <div className="skeleton skeleton-text" style={{ marginBottom: 'var(--space-5)', maxWidth: 300 }} />
      <div className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', background: 'rgba(0,119,182,0.05)' }} />
      <div className="d-flex flex-column gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="card-custom p-4">
            <div className="d-flex align-items-center gap-4">
              <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
              <div className="skeleton skeleton-text" style={{ width: 100, marginBottom: 0 }} />
              <div className="skeleton" style={{ height: 36, width: 130, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 36, width: 130, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 'var(--radius-md)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Notification list skeleton */
export function SkeletonNotifications({ count = 6 }) {
  return (
    <div className="d-flex flex-column gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-custom p-3 d-flex align-items-start gap-3">
          <div className="skeleton skeleton-avatar" style={{ width: 36, height: 36, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text medium" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text short" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Reports skeleton with charts */
export function SkeletonReports() {
  return (
    <div>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-4)' }} />
      <div className="skeleton" style={{ height: 52, borderRadius: 'var(--card-radius)', marginBottom: 'var(--space-4)' }} />
      <SkeletonKPI count={4} />
      <div className="row g-4 mt-1">
        <div className="col-lg-5">
          <div className="skeleton" style={{ height: 340, borderRadius: 'var(--card-radius)' }} />
        </div>
        <div className="col-lg-7">
          <div className="skeleton" style={{ height: 340, borderRadius: 'var(--card-radius)' }} />
        </div>
      </div>
      <div className="mt-4"><SkeletonTable rows={5} cols={5} /></div>
    </div>
  )
}

/** Full-page loading with Navbar wrapper for patient pages */
export function SkeletonFullPage() {
  return (
    <div style={{ padding: '32px 24px', minHeight: '60vh' }}>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-6)' }} />
      <SkeletonKPI count={3} />
      <div className="row g-4 mt-2">
        <div className="col-lg-6">
          <div className="skeleton" style={{ height: 200, borderRadius: 'var(--card-radius)' }} />
        </div>
        <div className="col-lg-6">
          <div className="skeleton" style={{ height: 200, borderRadius: 'var(--card-radius)' }} />
        </div>
      </div>
      <div className="mt-4"><SkeletonTable rows={4} cols={4} /></div>
    </div>
  )
}

/** Doctor profile page skeleton (public facing) */
export function SkeletonDoctorProfile() {
  return (
    <div>
      {/* Header area */}
      <div className="skeleton" style={{ height: 180, borderRadius: 0 }} />
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card-custom p-4">
              <div className="skeleton skeleton-text" style={{ marginBottom: 12 }} />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="d-flex justify-content-between mb-2">
                  <div className="skeleton skeleton-text short" style={{ width: '35%', marginBottom: 0 }} />
                  <div className="skeleton skeleton-text short" style={{ width: '40%', marginBottom: 0 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="col-lg-8">
            <div className="card-custom p-4">
              <div className="skeleton skeleton-heading" style={{ width: '50%', marginBottom: 'var(--space-5)' }} />
              <div className="d-flex gap-2 pb-2 mb-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ width: 64, height: 72, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                ))}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ width: 100, height: 36, borderRadius: 'var(--radius-md)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

