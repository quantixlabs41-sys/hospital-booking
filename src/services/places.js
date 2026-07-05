// places.js
// Discovers hospitals from OpenStreetMap so the map/search can show EVERY
// hospital — not just the ones registered on MediBook.
//
//   • Nearby hospitals   → Overpass API (amenity=hospital / healthcare=hospital)
//   • Text search        → Nominatim search API
//
// No API key required. Both are public OSM services; calls fail OPEN (return
// an empty list) so a network/rate-limit issue never breaks the page.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Canonical place key for an OSM element, e.g. 'osm:node/12345'.
 */
export function osmPlaceKey(type, id) {
  return `osm:${type}/${id}`
}

function tagsToCity(tags = {}) {
  return tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:suburb'] || null
}

function normalizeExternal({ type, id, lat, lon, tags = {} }) {
  if (lat == null || lon == null) return null
  const name = tags.name || tags['name:en'] || 'Unnamed hospital'
  return {
    placeKey: osmPlaceKey(type, id),
    external: true,
    name,
    city: tagsToCity(tags),
    state: tags['addr:state'] || null,
    address: tags['addr:full'] || [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || null,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    latitude: parseFloat(lat),
    longitude: parseFloat(lon),
    avg_rating: 0,
    review_count: 0,
  }
}

/**
 * Fetch hospitals near a coordinate via Overpass.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters (default 6000 = 6km)
 * @param {number} limit
 * @returns {Promise<Array>} external place objects
 */
export async function getHospitalsNear(lat, lng, radiusMeters = 6000, limit = 60) {
  try {
    const r = Math.min(Math.max(radiusMeters, 500), 25000)
    const query = `[out:json][timeout:20];
      (
        node["amenity"="hospital"](around:${r},${lat},${lng});
        way["amenity"="hospital"](around:${r},${lat},${lng});
        node["healthcare"="hospital"](around:${r},${lat},${lng});
        way["healthcare"="hospital"](around:${r},${lat},${lng});
      );
      out center ${limit};`

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const json = await res.json()

    return (json.elements ?? [])
      .map(el => normalizeExternal({
        type: el.type,
        id: el.id,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        tags: el.tags,
      }))
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Text search for hospitals via Nominatim.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>} external place objects
 */
export async function searchExternalHospitals(query, limit = 12) {
  const q = (query || '').trim()
  if (q.length < 3) return []
  try {
    const params = new URLSearchParams({
      q: /hospital|clinic|medical/i.test(q) ? q : `${q} hospital`,
      format: 'json',
      addressdetails: '1',
      extratags: '1',
      limit: String(limit),
    })
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const rows = await res.json()

    return (rows ?? [])
      .map(row => normalizeExternal({
        type: row.osm_type,
        id: row.osm_id,
        lat: row.lat,
        lon: row.lon,
        tags: {
          name: row.display_name?.split(',')[0],
          'addr:city': row.address?.city || row.address?.town || row.address?.village,
          'addr:state': row.address?.state,
          'addr:full': row.display_name,
          phone: row.extratags?.phone,
          website: row.extratags?.website,
        },
      }))
      .filter(Boolean)
  } catch {
    return []
  }
}
