import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getAllUsers, getUserStats, reopenAccount, adminResetUserMfa } from '../../services/admin'
import { SkeletonTable } from '../../components/SkeletonLoader'
import '../../pages/collaborate/CollaborateApplication.css'

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'CLOSED', label: 'Closed' },
]

const ROLE_BADGE = {
  PATIENT: { label: 'Patient', bg: 'rgba(0,119,182,0.08)', color: 'var(--primary)' },
  DOCTOR: { label: 'Doctor', bg: 'rgba(45,198,83,0.10)', color: '#2DC653' },
  HOSPITAL: { label: 'Hospital', bg: 'rgba(76,201,240,0.12)', color: 'var(--info)' },
  ADMIN: { label: 'Admin', bg: 'rgba(249,199,79,0.15)', color: '#D97706' },
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ total: 0, closed: 0, active: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('CLOSED')
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [reopening, setReopening] = useState(null)
  const [resettingMfa, setResettingMfa] = useState(null)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, roleFilter])

  async function loadData() {
    try {
      setLoading(true)
      const filters = {}
      if (statusFilter !== 'ALL') filters.status = statusFilter
      if (roleFilter) filters.role = roleFilter
      if (search.trim()) filters.search = search.trim()
      const [list, s] = await Promise.all([getAllUsers(filters), getUserStats()])
      setUsers(list)
      setStats(s)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e?.preventDefault()
    loadData()
  }

  async function handleReopen(u) {
    if (!window.confirm(`Reopen ${u.name || u.email}'s account? They will be able to log in again. No data is lost.`)) return
    try {
      setReopening(u.id)
      await reopenAccount(u.id)
      toast.success('Account reopened. The user can now log in again.')
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to reopen account')
    } finally {
      setReopening(null)
    }
  }

  async function handleResetMfa(u) {
    if (!window.confirm(`Reset two-factor authentication for ${u.name || u.email}? All their authenticators will be removed and they must set up MFA again on next sign-in.`)) return
    try {
      setResettingMfa(u.id)
      const res = await adminResetUserMfa(u.id)
      toast.success(`MFA reset — ${res?.factors_removed ?? 0} authenticator(s) removed.`)
    } catch (err) {
      toast.error(err.message || 'Failed to reset MFA')
    } finally {
      setResettingMfa(null)
    }
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-2)' }} />
          <div className="skeleton skeleton-text short" />
        </div>
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            <i className="bi bi-people me-2 text-primary" />Users & Account Closures
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Review closed accounts and reopen them on request — no data is lost
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <span style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700, background: 'rgba(239,35,60,0.10)', color: 'var(--danger)' }}>
            <i className="bi bi-lock me-1" />{stats.closed} Closed
          </span>
          <span style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700, background: 'rgba(45,198,83,0.12)', color: '#2DC653' }}>
            <i className="bi bi-check-circle me-1" />{stats.active} Active
          </span>
        </div>
      </div>

      {/* Status tabs */}
      <div className="collab-status-tabs">
        {STATUS_TABS.map(t => {
          const count = t.key === 'ALL' ? stats.total : t.key === 'ACTIVE' ? stats.active : stats.closed
          return (
            <button key={t.key} className={`collab-status-tab ${statusFilter === t.key ? 'active' : ''}`} onClick={() => setStatusFilter(t.key)}>
              {t.label}<span className="tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + role filter */}
      <div className="card-custom p-3 mb-4">
        <div className="d-flex gap-3 flex-wrap">
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 220 }}>
            <i className="bi bi-search" />
            <form onSubmit={handleSearch}>
              <input
                type="text"
                className="form-input-custom"
                placeholder="Search by name or email..."
                style={{ paddingLeft: 42 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onBlur={handleSearch}
                maxLength={100}
              />
            </form>
          </div>
          <select className="form-input-custom" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 170 }}>
            <option value="">All Roles</option>
            <option value="PATIENT">Patients</option>
            <option value="DOCTOR">Doctors</option>
            <option value="HOSPITAL">Hospitals</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="card-custom">
          <div className="empty-state" style={{ padding: 48 }}>
            <i className="bi bi-person-check" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
            <p style={{ fontWeight: 600, color: 'var(--gray-500)', marginTop: 16 }}>No accounts found</p>
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              {statusFilter === 'CLOSED' ? 'No closed accounts right now.' : 'Try changing the filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card-custom">
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Closure Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rb = ROLE_BADGE[u.role] || ROLE_BADGE.PATIENT
                  const closed = u.is_active === false
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name || '—'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: rb.bg, color: rb.color }}>
                          {rb.label}
                        </span>
                      </td>
                      <td>
                        <span className={closed ? 'badge-cancelled' : 'badge-confirmed'}>
                          {closed ? 'Closed' : 'Active'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        {closed ? (
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                              <i className="bi bi-clock me-1" />Closed {formatDate(u.closed_at)}
                            </div>
                            {u.closure_reason
                              ? <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>"{u.closure_reason}"</div>
                              : <div style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', marginTop: 2 }}>No reason provided</div>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1 align-items-start">
                          {closed && (
                            <button
                              className="btn-ghost"
                              style={{ padding: '4px 12px', fontSize: 12, color: 'var(--success)' }}
                              onClick={() => handleReopen(u)}
                              disabled={reopening === u.id}
                            >
                              {reopening === u.id ? (
                                <><div className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} /> Reopening...</>
                              ) : (
                                <><i className="bi bi-arrow-counterclockwise me-1" />Reopen Account</>
                              )}
                            </button>
                          )}
                          <button
                            className="btn-ghost"
                            style={{ padding: '4px 12px', fontSize: 12, color: 'var(--primary)' }}
                            onClick={() => handleResetMfa(u)}
                            disabled={resettingMfa === u.id}
                            title="Remove all MFA authenticators for this user"
                          >
                            {resettingMfa === u.id ? (
                              <><div className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} /> Resetting...</>
                            ) : (
                              <><i className="bi bi-shield-slash me-1" />Reset MFA</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
