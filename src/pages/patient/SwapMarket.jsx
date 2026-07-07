import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { listSwapOffers, getMySwapOffers, acceptSwapOffer, cancelSwapOffer } from '../../services/swap'

const OFFER_STATUS = {
  OPEN: { label: 'Open', color: '#0077B6' },
  COMPLETED: { label: 'Swapped', color: '#2DC653' },
  CANCELLED: { label: 'Cancelled', color: '#EF233C' },
  EXPIRED: { label: 'Expired', color: '#94A3B8' },
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const dt = new Date(); dt.setHours(+h, +m, 0, 0)
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function SwapMarket() {
  const [offers, setOffers] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [available, own] = await Promise.all([listSwapOffers(), getMySwapOffers()])
      setOffers(available)
      setMine(own)
    } catch (err) {
      toast.error(err.message || 'Could not load the swap market.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAccept(offer) {
    try {
      setBusyId(offer.offerId)
      await acceptSwapOffer(offer.offerId, offer.myAppointmentId)
      toast.success('Swap complete! You moved to the earlier slot.')
      load()
    } catch (err) {
      toast.error(err.message || 'Could not complete the swap.')
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(offerId) {
    try {
      setBusyId(offerId)
      await cancelSwapOffer(offerId)
      toast.success('Offer withdrawn.')
      load()
    } catch (err) {
      toast.error(err.message || 'Could not cancel the offer.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <Navbar />

      <div className="page-header">
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="section-badge">Smart Swap</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'white', fontFamily: 'var(--font-display)', margin: 0 }}>
            Slot Swap Market
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginTop: 8, fontSize: 15, marginBottom: 0 }}>
            Grab an earlier slot someone gave up — or offer yours and earn a co-pay discount. Fully anonymous.
          </p>
        </div>
      </div>

      <div className="container py-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
            <i className="bi bi-arrow-left-right me-2 text-primary" />Earlier slots you can grab
          </h5>
          <Link to="/patient/appointments" className="btn-ghost" style={{ fontSize: 13 }}>
            <i className="bi bi-calendar2-check me-1" />My appointments
          </Link>
        </div>

        {loading ? (
          <div className="d-flex flex-column gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 84, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-arrow-left-right" />
            <p>No swaps available right now. Offers appear here when a patient with an earlier slot
              (for a doctor you already have a later appointment with) gives it up.</p>
          </div>
        ) : (
          <div className="row g-3 stagger-children">
            {offers.map(o => (
              <div key={o.offerId} className="col-md-6">
                <div className="card-custom p-3 h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
                        Dr. {o.doctorName}
                      </h6>
                      <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>{o.specialization}</span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                      background: 'rgba(45,198,83,0.12)', color: '#158a3a',
                    }}>
                      {o.discountPercent}% off co-pay
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-3 my-3">
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: 'rgba(0,119,182,0.08)' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Grab</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(o.offerDate)}</div>
                      <div style={{ fontSize: 13, color: 'var(--primary)' }}>{fmtTime(o.offerSlotStart)}</div>
                    </div>
                    <i className="bi bi-arrow-left-right" style={{ color: 'var(--gray-400)' }} />
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Give up</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(o.myAppointmentDate)}</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{fmtTime(o.mySlotStart)}</div>
                    </div>
                  </div>

                  {o.note && (
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 12px' }}>
                      <i className="bi bi-chat-quote me-1" />{o.note}
                    </p>
                  )}

                  <button
                    className="btn-primary-custom mt-auto justify-content-center"
                    disabled={busyId === o.offerId}
                    onClick={() => handleAccept(o)}
                  >
                    {busyId === o.offerId ? 'Swapping…' : <>Take earlier slot <i className="bi bi-arrow-right" /></>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My offers */}
        <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: '40px 0 16px' }}>
          <i className="bi bi-tag me-2 text-primary" />My swap offers
        </h5>
        {mine.length === 0 ? (
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>
            You haven't offered any slots. Open <Link to="/patient/appointments">My Appointments</Link> and
            tap “Offer for swap” on an upcoming visit to give someone an earlier slot and earn a discount.
          </p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {mine.map(o => {
              const st = OFFER_STATUS[o.status] || OFFER_STATUS.OPEN
              return (
                <div key={o.id} className="card-custom p-3 d-flex align-items-center justify-content-between gap-3">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {fmtDate(o.offer_date)} · {fmtTime(o.offer_slot_start)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{st.label}</span>
                    {o.discount_percent > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--gray-500)' }}> · {o.discount_percent}% co-pay reward</span>
                    )}
                  </div>
                  {o.status === 'OPEN' && (
                    <button className="btn-ghost" style={{ fontSize: 13, color: 'var(--danger)' }}
                            disabled={busyId === o.id} onClick={() => handleCancel(o.id)}>
                      Withdraw
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
