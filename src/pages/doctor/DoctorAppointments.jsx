import { useState, useEffect } from 'react'
import { getDoctorAppointments, completeAppointment, cancelAppointment } from '../../services/appointments'
import { getDoctorByUserId } from '../../services/doctors'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DoctorAppointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [doctorRecord, setDoctorRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
      setLoading(true)
      const doc = await getDoctorByUserId(user.id)
      if (doc) {
        setDoctorRecord(doc)
        const data = await getDoctorAppointments(doc.id)
        setAppointments(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete(id) {
    try {
      await completeAppointment(id, doctorRecord?.id)
      toast.success('Marked as completed')
      loadData()
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  async function handleCancel() {
    if (!cancelModal) return
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation')
      return
    }
    if (cancelReason.length > 300) {
      toast.error('Reason must be under 300 characters')
      return
    }
    try {
      await cancelAppointment(cancelModal.id, cancelReason.trim(), 'DOCTOR')
      toast.success('Appointment cancelled')
      setCancelModal(null)
      setCancelReason('')
      loadData()
    } catch (err) {
      toast.error('Failed to cancel')
    }
  }

  const filtered = appointments.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (filterDate && a.appointment_date !== filterDate) return false
    return true
  })

  if (loading) return <LoadingSpinner text="Loading appointments..." />

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          Appointments
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Manage all your patient appointments
        </p>
      </div>

      {/* Filters */}
      <div className="card-custom p-3 mb-4">
        <div className="d-flex gap-3 align-items-center flex-wrap">
          <div>
            <select
              className="form-input-custom"
              style={{ width: 160, padding: '8px 12px', fontSize: 14 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              className="form-input-custom"
              style={{ width: 170, padding: '8px 12px', fontSize: 14 }}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>
          {(filterStatus || filterDate) && (
            <button className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => { setFilterStatus(''); setFilterDate('') }}>
              <i className="bi bi-x-lg me-1" />Clear
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--gray-400)', marginLeft: 'auto' }}>
            {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card-custom">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <i className="bi bi-calendar-x" />
            <p>No appointments found</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(apt => (
                  <tr key={apt.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {apt.profiles?.name?.charAt(0) ?? 'P'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{apt.profiles?.name ?? 'Patient'}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{apt.profiles?.phone ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{apt.slot_start_time?.substring(0, 5)}</span>
                      <span style={{ color: 'var(--gray-300)', margin: '0 4px' }}>—</span>
                      <span style={{ fontSize: 13 }}>{apt.slot_end_time?.substring(0, 5)}</span>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200 }} className="truncate">
                      {apt.reason || '—'}
                    </td>
                    <td><StatusBadge status={apt.status} /></td>
                    <td>
                      <div className="d-flex gap-2">
                        {['PENDING', 'CONFIRMED'].includes(apt.status) && (
                          <>
                            <button
                              className="btn-ghost"
                              style={{ padding: '4px 10px', fontSize: 12, color: 'var(--success)' }}
                              onClick={() => handleComplete(apt.id)}
                            >
                              <i className="bi bi-check-lg" /> Complete
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)' }}
                              onClick={() => setCancelModal(apt)}
                            >
                              <i className="bi bi-x-lg" /> Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <>
          <div className="overlay" onClick={() => setCancelModal(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 'var(--radius-lg)', padding: 32,
            zIndex: 1001, width: '90%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12, color: 'var(--danger)' }}>
              Cancel Appointment
            </h5>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 16 }}>
              Patient: <strong>{cancelModal.profiles?.name}</strong> on {cancelModal.appointment_date}
            </p>
            <label className="form-label-custom">Reason *</label>
            <textarea
              className="form-input-custom mb-2"
              rows={3}
              placeholder="Provide a reason for cancellation..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              maxLength={300}
            />
            <div className={`char-counter ${cancelReason.length > 250 ? (cancelReason.length > 290 ? 'danger' : 'warning') : ''}`}>
              {cancelReason.length}/300
            </div>
            <div className="d-flex gap-3">
              <button className="btn-ghost flex-fill" onClick={() => setCancelModal(null)}>Keep</button>
              <button
                className="flex-fill"
                style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontWeight: 600, cursor: 'pointer' }}
                onClick={handleCancel}
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
