import { useState, useEffect } from 'react'
import { getTodayAppointments, getDoctorAppointments, completeAppointment } from '../../services/appointments'
import { getDoctorByUserId } from '../../services/doctors'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import StatusBadge from '../../components/StatusBadge'
import { SkeletonKPI, SkeletonTable } from '../../components/SkeletonLoader'
import Breadcrumbs from '../../components/Breadcrumbs'

export default function DoctorDashboard() {
  const { user, profile } = useAuth()
  const [doctorInfo, setDoctorInfo] = useState(null)
  const [todayApts, setTodayApts] = useState([])
  const [allApts, setAllApts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
      setLoading(true)
      const doc = await getDoctorByUserId(user.id)
      setDoctorInfo(doc)
      if (doc) {
        const [today, all] = await Promise.all([
          getTodayAppointments(doc.id),
          getDoctorAppointments(doc.id)
        ])
        setTodayApts(today)
        setAllApts(all)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete(aptId) {
    try {
      await completeAppointment(aptId)
      toast.success('Appointment marked as completed')
      loadData()
    } catch (err) {
      toast.error('Failed to update appointment')
    }
  }

  if (loading) return (
    <div>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-6)' }} />
      <SkeletonKPI count={4} />
      <div className="mt-4">
        <SkeletonTable rows={5} cols={6} />
      </div>
    </div>
  )

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const completed = allApts.filter(a => a.status === 'COMPLETED').length
  const thisWeek = allApts.filter(a => {
    const d = new Date(a.appointment_date)
    const now = new Date()
    const diffDays = (d - now) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 7
  }).length

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. {profile?.name?.split(' ')[0] ?? 'Doctor'} 👋
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>{todayDate}</p>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4 stagger-children">
        {[
          { icon: 'bi-calendar-day', value: todayApts.length, label: "Today's Appointments", color: 'var(--primary)', bg: 'rgba(0,119,182,0.1)' },
          { icon: 'bi-calendar-week', value: thisWeek, label: 'This Week', color: 'var(--info)', bg: 'rgba(76,201,240,0.1)' },
          { icon: 'bi-people', value: allApts.length, label: 'Total Patients', color: 'var(--warning)', bg: 'rgba(249,199,79,0.1)' },
          { icon: 'bi-check-circle', value: completed, label: 'Completed', color: 'var(--success)', bg: 'rgba(45,198,83,0.1)' },
        ].map((stat, i) => (
          <div key={i} className="col-6 col-xl-3">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: stat.bg, color: stat.color }}>
                <i className={`bi ${stat.icon}`} />
              </div>
              <div className="kpi-value">{stat.value}</div>
              <div className="kpi-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Schedule */}
      <div className="card-custom p-4">
        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
          <i className="bi bi-clock me-2 text-primary" />Today's Schedule
        </h6>

        {todayApts.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <i className="bi bi-calendar-check" style={{ fontSize: 48 }} />
            <p>No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {todayApts.map(apt => (
                  <tr key={apt.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {apt.slot_start_time?.substring(0, 5)}
                      </span>
                      <span style={{ color: 'var(--gray-400)', margin: '0 4px' }}>—</span>
                      <span style={{ fontSize: 13 }}>{apt.slot_end_time?.substring(0, 5)}</span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {apt.profiles?.name?.charAt(0) ?? 'P'}
                        </div>
                        <span style={{ fontWeight: 600 }}>{apt.profiles?.name ?? 'Patient'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {apt.profiles?.phone ?? '—'}
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200 }} className="truncate">
                      {apt.reason || '—'}
                    </td>
                    <td><StatusBadge status={apt.status} /></td>
                    <td>
                      {['PENDING', 'CONFIRMED'].includes(apt.status) && (
                        <button
                          className="btn-ghost"
                          style={{ padding: '4px 12px', fontSize: 12, color: 'var(--success)' }}
                          onClick={() => handleComplete(apt.id)}
                        >
                          <i className="bi bi-check-lg me-1" />Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
