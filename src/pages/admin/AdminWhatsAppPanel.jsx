import { useState, useEffect } from 'react'
import { getWhatsAppStatus, getWhatsAppStats, getWhatsAppLogs, sendTestWhatsApp } from '../../services/whatsapp'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminWhatsAppPanel() {
  const [status, setStatus] = useState({ connected: false, sessionId: null, error: null })
  const [stats, setStats] = useState({ sentToday: 0, sentThisWeek: 0, failedThisWeek: 0 })
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [testNumber, setTestNumber] = useState('')
  const [testMessage, setTestMessage] = useState('Hello! This is a test from MediBook Hospital 🏥')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statusRes, statsRes, logsRes] = await Promise.all([
        getWhatsAppStatus(),
        getWhatsAppStats(),
        getWhatsAppLogs({}, 0, 20)
      ])
      setStatus(statusRes)
      setStats(statsRes)
      setLogs(logsRes)
    } catch (err) {
      toast.error('Failed to load WhatsApp data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendTest() {
    if (!testNumber) {
      toast.error('Please enter a phone number')
      return
    }
    try {
      setSending(true)
      await sendTestWhatsApp(testNumber, testMessage)
      toast.success('Test message sent!')
      setTestNumber('')
    } catch (err) {
      toast.error('Failed: ' + (err.message || 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading WhatsApp panel..." />

  return (
    <div style={{ padding: '32px 24px' }}>
      <div className="d-flex align-items-center gap-3 mb-4">
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-md)',
          background: 'rgba(37,211,102,0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="bi bi-whatsapp" style={{ fontSize: 24, color: '#25D366' }} />
        </div>
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
            WhatsApp Gateway
          </h4>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', margin: 0 }}>
            Manage WhatsApp notification service
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="card-custom p-4 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: status.connected ? '#25D366' : 'var(--danger)',
            boxShadow: `0 0 8px ${status.connected ? 'rgba(37,211,102,0.5)' : 'rgba(239,35,60,0.5)'}`,
            animation: status.connected ? 'pulse-glow 2s ease-in-out infinite' : 'none'
          }} />
          <div>
            <strong style={{ fontSize: 15 }}>
              {status.connected ? 'Connected' : 'Disconnected'}
            </strong>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              {status.connected
                ? `Session: ${status.sessionId || 'medibook-hospital'}`
                : (status.error || 'Gateway is not reachable. Check Docker container.')}
            </div>
          </div>
          <button
            className="btn-ghost ms-auto"
            onClick={loadData}
            style={{ fontSize: 13 }}
          >
            <i className="bi bi-arrow-clockwise me-1" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Sent Today', value: stats.sentToday, icon: 'bi-send-check', color: '#25D366' },
          { label: 'This Week', value: stats.sentThisWeek, icon: 'bi-calendar-week', color: 'var(--primary)' },
          { label: 'Failed', value: stats.failedThisWeek, icon: 'bi-exclamation-triangle', color: 'var(--danger)' }
        ].map((stat, i) => (
          <div key={i} className="col-md-4">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                <i className={`bi ${stat.icon}`} />
              </div>
              <div className="kpi-value">{stat.value}</div>
              <div className="kpi-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Test Message */}
      <div className="card-custom p-4 mb-4">
        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
          <i className="bi bi-send me-2" style={{ color: '#25D366' }} />
          Send Test Message
        </h6>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label-custom">Phone Number</label>
            <input
              type="tel"
              className="form-input-custom"
              placeholder="919876543210"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label-custom">Message</label>
            <input
              type="text"
              className="form-input-custom"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button
              className="btn-primary-custom w-100"
              onClick={handleSendTest}
              disabled={sending || !status.connected}
              style={{ padding: '12px 16px' }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Delivery Log */}
      <div className="card-custom p-4">
        <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
          <i className="bi bi-list-ul me-2" style={{ color: 'var(--primary)' }} />
          Recent Delivery Log
        </h6>
        {logs.length === 0 ? (
          <div className="text-center py-4" style={{ color: 'var(--gray-400)', fontSize: 14 }}>
            No WhatsApp messages sent yet
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontSize: 14 }}>
                        {log.profiles?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                        {log.recipient}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)' }}>
                        {log.event?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 11,
                        fontWeight: 600,
                        background: log.status === 'SENT' ? 'rgba(37,211,102,0.1)' : 'rgba(239,35,60,0.1)',
                        color: log.status === 'SENT' ? '#25D366' : 'var(--danger)'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
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
