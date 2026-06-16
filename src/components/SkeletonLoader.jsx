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
      {/* Page title */}
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-6)' }} />

      {/* KPI row */}
      <SkeletonKPI count={4} />

      {/* Content area */}
      <div className="mt-4">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}
