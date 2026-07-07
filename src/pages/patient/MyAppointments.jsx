import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPatientAppointments, cancelAppointment } from '../../services/appointments'
import { createSwapOffer } from '../../services/swap'
import { getOrCreateConversation } from '../../services/chat'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import StatusBadge from '../../components/StatusBadge'
import AppointmentRecordControls from '../../components/AppointmentRecordControls'
import PaymentSection from '../../components/PaymentSection'
import LiveEtaCard from '../../components/LiveEtaCard'
import { SkeletonAppointmentCards } from '../../components/SkeletonLoader'

export default function MyAppointments() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [offeringId, setOfferingId] = useState(null)

  useEffect(() => {
    if (user) loadAppointments()
  }, [user])

  async function loadAppointments() {
    try {
      setLoading(true)
      const data = await getPatientAppointments(user.id)
      setAppointments(data)
    } catch (err) {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  async function handleOfferSwap(apt) {
    try {
      setOfferingId(apt.id)
      await createSwapOffer(apt.id)
      toast.success('Slot offered for swap. You\'ll earn a co-pay discount if someone takes it.')
    } catch (err) {
      toast.error(err.message || 'Could not offer this slot.')
    } finally {
      setOfferingId(null)
    }
  }

  async function handleMessage(apt) {
    try {
      const conv = await getOrCreateConversation(user.id, apt.doctor_id)
      navigate('/patient/messages', { state: { conversationId: conv.id } })
    } catch (err) {
      toast.error(err.message || 'Could not open chat.')
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
      setCancelling(true)
      await cancelAppointment(cancelModal.id, cancelReason.trim(), 'PATIENT')
      toast.success('Appointment cancelled')
      setCancelModal(null)
      setCancelReason('')
      loadAppointments()
    } catch (err) {
      toast.error('Failed to cancel appointment')
    } finally {
      setCancelling(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = appointments.filter(a => {
    if (tab === 'upcoming') return ['PENDING', 'CONFIRMED'].includes(a.status) && a.appointment_date >= today
    if (tab === 'past') return a.status === 'COMPLETED' || a.appointment_date < today
    if (tab === 'cancelled') return a.status === 'CANCELLED'
    return true
  })

  function canCancel(apt) {
    if (!['PENDING', 'CONFIRMED'].includes(apt.status)) return false
    const aptTime = new Date(`${apt.appointment_date}T${apt.slot_start_time}`)
    const now = new Date()
    const hoursUntil = (aptTime - now) / (1000 * 60 * 60)
    return hoursUntil > 2
  }

  return (
    <div>
      <Navbar />

      <div className="page-header">
        <div className="container">
          <div className="section-badge">My Health</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', position: 'relative', zIndex: 1 }}>
            My Appointments
          </h1>
        </div>
      </div>

      <div className="container py-5">
        {/* Tabs */}
        <div className="d-flex gap-2 mb-4 align-items-center flex-wrap">
          {[
            { key: 'upcoming', label: 'Upcoming', icon: 'bi-calendar-event' },
            { key: 'past', label: 'Past', icon: 'bi-clock-history' },
            { key: 'cancelled', label: 'Cancelled', icon: 'bi-x-circle' },
          ].map(t => (
            <button
              key={t.key}
              className={`btn-ghost d-flex align-items-center gap-2`}
              style={{
                background: tab === t.key ? 'var(--primary)' : undefined,
                color: tab === t.key ? 'white' : undefined,
              }}
              onClick={() => setTab(t.key)}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
            </button>
          ))}
          <Link
            to="/patient/swaps"
            className="btn-ghost d-flex align-items-center gap-2 ms-auto"
            style={{ color: 'var(--primary)' }}
          >
            <i className="bi bi-arrow-left-right" />
            Swap Market
          </Link>
        </div>

        {loading ? (
          <SkeletonAppointmentCards count={6} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-calendar-x" />
            <p>No {tab} appointments found</p>
            <Link to="/doctors" className="btn-primary-custom mt-3">
              Find a Doctor <i className="bi bi-arrow-right" />
            </Link>
          </div>
        ) : (
          <div className="row g-3 stagger-children">
            {filtered.map(apt => (
              <div key={apt.id} className="col-md-6 col-xl-4">
                <div className="card-custom p-4 h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                        {apt.doctors?.profiles?.name?.charAt(0) ?? 'D'}
                      </div>
                      <div>
                        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, margin: 0 }}>
                          Dr. {apt.doctors?.profiles?.name ?? 'Doctor'}
                        </h6>
                        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                          {apt.doctors?.specialization ?? ''}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>

                  <div className="d-flex flex-column gap-2 mb-3" style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-calendar3" style={{ color: 'var(--primary)', fontSize: 14 }} />
                      <span style={{ fontSize: 14 }}>
                        {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-clock" style={{ color: 'var(--primary)', fontSize: 14 }} />
                      <span style={{ fontSize: 14 }}>{apt.slot_start_time?.substring(0, 5)} — {apt.slot_end_time?.substring(0, 5)}</span>
                    </div>
                    {apt.doctors?.consultation_fee && (
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-currency-rupee" style={{ color: 'var(--primary)', fontSize: 14 }} />
                        <span style={{ fontSize: 14 }}>₹{apt.doctors.consultation_fee}</span>
                      </div>
                    )}
                  </div>

                  {apt.reason && (
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 12px' }}>
                      <i className="bi bi-chat-text me-1" />{apt.reason}
                    </p>
                  )}

                  {apt.cancel_reason && (
                    <div className="alert-custom alert-danger" style={{ padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                      <i className="bi bi-info-circle" />
                      <span>Cancellation: {apt.cancel_reason}</span>
                    </div>
                  )}

                  {/* Live ETA — only meaningful for today's upcoming visits */}
                  {['PENDING', 'CONFIRMED'].includes(apt.status) && apt.appointment_date === today && (
                    <LiveEtaCard appointmentId={apt.id} />
                  )}

                  {/* Action footer — pinned to the bottom so cards align across the row */}
                  <div className="mt-auto">
                    {canCancel(apt) && (
                      <button
                        className="btn-outline-custom w-100"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '8px 16px', fontSize: 13 }}
                        onClick={() => setCancelModal(apt)}
                      >
                        <i className="bi bi-x-circle" /> Cancel Appointment
                      </button>
                    )}

                    <AppointmentRecordControls appointment={apt} patientId={user.id} />

                    <PaymentSection appointment={apt} profile={profile} onPaid={loadAppointments} />

                    <button
                      className="btn-outline-custom w-100 mt-2"
                      style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => handleMessage(apt)}
                    >
                      <i className="bi bi-chat-dots" /> Message Doctor
                    </button>

                    {['PENDING', 'CONFIRMED'].includes(apt.status) && apt.appointment_date >= today && (
                      <button
                        className="btn-ghost w-100 mt-2"
                        style={{ padding: '8px 16px', fontSize: 13, color: 'var(--primary)' }}
                        disabled={offeringId === apt.id}
                        onClick={() => handleOfferSwap(apt)}
                        title="Offer this slot to someone who needs it sooner and earn a co-pay discount"
                      >
                        <i className="bi bi-arrow-left-right" /> {offeringId === apt.id ? 'Offering…' : 'Offer for Swap'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
              <i className="bi bi-exclamation-triangle me-2" />Cancel Appointment
            </h5>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 16 }}>
              Are you sure you want to cancel your appointment with Dr. {cancelModal.doctors?.profiles?.name}?
            </p>
            <label className="form-label-custom">Reason for cancellation *</label>
            <textarea
              className="form-input-custom mb-2"
              rows={3}
              placeholder="Please provide a reason..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              maxLength={300}
            />
            <div className={`char-counter ${cancelReason.length > 250 ? (cancelReason.length > 290 ? 'danger' : 'warning') : ''}`}>
              {cancelReason.length}/300
            </div>
            <div className="d-flex gap-3">
              <button className="btn-ghost flex-fill" onClick={() => { setCancelModal(null); setCancelReason('') }}>
                Keep Appointment
              </button>
              <button
                className="flex-fill"
                style={{
                  background: 'linear-gradient(135deg, #EF233C 0%, #C1121F 100%)',
                  color: 'white', border: 'none', padding: '10px 20px',
                  borderRadius: 'var(--radius-full)', fontWeight: 600, cursor: 'pointer'
                }}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  )
}
