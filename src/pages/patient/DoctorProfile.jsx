import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDoctorById, getAvailableSlots } from '../../services/doctors'
import { bookAppointment } from '../../services/appointments'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DoctorProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [reason, setReason] = useState('')
  const [booking, setBooking] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    loadDoctor()
  }, [id])

  async function loadDoctor() {
    try {
      setLoading(true)
      const data = await getDoctorById(id)
      setDoctor(data)
    } catch (err) {
      toast.error('Doctor not found')
      navigate('/doctors')
    } finally {
      setLoading(false)
    }
  }

  async function handleDateChange(date) {
    setSelectedDate(date)
    setSelectedSlot(null)
    if (!date) { setSlots([]); return }
    try {
      setSlotsLoading(true)
      const data = await getAvailableSlots(id, date)
      setSlots(data)
    } catch (err) {
      toast.error('Failed to load slots')
    } finally {
      setSlotsLoading(false)
    }
  }

  async function handleBooking() {
    if (!user) {
      toast.info('Please login to book an appointment')
      navigate('/login', { state: { from: { pathname: `/doctors/${id}` } } })
      return
    }
    if (!selectedSlot || !selectedDate) return

    try {
      setBooking(true)
      await bookAppointment({
        doctor_id: parseInt(id),
        appointment_date: selectedDate,
        slot_start_time: selectedSlot.start,
        reason,
        patient_id: user.id
      })
      toast.success('Appointment booked successfully!')
      setShowConfirm(false)
      navigate('/patient/appointments')
    } catch (err) {
      toast.error(err.message || 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  // Generate next 14 days for date picker
  function getDateOptions() {
    const dates = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      dates.push({
        value: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: i === 0
      })
    }
    return dates
  }

  if (loading) return <LoadingSpinner fullPage text="Loading doctor profile..." />

  if (!doctor) return null

  const name = doctor.profiles?.name ?? 'Doctor'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const dateOptions = getDateOptions()

  return (
    <div>
      <Navbar />

      {/* Doctor Header */}
      <div className="page-header" style={{ paddingBottom: 60 }}>
        <div className="container">
          <div className="d-flex align-items-center gap-4" style={{ position: 'relative', zIndex: 1 }}>
            {doctor.photo_url ? (
              <img src={doctor.photo_url} alt={name} className="doctor-avatar" style={{ width: 100, height: 100, borderWidth: 4 }} />
            ) : (
              <div className="avatar avatar-xl">{initials}</div>
            )}
            <div>
              <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', margin: 0 }}>
                Dr. {name}
              </h1>
              <p style={{ color: 'var(--primary-light)', fontSize: 16, fontWeight: 600, margin: '4px 0' }}>
                {doctor.specialization}
              </p>
              <div className="d-flex gap-4 mt-2" style={{ flexWrap: 'wrap' }}>
                {doctor.qualification && (
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                    <i className="bi bi-award me-1" />{doctor.qualification}
                  </span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                  <i className="bi bi-briefcase me-1" />{doctor.experience_years ?? 0} years
                </span>
                {doctor.departments?.name && (
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                    <i className="bi bi-building me-1" />{doctor.departments.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-5">
        <div className="row g-4">
          {/* Left - Details */}
          <div className="col-lg-4">
            <div className="card-custom p-4 mb-4">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
                <i className="bi bi-info-circle me-2 text-primary" />About Doctor
              </h6>
              <div className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-between">
                  <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Specialization</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{doctor.specialization}</span>
                </div>
                {doctor.qualification && (
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Qualification</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{doctor.qualification}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between">
                  <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Experience</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{doctor.experience_years ?? 0} years</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Department</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{doctor.departments?.name ?? '—'}</span>
                </div>
                <hr className="divider" />
                <div className="d-flex justify-content-between align-items-center">
                  <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Consultation Fee</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                    ₹{doctor.consultation_fee ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-custom p-4">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
                <i className="bi bi-telephone me-2 text-primary" />Contact
              </h6>
              {doctor.profiles?.email && (
                <p style={{ fontSize: 14, color: 'var(--gray-600)', margin: '8px 0' }}>
                  <i className="bi bi-envelope me-2" />{doctor.profiles.email}
                </p>
              )}
              {doctor.profiles?.phone && (
                <p style={{ fontSize: 14, color: 'var(--gray-600)', margin: '8px 0' }}>
                  <i className="bi bi-phone me-2" />{doctor.profiles.phone}
                </p>
              )}
            </div>
          </div>

          {/* Right - Booking */}
          <div className="col-lg-8">
            <div className="card-custom p-4">
              <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 24 }}>
                <i className="bi bi-calendar-plus me-2 text-primary" />Book an Appointment
              </h5>

              {/* Date Picker */}
              <label className="form-label-custom">Select Date</label>
              <div className="d-flex gap-2 pb-2 mb-4" style={{ overflowX: 'auto' }}>
                {dateOptions.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`d-flex flex-column align-items-center p-2 px-3 ${selectedDate === d.value ? 'selected' : ''}`}
                    style={{
                      border: selectedDate === d.value ? '2px solid var(--primary)' : '1.5px solid var(--gray-200)',
                      borderRadius: 'var(--radius-md)',
                      background: selectedDate === d.value ? 'var(--primary)' : 'white',
                      color: selectedDate === d.value ? 'white' : 'var(--gray-700)',
                      cursor: 'pointer', minWidth: 64, transition: 'var(--transition)',
                      flexShrink: 0
                    }}
                    onClick={() => handleDateChange(d.value)}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{d.dayName}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{d.dayNum}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{d.month}</span>
                  </button>
                ))}
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <>
                  <label className="form-label-custom">Available Time Slots</label>
                  {slotsLoading ? (
                    <LoadingSpinner text="Loading slots..." />
                  ) : slots.length === 0 ? (
                    <div className="alert-custom alert-warning mb-4">
                      <i className="bi bi-exclamation-triangle" />
                      <span>No available slots for this date. Doctor may not be available on this day.</span>
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2 mb-4">
                      {slots.map(slot => (
                        <button
                          key={slot.start}
                          type="button"
                          className={`slot-btn ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
                          disabled={slot.booked}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot.start} — {slot.end}
                          {slot.booked && <i className="bi bi-lock-fill ms-1" style={{ fontSize: 11 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Reason */}
              {selectedSlot && (
                <div className="mb-4 animate-fadeInUp">
                  <label className="form-label-custom" htmlFor="booking-reason">Reason for Visit (optional)</label>
                  <textarea
                    id="booking-reason"
                    className="form-input-custom"
                    rows={3}
                    placeholder="Describe your symptoms or reason for visiting..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    maxLength={500}
                  />
                  <div className={`char-counter ${reason.length > 450 ? (reason.length > 490 ? 'danger' : 'warning') : ''}`}>
                    {reason.length}/500
                  </div>
                </div>
              )}

              {/* Book Button */}
              {selectedSlot && (
                <div className="animate-fadeInUp">
                  <button
                    className="btn-primary-custom"
                    onClick={() => setShowConfirm(true)}
                  >
                    Confirm Booking <i className="bi bi-arrow-right" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <>
          <div className="overlay" onClick={() => setShowConfirm(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 'var(--radius-lg)', padding: 32,
            zIndex: 1001, width: '90%', maxWidth: 460, boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-calendar-check me-2 text-primary" />Confirm Appointment
            </h5>
            <div className="d-flex flex-column gap-3 mb-4" style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 'var(--radius-md)' }}>
              <div className="d-flex justify-content-between">
                <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Doctor</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Dr. {name}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Date</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Time</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedSlot.start} — {selectedSlot.end}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Fee</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>₹{doctor.consultation_fee ?? 0}</span>
              </div>
              {reason && (
                <div className="d-flex justify-content-between">
                  <span style={{ fontSize: 14, color: 'var(--gray-500)' }}>Reason</span>
                  <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right', maxWidth: 200 }}>{reason}</span>
                </div>
              )}
            </div>
            <div className="d-flex gap-3">
              <button className="btn-outline-custom flex-fill" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-primary-custom flex-fill justify-content-center" onClick={handleBooking} disabled={booking}>
                {booking ? (
                  <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Booking...</>
                ) : (
                  <>Confirm <i className="bi bi-check-lg" /></>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  )
}
