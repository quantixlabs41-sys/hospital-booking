import { useState, useEffect } from 'react'
import { getDoctorByUserId, getDoctorAvailability, setDoctorAvailability } from '../../services/doctors'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' }

function defaultSlot(day) {
  return { day_of_week: day, start_time: '09:00', end_time: '17:00', slot_duration_mins: 30, enabled: false }
}

export default function DoctorAvailability() {
  const { user } = useAuth()
  const [doctorId, setDoctorId] = useState(null)
  const [schedule, setSchedule] = useState(DAYS.map(d => defaultSlot(d)))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) loadAvailability()
  }, [user])

  async function loadAvailability() {
    try {
      setLoading(true)
      const doc = await getDoctorByUserId(user.id)
      if (!doc) return
      setDoctorId(doc.id)
      const existing = await getDoctorAvailability(doc.id)

      const merged = DAYS.map(day => {
        const found = existing.find(e => e.day_of_week === day)
        return found
          ? { ...found, enabled: true }
          : defaultSlot(day)
      })
      setSchedule(merged)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function updateDay(index, field, value) {
    const updated = [...schedule]
    updated[index] = { ...updated[index], [field]: value }
    setSchedule(updated)
  }

  async function handleSave() {
    if (!doctorId) return

    // Validate all enabled days
    const errors = []
    schedule.forEach(s => {
      if (!s.enabled) return
      const [sh, sm] = s.start_time.split(':').map(Number)
      const [eh, em] = s.end_time.split(':').map(Number)
      const totalMins = (eh * 60 + em) - (sh * 60 + sm)
      if (totalMins <= 0) {
        errors.push(`${DAY_LABELS[s.day_of_week]}: End time must be after start time`)
      } else {
        const slotCount = Math.floor(totalMins / s.slot_duration_mins)
        if (slotCount <= 0) {
          errors.push(`${DAY_LABELS[s.day_of_week]}: Duration too short for selected slot size`)
        }
      }
    })

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err))
      return
    }

    try {
      setSaving(true)
      const slots = schedule
        .filter(s => s.enabled)
        .map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          slot_duration_mins: s.slot_duration_mins
        }))
      await setDoctorAvailability(doctorId, slots)
      toast.success('Availability updated successfully!')
    } catch (err) {
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading schedule..." />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            My Schedule
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Configure your weekly availability for appointments
          </p>
        </div>
        <button className="btn-primary-custom" onClick={handleSave} disabled={saving}>
          {saving ? (
            <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
          ) : (
            <><i className="bi bi-check-lg" /> Save Schedule</>
          )}
        </button>
      </div>

      <div className="alert-custom alert-info mb-4">
        <i className="bi bi-info-circle" />
        <span>Toggle each day on/off and set your working hours. Appointment slots will be auto-generated based on your slot duration.</span>
      </div>

      <div className="d-flex flex-column gap-3">
        {schedule.map((day, i) => (
          <div
            key={day.day_of_week}
            className="card-custom p-4"
            style={{ opacity: day.enabled ? 1 : 0.6, transition: 'var(--transition)' }}
          >
            <div className="d-flex align-items-center gap-4 flex-wrap">
              {/* Toggle */}
              <div className="d-flex align-items-center gap-3" style={{ minWidth: 160 }}>
                <label className="d-flex align-items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={e => updateDay(i, 'enabled', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                    {DAY_LABELS[day.day_of_week]}
                  </span>
                </label>
              </div>

              {day.enabled && (
                <>
                  {/* Start Time */}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--gray-400)', display: 'block', marginBottom: 4 }}>Start</label>
                    <input
                      type="time"
                      className="form-input-custom"
                      style={{ width: 130, padding: '8px 12px', fontSize: 14 }}
                      value={day.start_time}
                      onChange={e => updateDay(i, 'start_time', e.target.value)}
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--gray-400)', display: 'block', marginBottom: 4 }}>End</label>
                    <input
                      type="time"
                      className="form-input-custom"
                      style={{ width: 130, padding: '8px 12px', fontSize: 14 }}
                      value={day.end_time}
                      onChange={e => updateDay(i, 'end_time', e.target.value)}
                    />
                  </div>

                  {/* Slot Duration */}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--gray-400)', display: 'block', marginBottom: 4 }}>Slot Duration</label>
                    <select
                      className="form-input-custom"
                      style={{ width: 120, padding: '8px 12px', fontSize: 14 }}
                      value={day.slot_duration_mins}
                      onChange={e => updateDay(i, 'slot_duration_mins', parseInt(e.target.value))}
                    >
                      <option value={15}>15 mins</option>
                      <option value={20}>20 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                    </select>
                  </div>

                  {/* Slot Preview */}
                  <div className="ms-auto" style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                    {(() => {
                      const [sh, sm] = day.start_time.split(':').map(Number)
                      const [eh, em] = day.end_time.split(':').map(Number)
                      const totalMins = (eh * 60 + em) - (sh * 60 + sm)
                      const slotCount = Math.floor(totalMins / day.slot_duration_mins)
                      return slotCount > 0 ? `${slotCount} slots` : 'Invalid time range'
                    })()}
                  </div>
                </>
              )}

              {!day.enabled && (
                <span style={{ fontSize: 14, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                  Not available
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
