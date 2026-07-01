import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getNotificationPreferences, saveNotificationPreferences } from '../../services/notifications'
import { toast } from 'react-toastify'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'


export default function NotificationPreferences() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    push_enabled: true,
    reminder_24h: true,
    reminder_1h: true,
    booking_alerts: true,
    cancel_alerts: true
  })

  useEffect(() => {
    if (user) loadPrefs()
  }, [user])

  async function loadPrefs() {
    try {
      setLoading(true)
      const data = await getNotificationPreferences(user.id)
      if (data) setPrefs(data)
    } catch {
      // First time — use defaults
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      await saveNotificationPreferences(user.id, {
        email_enabled: prefs.email_enabled,
        push_enabled: prefs.push_enabled,
        reminder_24h: prefs.reminder_24h,
        reminder_1h: prefs.reminder_1h,
        booking_alerts: prefs.booking_alerts,
        cancel_alerts: prefs.cancel_alerts
      })
      toast.success('Notification preferences saved!')
    } catch (err) {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  function updatePref(key, value) {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return (
    <div>
      <Navbar />
      <div className="page-header"><div className="container"><div className="skeleton skeleton-heading" style={{ background: 'rgba(255,255,255,0.15)' }} /></div></div>
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card-custom p-4 mb-4">
          <div className="skeleton skeleton-heading" style={{ width: '50%', marginBottom: 20 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="d-flex align-items-center gap-3 py-2">
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div className="skeleton skeleton-text medium" /><div className="skeleton skeleton-text short" /></div>
                <div className="skeleton" style={{ width: 48, height: 26, borderRadius: 13 }} />
              </div>
              {i < 2 && <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '8px 0' }} />}
            </div>
          ))}
        </div>
        <div className="card-custom p-4 mb-4">
          <div className="skeleton skeleton-heading" style={{ width: '40%', marginBottom: 20 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="d-flex align-items-center gap-3 py-2">
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div className="skeleton skeleton-text medium" /><div className="skeleton skeleton-text short" /></div>
                <div className="skeleton" style={{ width: 48, height: 26, borderRadius: 13 }} />
              </div>
              {i < 3 && <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '8px 0' }} />}
            </div>
          ))}
        </div>
        <div className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-full)' }} />
      </div>
      <Footer />
    </div>
  )

  return (
    <div>
      <Navbar />

      <div className="page-header">
        <div className="container">
          <div className="section-badge">Settings</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', position: 'relative', zIndex: 1 }}>
            Notification Preferences
          </h1>
        </div>
      </div>

      <div className="container py-5" style={{ maxWidth: 720 }}>
        {/* Channels */}
        <div className="card-custom p-4 mb-4">
          <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
            <i className="bi bi-broadcast me-2" style={{ color: 'var(--primary)' }} />
            Notification Channels
          </h6>

          {/* Email */}
          <ToggleRow
            icon="bi-envelope"
            iconColor="var(--primary)"
            label="Email Notifications"
            description="Receive appointment updates via email"
            checked={prefs.email_enabled}
            onChange={(v) => updatePref('email_enabled', v)}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '16px 0' }} />

          {/* Push */}
          <ToggleRow
            icon="bi-bell"
            iconColor="var(--info)"
            label="Push Notifications"
            description="Browser push notifications for reminders"
            checked={prefs.push_enabled}
            onChange={(v) => updatePref('push_enabled', v)}
          />
        </div>

        {/* Event Types */}
        <div className="card-custom p-4 mb-4">
          <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
            <i className="bi bi-list-check me-2" style={{ color: 'var(--primary)' }} />
            Event Preferences
          </h6>

          <ToggleRow
            icon="bi-calendar-plus"
            iconColor="var(--primary)"
            label="Booking Confirmations"
            description="When an appointment is booked or confirmed"
            checked={prefs.booking_alerts}
            onChange={(v) => updatePref('booking_alerts', v)}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '16px 0' }} />

          <ToggleRow
            icon="bi-alarm"
            iconColor="var(--warning)"
            label="24-Hour Reminder"
            description="Reminder 24 hours before your appointment"
            checked={prefs.reminder_24h}
            onChange={(v) => updatePref('reminder_24h', v)}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '16px 0' }} />

          <ToggleRow
            icon="bi-bell"
            iconColor="var(--danger)"
            label="1-Hour Reminder"
            description="Reminder 1 hour before your appointment"
            checked={prefs.reminder_1h}
            onChange={(v) => updatePref('reminder_1h', v)}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '16px 0' }} />

          <ToggleRow
            icon="bi-x-circle"
            iconColor="var(--danger)"
            label="Cancellation Alerts"
            description="When an appointment is cancelled"
            checked={prefs.cancel_alerts}
            onChange={(v) => updatePref('cancel_alerts', v)}
          />
        </div>

        {/* Save Button */}
        <button
          className="btn-primary-custom w-100"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '14px 28px', fontSize: 16 }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      <Footer />
    </div>
  )
}

/**
 * Reusable toggle row component with icon, label, description, and switch.
 */
function ToggleRow({ icon, iconColor, label, description, checked, onChange }) {
  return (
    <div className="d-flex align-items-center gap-3">
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: `${iconColor}12`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 18, color: iconColor }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--dark)' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{description}</div>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}
