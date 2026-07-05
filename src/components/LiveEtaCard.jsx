import { useState, useEffect } from 'react'
import {
  getMyQueueEntry, subscribeToMyEntry,
  formatEtaTime, minutesUntil, QUEUE_STATE,
} from '../services/queue'

/**
 * Patient-facing "Uber-style" live ETA for one appointment.
 *
 * Renders nothing until a queue entry exists for the appointment (i.e. the
 * doctor's queue has been started for the day). Subscribes to Realtime so the
 * position / ETA update live as the doctor advances the queue.
 */
export default function LiveEtaCard({ appointmentId }) {
  const [entry, setEntry] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let active = true
    getMyQueueEntry(appointmentId)
      .then(e => { if (active) setEntry(e) })
      .catch(() => {})
    const unsub = subscribeToMyEntry(appointmentId, e => { if (active) setEntry(e) })
    // Re-render every 30s so the "~N min" countdown stays fresh.
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => { active = false; unsub(); clearInterval(t) }
  }, [appointmentId])

  if (!entry || entry.state === QUEUE_STATE.COMPLETED || entry.state === QUEUE_STATE.SKIPPED) {
    return null
  }

  const inConsult = entry.state === QUEUE_STATE.IN_CONSULTATION
  const mins = minutesUntil(entry.etaAt)

  return (
    <div
      className="mt-2"
      style={{
        background: 'linear-gradient(135deg, rgba(0,119,182,0.10), rgba(45,198,83,0.10))',
        border: '1px solid rgba(0,119,182,0.20)',
        borderRadius: 'var(--radius-md)', padding: '12px 14px',
      }}
      aria-live="polite"
    >
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#2DC653', marginRight: 6, animation: 'pulse 1.6s infinite',
          }} />
          Live queue
        </span>
        {!inConsult && entry.position > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>
            You are #{entry.position}
          </span>
        )}
      </div>

      {inConsult ? (
        <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: '#158a3a' }}>
          <i className="bi bi-door-open me-1" /> It's your turn — please head in.
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--dark)' }}>
            {mins != null ? `~${mins} min` : '—'}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)' }}>
              {' '}· est. {formatEtaTime(entry.etaAt)}
            </span>
          </div>
          {entry.suggestedLeaveAt && (
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>
              <i className="bi bi-geo-alt me-1" />
              Leave by <strong>{formatEtaTime(entry.suggestedLeaveAt)}</strong> — no need to wait in the clinic.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
