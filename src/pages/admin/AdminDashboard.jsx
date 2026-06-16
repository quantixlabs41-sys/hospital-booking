import { useState, useEffect } from 'react'
import { getDashboardStats, getWeeklyAppointmentTrend } from '../../services/admin'
import { getAllAppointments } from '../../services/appointments'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import StatusBadge from '../../components/StatusBadge'
import { SkeletonKPI, SkeletonTable } from '../../components/SkeletonLoader'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ totalDoctors: 0, totalPatients: 0, totalAppointments: 0, todayAppointments: 0 })
  const [trend, setTrend] = useState([])
  const [recentApts, setRecentApts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [s, t, a] = await Promise.all([
        getDashboardStats(),
        getWeeklyAppointmentTrend(),
        getAllAppointments()
      ])
      setStats(s)
      setTrend(t)
      setRecentApts(a.slice(0, 8))
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div>
      <div className="skeleton skeleton-heading" style={{ marginBottom: 'var(--space-6)' }} />
      <SkeletonKPI count={4} />
      <div className="mt-4 skeleton" style={{ height: 340, borderRadius: 'var(--card-radius)' }} />
      <div className="mt-4">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )

  const chartData = {
    labels: trend.map(t => {
      const d = new Date(t.date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Total',
        data: trend.map(t => t.total),
        borderColor: '#0077B6',
        backgroundColor: 'rgba(0,119,182,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#0077B6'
      },
      {
        label: 'Completed',
        data: trend.map(t => t.completed),
        borderColor: '#2DC653',
        backgroundColor: 'rgba(45,198,83,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2DC653'
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, font: { family: 'Inter', size: 12 } } },
      tooltip: { backgroundColor: '#03045E', cornerRadius: 8, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 12 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { ticks: { font: { family: 'Inter', size: 11 } }, grid: { display: false } }
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          Admin Dashboard
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Welcome back, {profile?.name ?? 'Admin'}. Here's your hospital overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4 stagger-children">
        {[
          { icon: 'bi-people-fill', value: stats.totalDoctors, label: 'Total Doctors', color: 'var(--primary)', bg: 'rgba(0,119,182,0.1)' },
          { icon: 'bi-person-lines-fill', value: stats.totalPatients, label: 'Total Patients', color: 'var(--info)', bg: 'rgba(76,201,240,0.1)' },
          { icon: 'bi-calendar-check', value: stats.totalAppointments, label: 'Total Appointments', color: 'var(--success)', bg: 'rgba(45,198,83,0.1)' },
          { icon: 'bi-calendar-day', value: stats.todayAppointments, label: "Today's Appointments", color: 'var(--warning)', bg: 'rgba(249,199,79,0.1)' },
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

      {/* Chart */}
      <div className="card-custom p-4 mb-4">
        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
          <i className="bi bi-graph-up-arrow me-2 text-primary" />Appointment Trends (Last 7 Days)
        </h6>
        <div style={{ height: 300 }} role="img" aria-label={`Appointment trends chart showing ${trend.length} days of data`}>
          <Line data={chartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="card-custom p-4">
        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
          <i className="bi bi-clock-history me-2 text-primary" />Recent Appointments
        </h6>
        {recentApts.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <i className="bi bi-calendar-x" />
            <p>No appointments yet</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApts.map(apt => (
                  <tr key={apt.id}>
                    <td style={{ fontWeight: 500 }}>{apt.profiles?.name ?? '—'}</td>
                    <td style={{ fontWeight: 500 }}>Dr. {apt.doctors?.profiles?.name ?? '—'}</td>
                    <td>{new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td>{apt.slot_start_time?.substring(0, 5)}</td>
                    <td><StatusBadge status={apt.status} /></td>
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
