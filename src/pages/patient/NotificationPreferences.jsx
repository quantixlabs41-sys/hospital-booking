import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getNotificationPreferences, saveNotificationPreferences } from '../../services/notifications'
import { saveWhatsAppPreference, verifyWhatsAppNumber, confirmWhatsAppVerification } from '../../services/whatsapp'
import { toast } from 'react-toastify'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function NotificationPreferences() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    push_enabled: true,
    whatsapp_enabled: false,
    whatsapp_number: '',
    whatsapp_verified: false,
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
        whatsapp_enabled: prefs.whatsapp_enabled,
        whatsapp_number: prefs.whatsapp_number || null,
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

  async function handleVerifyWhatsApp() {
    if (!prefs.whatsapp_number) {
      toast.error('Please enter your WhatsApp number first')
      return
    }
    try {
      setVerifying(true)
      await verifyWhatsAppNumber(user.id, prefs.whatsapp_number)
      toast.success('Verification message sent! Check your WhatsApp.')
      // Auto-confirm for now (in production, wait for webhook)
      setTimeout(async () => {
        await confirmWhatsAppVerification(user.id)
        setPrefs(prev => ({ ...prev, whatsapp_verified: true }))
        toast.success('WhatsApp verified ✓')
      }, 3000)
    } catch (err) {
      toast.error('Failed to verify WhatsApp: ' + (err.message || 'Unknown error'))
    } finally {
      setVerifying(false)
    }
  }

  function updatePref(key, value) {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return <LoadingSpinner fullPage text="Loading preferences..." />

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

          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '16px 0' }} />

          {/* WhatsApp */}
          <ToggleRow
            icon="bi-whatsapp"
            iconColor="#25D366"
            label="WhatsApp Notifications"
            description="Get reminders directly on WhatsApp"
            checked={prefs.whatsapp_enabled}
            onChange={(v) => updatePref('whatsapp_enabled', v)}
          />

          {/* WhatsApp Number Input (shown when enabled) */}
          {prefs.whatsapp_enabled && (
            <div className="mt-3 ms-5" style={{ maxWidth: 400 }}>
              <label className="form-label-custom">WhatsApp Number</label>
              <div className="d-flex gap-2">
                <div className="d-flex align-items-center gap-1 px-3" style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--gray-200)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--gray-600)',
                  whiteSpace: 'nowrap'
                }}>
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  className="form-input-custom"
                  placeholder="9876543210"
                  value={prefs.whatsapp_number?.replace(/^91/, '') || ''}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '').slice(0, 10)
                    updatePref('whatsapp_number', '91' + num)
                  }}
                  style={{ flex: 1 }}
                />
              </div>

              {prefs.whatsapp_verified ? (
                <div className="d-flex align-items-center gap-2 mt-2" style={{ color: '#25D366', fontSize: 13, fontWeight: 600 }}>
                  <i className="bi bi-check-circle-fill" /> WhatsApp verified
                </div>
              ) : (
                <button
                  className="btn-ghost mt-2 d-flex align-items-center gap-2"
                  style={{ fontSize: 13, color: '#25D366', padding: '6px 14px' }}
                  onClick={handleVerifyWhatsApp}
                  disabled={verifying || !prefs.whatsapp_number || prefs.whatsapp_number.length < 12}
                >
                  {verifying ? (
                    <>
                      <span className="spinner-custom" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-whatsapp" /> Verify Number
                    </>
                  )}
                </button>
              )}
            </div>
          )}
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
