import { useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────
// HospitalsMap — multi-pin map of hospitals (MediBook + external OSM).
// Leaflet is loaded via CDN in index.html (global window.L).
// ─────────────────────────────────────────────

const DEFAULT_CENTER = [20.5937, 78.9629] // India
const DEFAULT_ZOOM = 5

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

/**
 * @param {Object} props
 * @param {Array} props.hospitals - places with numeric latitude/longitude + placeKey + external flag
 * @param {{lat:number,lng:number}|null} props.userLocation - optional "you are here"
 * @param {string|null} props.focusKey - placeKey to fly to / open popup
 * @param {(place:object)=>void} props.onSelect - marker click callback
 * @param {string} props.height
 */
export default function HospitalsMap({
  hospitals = [],
  userLocation = null,
  focusKey = null,
  onSelect,
  height = '440px',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map()) // placeKey -> marker
  const userMarkerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const leafletReady = useCallback(() => typeof window !== 'undefined' && window.L, [])

  // Initialise once.
  useEffect(() => {
    if (!containerRef.current || !leafletReady() || mapRef.current) return
    const L = window.L
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = new Map()
      userMarkerRef.current = null
    }
  }, [leafletReady])

  // Build a divIcon for a place (blue = MediBook, teal = external).
  const makeIcon = useCallback((external) => {
    const L = window.L
    const cls = external ? 'hospital-marker-pin external' : 'hospital-marker-pin'
    const icon = external ? 'bi-geo-alt-fill' : 'bi-hospital-fill'
    return L.divIcon({
      className: 'hospital-map-marker',
      html: `<div class="${cls}"><i class="bi ${icon}"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -36],
    })
  }, [])

  // Sync markers whenever the list changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !leafletReady()) return
    const L = window.L

    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = new Map()

    const points = []
    hospitals.forEach(h => {
      if (h.latitude == null || h.longitude == null) return
      if (Number.isNaN(h.latitude) || Number.isNaN(h.longitude)) return

      const marker = L.marker([h.latitude, h.longitude], { icon: makeIcon(h.external) }).addTo(map)
      const ratingLine = h.review_count > 0
        ? `<div style="font-size:12px;color:#F59E0B;margin-top:2px;">★ ${Number(h.avg_rating).toFixed(1)} <span style="color:#888;">(${h.review_count})</span></div>`
        : `<div style="font-size:12px;color:#999;margin-top:2px;">No reviews yet</div>`
      const badge = h.external
        ? `<span style="font-size:10px;font-weight:700;color:#0E7490;background:rgba(14,116,144,.1);padding:1px 6px;border-radius:8px;">Not on MediBook</span>`
        : `<span style="font-size:10px;font-weight:700;color:#0077B6;background:rgba(0,119,182,.1);padding:1px 6px;border-radius:8px;">MediBook</span>`
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:170px;">
          <strong style="font-size:14px;color:#1a1a2e;">${escapeHtml(h.name)}</strong>
          <div style="font-size:12px;color:#666;">${escapeHtml([h.city, h.state].filter(Boolean).join(', '))}</div>
          ${ratingLine}
          <div style="margin-top:6px;">${badge}</div>
        </div>
      `)
      marker.on('click', () => onSelectRef.current?.(h))
      markersRef.current.set(h.placeKey, marker)
      points.push([h.latitude, h.longitude])
    })

    if (userLocation) points.push([userLocation.lat, userLocation.lng])
    if (points.length === 1) {
      map.setView(points[0], 13)
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
    }
  }, [hospitals, leafletReady, makeIcon]) // eslint-disable-line react-hooks/exhaustive-deps

  // "You are here" marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !leafletReady()) return
    const L = window.L

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }
      return
    }

    const userIcon = L.divIcon({
      className: 'hospital-map-marker',
      html: `<div class="user-location-pin"><span></span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<strong>You are here</strong>')
    }
    map.setView([userLocation.lat, userLocation.lng], 12, { animate: true })
  }, [userLocation, leafletReady])

  // Fly to a focused place and open its popup.
  useEffect(() => {
    const map = mapRef.current
    if (!map || focusKey == null) return
    const marker = markersRef.current.get(focusKey)
    if (marker) {
      map.flyTo(marker.getLatLng(), 15, { duration: 0.6 })
      marker.openPopup()
    }
  }, [focusKey])

  if (!leafletReady()) {
    return (
      <div className="hospital-map-fallback" style={{ height }}>
        <i className="bi bi-geo-alt" style={{ fontSize: 32, color: 'var(--gray-300)' }} />
        <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: '8px 0 0' }}>Map loading…</p>
      </div>
    )
  }

  return (
    <div className="hospital-map-wrapper">
      <div ref={containerRef} className="hospital-map-container" style={{ height, borderRadius: 12 }} />
    </div>
  )
}
