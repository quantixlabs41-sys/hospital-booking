import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { getDoctorByUserId } from '../../services/doctors'
import { supabase } from '../../lib/supabase'
import {
  seedQueue, subscribeToDoctorQueue,
  markCheckedIn, startConsultation, completeConsultation, skipEntry, restoreEntry,
  flagDelay, QUEUE_STATE, QUEUE_STATE_LABELS, formatEtaTime, minutesUntil,
} from '../../services/queue'

const STATE_STYLE = {
  WAITING: { bg: 'rgba(148,163,184,0.14)', color: '#475569' },
  CHECKED_IN: { bg: 'rgba(0,119,182,0.10)', color: '#0077B6' },
  IN_CONSULTATION: { bg: 'rgba(45,198,83,0.14)', color: '#158a3a' },
  COMPLETED: { bg: 'rgba(45,198,83,0.10)', color: '#2DC653' },
  SKIPPED: { bg: 'rgba(239,35,60,0.10)', color: '#EF233C' },
}

const today = () => new Date().toISOString().split('T')[0]

export default function DoctorQueue() {
  const { user } = useAuth()
  const [doctorId, setDoctorId] = useState(null)
  const [queue, setQueue] = useState([])
  const [patientNames, setPatientNames] = useState({}) // patientId -> name
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [delayOpen, setDelayOpen] = useState(false)
  const [delayMins, setDelayMins] = useState(15)
  const [delayReason, setDelayReason] = useState('')
  const dateStr = today()
  const notifierPending = useRef(false)

  const applyQueue = useCallback((rows) => {
    // rows already ordered by the RPC; realtime patches replace by id.
    setQueue(rows)
  }, [])

  // Resolve the logged-in doctor's id, then seed + subscribe.
  useEffect(() => {
    let unsub = () => {}
    let active = true
    ;(async () => {
      try {
        const doc = await getDoctorByUserId(user.id)
        if (!active) return
        setDoctorId(doc.id)
        const rows = await seedQueue(doc.id, dateStr)
        if (!active) return
        applyQueue(rows)
        await loadNames(rows)
        unsub = subscribeToDoctorQueue(doc.id, dateStr, () => refresh(doc.id))
      } catch (err) {
        toast.error(err.message || 'Could not load the queue.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false; unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  // A realtime change just re-seeds (idempotent) to get the fully-ordered list.
  const refresh = useCallback(async (docId) => {
    try {
      const rows = await seedQueue(docId, dateStr)
      applyQueue(rows)
      loadNames(rows)
    } catch { /* transient */ }
  }, [applyQueue, dateStr])

  // Fetch patient display names for the entries we can see (doctor RLS allows it).
  async function loadNames(rows) {
    const ids = [...new Set(rows.map(r => r.patientId))].filter(Boolean)
    if (!ids.length) return
    const { data } = await supabase.from('profiles').select('id, name').in('id', ids)
    if (data) {
      setPatientNames(prev => {
        const next = { ...prev }
        for (const p of data) next[p.id] = p.name
        return next
      })
    }
  }

  // Best-effort web push after a mutation (in-app already handled server-side).
  function fireNotifier() {
    if (!doctorId || notifierPending.current) return
    notifierPending.current = true
    supabase.functions
      .invoke('queue-eta-notifier', { body: { doctorId, date: dateStr } })
      .catch(() => {})
      .finally(() => { notifierPending.current = false })
  }

  async function act(fn, entryId) {
    try {
      setBusyId(entryId)
      const rows = await fn(entryId)
      applyQueue(rows)
      loadNames(rows)
      fireNotifier()
    } catch (err) {
      toast.error(err.message || 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function submitDelay(e) {
    e.preventDefault()
    try {
      const rows = await flagDelay(doctorId, Number(delayMins), delayReason.trim(), dateStr)
      applyQueue(rows)
      setDelayOpen(false)
      setDelayReason('')
      fireNotifier()
      toast.success(`Queue pushed back by ${delayMins} min. Patients are being notified.`)
    } catch (err) {
      toast.error(err.message || 'Could not flag the delay.')
    }
  }

  const activeCount = queue.filter(q => [QUEUE_STATE.WAITING, QUEUE_STATE.CHECKED_IN, QUEUE_STATE.IN_CONSULTATION].includes(q.state)).length
  const doneCount = queue.filter(q => q.state === QUEUE_STATE.COMPLETED).length

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
            <i className="bi bi-hourglass-split me-2 text-primary" />Live Queue
          </h2>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: 14 }}>
            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}{activeCount} in queue · {doneCount} done
          </p>
        </div>
        <button className="btn-outline-custom" onClick={() => setDelayOpen(true)} disabled={!doctorId}>
          <i className="bi bi-exclamation-triangle me-1" /> Flag Delay
        </button>
      </div>

      {loading ? (
        <div className="d-flex flex-column gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-calendar-x" />
          <p>No appointments in today's queue yet.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {queue.map(entry => {
            const st = STATE_STYLE[entry.state] || STATE_STYLE.WAITING
            const name = patientNames[entry.patientId] || 'Patient'
            const isTerminal = entry.state === 'COMPLETED' || entry.state === 'SKIPPED'
            const mins = minutesUntil(entry.etaAt)
            return (
              <div key={entry.id} className="card-custom p-3 d-flex align-items-center gap-3"
                   style={{ opacity: isTerminal ? 0.7 : 1 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--primary)', color: 'white', fontWeight: 800, fontFamily: 'var(--font-display)',
                }}>
                  {isTerminal ? <i className="bi bi-check-lg" /> : (entry.position || '–')}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontWeight: 700, fontSize: 15 }} className="truncate">{name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.color }}>
                      {QUEUE_STATE_LABELS[entry.state]}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    <i className="bi bi-clock me-1" />{entry.scheduledStartTime?.substring(0, 5)}
                    {!isTerminal && entry.etaAt && (
                      <span> · ETA <strong style={{ color: 'var(--dark)' }}>{formatEtaTime(entry.etaAt)}</strong>{mins != null ? ` (~${mins} min)` : ''}</span>
                    )}
                  </div>
                </div>

                <div className="d-flex gap-2 flex-shrink-0">
                  {entry.state === 'WAITING' && (
                    <button className="btn-outline-custom" style={{ padding: '6px 12px', fontSize: 13 }}
                            disabled={busyId === entry.id} onClick={() => act(markCheckedIn, entry.id)}>
                      Check in
                    </button>
                  )}
                  {entry.state === 'CHECKED_IN' && (
                    <button className="btn-primary-custom" style={{ padding: '6px 12px', fontSize: 13 }}
                            disabled={busyId === entry.id} onClick={() => act(startConsultation, entry.id)}>
                      Start
                    </button>
                  )}
                  {entry.state === 'IN_CONSULTATION' && (
                    <button className="btn-primary-custom" style={{ padding: '6px 12px', fontSize: 13 }}
                            disabled={busyId === entry.id} onClick={() => act(completeConsultation, entry.id)}>
                      Complete
                    </button>
                  )}
                  {(entry.state === 'WAITING' || entry.state === 'CHECKED_IN') && (
                    <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 13, color: 'var(--danger)' }}
                            disabled={busyId === entry.id} onClick={() => act(skipEntry, entry.id)} title="Skip">
                      <i className="bi bi-skip-forward" />
                    </button>
                  )}
                  {entry.state === 'SKIPPED' && (
                    <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }}
                            disabled={busyId === entry.id} onClick={() => act(restoreEntry, entry.id)} title="Restore">
                      <i className="bi bi-arrow-counterclockwise" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delay modal */}
      {delayOpen && (
        <>
          <div className="overlay" onClick={() => setDelayOpen(false)} />
          <form onSubmit={submitDelay} style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 'var(--radius-lg)', padding: 28,
            zIndex: 1001, width: '90%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          }}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>
              <i className="bi bi-exclamation-triangle me-2" style={{ color: '#F59E0B' }} />Flag a Delay
            </h5>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Push every waiting patient's ETA back. Anyone affected by more than 15 minutes is notified automatically.
            </p>
            <label className="form-label-custom">Delay (minutes)</label>
            <input type="number" min={1} max={480} className="form-input-custom mb-3"
                   value={delayMins} onChange={e => setDelayMins(e.target.value)} required />
            <label className="form-label-custom">Reason (optional)</label>
            <input type="text" className="form-input-custom mb-4" maxLength={200}
                   placeholder="e.g. Emergency surgery"
                   value={delayReason} onChange={e => setDelayReason(e.target.value)} />
            <div className="d-flex gap-3">
              <button type="button" className="btn-ghost flex-fill" onClick={() => setDelayOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary-custom flex-fill justify-content-center">Apply Delay</button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
