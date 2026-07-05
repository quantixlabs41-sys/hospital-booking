import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import {
  getHospitalsWithRatings,
  getRankedHospitals,
  getPlaceReviews,
  getMyPlaceReview,
  upsertPlaceReview,
} from '../services/reviews'
import { getHospitalsNear, searchExternalHospitals } from '../services/places'
import { getPhotoUrl } from '../services/hospital'
import HospitalsMap from './HospitalsMap'

// Haversine distance (km)
function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function Stars({ value = 0, size = 14 }) {
  return (
    <span className="d-inline-flex align-items-center gap-1" aria-label={`${Number(value).toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <i key={i} className={`bi ${i < Math.round(value) ? 'bi-star-fill' : 'bi-star'}`}
          style={{ color: i < Math.round(value) ? '#F59E0B' : 'var(--gray-300)', fontSize: size }} />
      ))}
    </span>
  )
}

export default function HospitalDiscovery() {
  const { user, profile } = useAuth()

  const [ours, setOurs] = useState([])
  const [ranked, setRanked] = useState([])
  const [externalPins, setExternalPins] = useState([]) // discovered OSM hospitals
  const [loading, setLoading] = useState(true)

  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [focusKey, setFocusKey] = useState(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null) // null = not searching

  // Detail drawer
  const [selected, setSelected] = useState(null)
  const [detailReviews, setDetailReviews] = useState([])
  const [myReview, setMyReview] = useState(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadCore = useCallback(async () => {
    try {
      setLoading(true)
      const [all, rank] = await Promise.all([
        getHospitalsWithRatings(),
        getRankedHospitals({ limit: 9, minReviews: 1 }),
      ])
      setOurs(all)
      setRanked(rank)
    } catch (err) {
      console.error('Failed to load hospitals:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCore() }, [loadCore])

  // Merge our hospitals (with coords) + discovered external pins for the map.
  const mapPlaces = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const p of [...ours, ...externalPins]) {
      if (p.latitude == null || p.longitude == null) continue
      if (seen.has(p.placeKey)) continue
      seen.add(p.placeKey)
      out.push(p)
    }
    return out
  }, [ours, externalPins])

  const nearby = useMemo(() => {
    if (userLocation) {
      return mapPlaces
        .map(h => ({ ...h, distance: distanceKm(userLocation, { lat: h.latitude, lng: h.longitude }) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
    }
    return [...ours].sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count).slice(0, 10)
  }, [mapPlaces, ours, userLocation])

  async function handleUseMyLocation() {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by your browser.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        // Pull nearby hospitals from OpenStreetMap (every hospital, not just ours).
        const found = await getHospitalsNear(loc.lat, loc.lng, 7000, 60)
        setExternalPins(prev => dedupe([...prev, ...found]))
        setLocating(false)
        toast.success(found.length ? `Found ${found.length} hospitals near you.` : 'Showing your location.')
      },
      () => { setLocating(false); toast.error('Could not get your location. Please allow access and retry.') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function dedupe(arr) {
    const seen = new Set(); const out = []
    for (const p of arr) { if (!seen.has(p.placeKey)) { seen.add(p.placeKey); out.push(p) } }
    return out
  }

  async function handleSearch(e) {
    e?.preventDefault()
    const q = query.trim()
    if (q.length < 2) { setSearchResults(null); return }
    setSearching(true)
    try {
      const ql = q.toLowerCase()
      const localMatches = ours.filter(h =>
        h.name?.toLowerCase().includes(ql) || h.city?.toLowerCase().includes(ql)
      )
      const external = await searchExternalHospitals(q, 12)
      // External results not already in our set.
      const localKeys = new Set(ours.map(h => h.placeKey))
      const externalOnly = external.filter(e => !localKeys.has(e.placeKey))
      setExternalPins(prev => dedupe([...prev, ...externalOnly]))
      setSearchResults([...localMatches, ...externalOnly])
      if (localMatches.length + externalOnly.length === 0) toast.info('No hospitals matched your search.')
    } catch {
      toast.error('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setSearchResults(null)
  }

  // ── Detail drawer ──
  async function openDetail(place) {
    setSelected(place)
    setFocusKey(place.placeKey)
    setComment(''); setRating(0); setMyReview(null)
    setLoadingDetail(true)
    try {
      const [reviews, mine] = await Promise.all([
        getPlaceReviews(place.placeKey),
        user ? getMyPlaceReview(place.placeKey, user.id) : Promise.resolve(null),
      ])
      setDetailReviews(reviews)
      if (mine) { setMyReview(mine); setRating(mine.rating); setComment(mine.comment || '') }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetail() {
    setSelected(null)
    setDetailReviews([])
  }

  async function submitReview(e) {
    e.preventDefault()
    if (!user) return toast.info('Please sign in to share your opinion.')
    if (rating < 1) return toast.error('Please select a star rating.')
    try {
      setSubmitting(true)
      await upsertPlaceReview({
        place: selected,
        userId: user.id,
        rating,
        comment,
        reviewerName: profile?.name || 'Anonymous',
      })
      toast.success('Thanks! Your review has been saved.')
      // Refresh detail + rankings.
      const [reviews] = await Promise.all([getPlaceReviews(selected.placeKey), loadCore()])
      setDetailReviews(reviews)
      setMyReview({ rating, comment })
    } catch (err) {
      console.error('Review error:', err)
      toast.error(err.message || 'Could not save your review.')
    } finally {
      setSubmitting(false)
    }
  }

  const listToShow = searchResults ?? nearby

  return (
    <div className="hospital-explorer">
      {/* ── Search ── */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="hero-search-bar" style={{ boxShadow: 'var(--shadow-md, 0 6px 20px rgba(0,0,0,0.08))' }}>
          <i className="bi bi-search" style={{ color: 'var(--gray-400)', fontSize: 20 }} />
          <input
            type="text"
            placeholder="Search any hospital by name or city — even ones not on MediBook…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            maxLength={80}
          />
          {searchResults && (
            <button type="button" className="btn-ghost" onClick={clearSearch} style={{ padding: '8px 12px' }}>
              <i className="bi bi-x-lg" />
            </button>
          )}
          <button type="submit" className="btn-primary-custom" style={{ padding: '12px 24px' }} disabled={searching}>
            {searching ? <span className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Search'}
          </button>
        </div>
      </form>

      {/* ── Map + list ── */}
      <div className="row g-4 mb-5">
        <div className="col-lg-8">
          <div className="card-custom p-2" style={{ overflow: 'hidden' }}>
            <HospitalsMap
              hospitals={mapPlaces}
              userLocation={userLocation}
              focusKey={focusKey}
              onSelect={openDetail}
              height="460px"
            />
          </div>
          <div className="d-flex align-items-center gap-3 mt-2 px-1" style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            <span><i className="bi bi-hospital-fill me-1" style={{ color: 'var(--primary)' }} />On MediBook</span>
            <span><i className="bi bi-geo-alt-fill me-1" style={{ color: '#0E7490' }} />Other hospitals</span>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card-custom p-3 h-100 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
                {searchResults ? 'Search Results' : userLocation ? 'Nearest to You' : 'Hospitals'}
              </h6>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', color: 'var(--primary)' }}
                onClick={handleUseMyLocation} disabled={locating}>
                {locating
                  ? <><span className="spinner-custom" style={{ width: 13, height: 13, borderWidth: 2 }} /> Locating…</>
                  : <><i className="bi bi-crosshair me-1" />Near me</>}
              </button>
            </div>

            <div className="hospital-nearby-list">
              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading hospitals…</p>
              ) : listToShow.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No hospitals to show. Try searching or “Near me”.</p>
              ) : (
                listToShow.map(h => (
                  <button key={h.placeKey} className="hospital-nearby-item" onClick={() => openDetail(h)}>
                    <div className={`hospital-nearby-icon ${h.external ? 'external' : ''}`}>
                      <i className={`bi ${h.external ? 'bi-geo-alt' : 'bi-hospital'}`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="hospital-nearby-name">{h.name}</div>
                      <div className="hospital-nearby-meta">
                        {[h.city, h.state].filter(Boolean).join(', ') || (h.external ? 'Not on MediBook' : 'Location not set')}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <Stars value={h.avg_rating} size={11} />
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                          {h.review_count > 0 ? `${h.avg_rating.toFixed(1)} (${h.review_count})` : 'No reviews'}
                        </span>
                      </div>
                    </div>
                    {h.distance != null && <span className="hospital-nearby-distance">{h.distance.toFixed(1)} km</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ranking ── */}
      <div className="text-center mb-4">
        <div className="section-badge" style={{ background: 'rgba(249,199,79,0.15)', color: '#D97706' }}>
          <i className="bi bi-trophy me-1" />Ranked by patients
        </div>
        <h3 className="section-title" style={{ fontSize: '1.6rem' }}>Top Rated Hospitals</h3>
        <p className="section-subtitle">Ranked best to lowest using our rating &amp; feedback algorithm</p>
      </div>

      {ranked.length === 0 ? (
        <div className="card-custom p-4 text-center mb-4" style={{ maxWidth: 560, margin: '0 auto' }}>
          <i className="bi bi-star" style={{ fontSize: 32, color: 'var(--gray-300)' }} />
          <p style={{ fontSize: 14, color: 'var(--gray-500)', margin: '10px 0 0' }}>
            No reviews yet. Open any hospital and be the first to rate it.
          </p>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {ranked.map((h, i) => {
            const cover = !h.external ? getPhotoUrl(h.cover_photo_url) : null
            return (
              <div key={h.placeKey} className="col-md-6 col-lg-4">
                <div className="card-custom hospital-rank-card h-100" role="button" onClick={() => openDetail(h)}>
                  <div className={`hospital-rank-badge rank-${i + 1}`}>#{i + 1}</div>
                  <div className="hospital-rank-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
                    {!cover && <i className={`bi ${h.external ? 'bi-geo-alt' : 'bi-hospital'}`} />}
                  </div>
                  <div className="p-3">
                    <div className="d-flex align-items-center gap-2">
                      <h6 style={{ fontWeight: 700, margin: 0, fontSize: 15 }} className="truncate">{h.name}</h6>
                      {!h.external && h.is_verified && <i className="bi bi-patch-check-fill" style={{ color: 'var(--primary)', fontSize: 13 }} title="Verified" />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
                      {[h.city, h.state].filter(Boolean).join(', ') || (h.external ? 'Not on MediBook' : '—')}
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <Stars value={h.avg_rating} />
                        <strong style={{ fontSize: 14, color: 'var(--dark)' }}>{h.avg_rating.toFixed(1)}</strong>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{h.review_count} review{h.review_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail drawer ── */}
      {selected && (
        <>
          <div className="overlay" onClick={closeDetail} />
          <div className="hosp-drawer">
            <div className="modal-header">
              <div style={{ minWidth: 0 }}>
                <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0, fontSize: 18 }} className="truncate">
                  {selected.name}
                </h5>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {selected.external ? 'Not on MediBook' : 'MediBook hospital'}
                </span>
              </div>
              <button className="btn-ghost" onClick={closeDetail} style={{ padding: 8 }}>
                <i className="bi bi-x-lg" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="modal-body">
              {/* Summary */}
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Stars value={selected.avg_rating} size={18} />
                  <strong style={{ fontSize: 18 }}>{selected.avg_rating ? selected.avg_rating.toFixed(1) : '—'}</strong>
                </div>
                <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                  {selected.review_count || detailReviews.length} review{(selected.review_count || detailReviews.length) !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="detail-section">
                {[selected.address, [selected.city, selected.state].filter(Boolean).join(', ')].filter(Boolean).length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">
                      {selected.address || [selected.city, selected.state].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                )}
                {selected.phone && (
                  <div className="detail-row"><span className="detail-label">Phone</span>
                    <span className="detail-value">{selected.phone}</span></div>
                )}
                {selected.website && (
                  <div className="detail-row"><span className="detail-label">Website</span>
                    <a className="detail-value" href={selected.website} target="_blank" rel="noopener noreferrer">Visit ↗</a></div>
                )}
              </div>

              {!selected.external && (
                <Link to="/doctors" className="btn-primary-custom w-100 justify-content-center mb-3" style={{ fontSize: 13 }}>
                  <i className="bi bi-calendar-check me-1" />Find doctors &amp; book
                </Link>
              )}
              {selected.external && (
                <div style={{ background: 'rgba(14,116,144,0.06)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--gray-600)', marginBottom: 16 }}>
                  <i className="bi bi-info-circle me-1" style={{ color: '#0E7490' }} />
                  This hospital isn’t on MediBook yet. You can still rate it to help others.
                </div>
              )}

              {/* Review form */}
              <div className="detail-section">
                <div className="detail-section-title"><i className="bi bi-chat-heart me-1" />Your Opinion</div>
                {!user ? (
                  <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    <Link to="/login" style={{ fontWeight: 700 }}>Sign in</Link> to rate this hospital.
                  </p>
                ) : (
                  <form onSubmit={submitReview}>
                    <div className="d-flex align-items-center gap-1 mb-2" role="radiogroup" aria-label="Star rating">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const val = i + 1
                        const active = (hoverRating || rating) >= val
                        return (
                          <button key={val} type="button" className="star-btn" aria-label={`${val} star`}
                            onClick={() => setRating(val)} onMouseEnter={() => setHoverRating(val)} onMouseLeave={() => setHoverRating(0)}>
                            <i className={`bi ${active ? 'bi-star-fill' : 'bi-star'}`} style={{ color: active ? '#F59E0B' : 'var(--gray-300)', fontSize: 24 }} />
                          </button>
                        )
                      })}
                      {rating > 0 && <span style={{ fontSize: 13, color: 'var(--gray-500)', marginLeft: 6 }}>{rating}/5</span>}
                    </div>
                    <textarea className="form-input-custom" rows={3} maxLength={1000}
                      placeholder="Share your experience (optional)" value={comment}
                      onChange={e => setComment(e.target.value)} style={{ resize: 'vertical', minHeight: 70 }} />
                    <button type="submit" className="btn-primary-custom w-100 justify-content-center mt-2" disabled={submitting} style={{ fontSize: 13 }}>
                      {submitting
                        ? <><span className="spinner-custom" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving…</>
                        : <><i className="bi bi-send me-1" />{myReview ? 'Update review' : 'Submit review'}</>}
                    </button>
                  </form>
                )}
              </div>

              {/* Reviews list */}
              <div className="detail-section">
                <div className="detail-section-title">Recent Reviews</div>
                {loadingDetail ? (
                  <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading…</p>
                ) : detailReviews.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No reviews yet. Be the first!</p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {detailReviews.map(r => (
                      <div key={r.id} style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: 10 }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong style={{ fontSize: 13 }}>{r.reviewer_name || 'Anonymous'}</strong>
                          <Stars value={r.rating} size={12} />
                        </div>
                        {r.comment && <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: '4px 0 0', lineHeight: 1.6 }}>{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
