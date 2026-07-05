import { supabase } from '../lib/supabase'
import { sanitizeInput } from '../security/sanitize'

// ─────────────────────────────────────────────
// Hospital Reviews, Ratings & Ranking
//
// A "place" is any hospital a user can review — either a MediBook hospital
// (place_key = 'db:<id>') or an external OpenStreetMap hospital
// (place_key = 'osm:<type>/<id>'). This service powers the /hospitals page:
// map ratings, the "Top Rated" ranking, and the review flow.
// ─────────────────────────────────────────────

const PUBLIC_HOSPITAL_SELECT =
  'id, name, type, address, city, state, pincode, latitude, longitude, phone, website, summary_text, cover_photo_url, is_verified'

/** Canonical place key for a MediBook hospital. */
export const dbPlaceKey = (id) => `db:${id}`

/**
 * Active MediBook hospitals merged with their rating aggregates.
 * Each result is a normalized "place" (external:false).
 */
export async function getHospitalsWithRatings() {
  const [hospitalsRes, statsRes] = await Promise.all([
    supabase
      .from('hospitals')
      .select(PUBLIC_HOSPITAL_SELECT)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('place_review_stats')
      .select('hospital_id, avg_rating, review_count')
      .not('hospital_id', 'is', null),
  ])

  if (hospitalsRes.error) throw hospitalsRes.error
  const statsMap = new Map((statsRes.data ?? []).map(s => [s.hospital_id, s]))

  return (hospitalsRes.data ?? []).map(h => {
    const stat = statsMap.get(h.id)
    return {
      ...h,
      placeKey: dbPlaceKey(h.id),
      external: false,
      latitude: h.latitude != null ? parseFloat(h.latitude) : null,
      longitude: h.longitude != null ? parseFloat(h.longitude) : null,
      avg_rating: stat ? Number(stat.avg_rating) : 0,
      review_count: stat ? stat.review_count : 0,
    }
  })
}

/**
 * External (non-MediBook) places that have at least one review, so they can
 * be ranked alongside our hospitals even if not currently on the map.
 */
export async function getReviewedExternalPlaces() {
  const { data, error } = await supabase
    .from('place_review_stats')
    .select('place_key, avg_rating, review_count, place_name, place_city, place_lat, place_lng')
    .is('hospital_id', null)
  if (error) return []
  return (data ?? []).map(s => ({
    placeKey: s.place_key,
    external: true,
    name: s.place_name || 'Hospital',
    city: s.place_city || null,
    state: null,
    latitude: s.place_lat != null ? parseFloat(s.place_lat) : null,
    longitude: s.place_lng != null ? parseFloat(s.place_lng) : null,
    cover_photo_url: null,
    is_verified: false,
    avg_rating: Number(s.avg_rating),
    review_count: s.review_count,
  }))
}

// ─────────────────────────────────────────────
// Ranking algorithm
// ─────────────────────────────────────────────

/**
 * Bayesian-weighted ranking based on user feedback & rating.
 *
 * A plain average unfairly favours a hospital with a single 5★ review over
 * one with hundreds of 4.8★ reviews. We use the Bayesian average (a.k.a.
 * "True Bayesian estimate", the same idea IMDb's Top 250 uses):
 *
 *     score = (v / (v + m)) * R  +  (m / (v + m)) * C
 *
 *   R = the place's own average rating
 *   v = the place's number of reviews
 *   C = the mean rating across all reviewed places (the "prior")
 *   m = smoothing weight — how many reviews before we trust R over C
 *
 * Places with few reviews are pulled toward the global mean C; places with
 * many consistent reviews rise to the top. Ties break on review volume.
 *
 * @param {Array} places  normalized places with { avg_rating, review_count }
 * @param {Object} [opts]
 * @param {number} [opts.smoothing=5]  the `m` weight
 * @returns {Array} same places, each with `rank_score`, sorted high→low
 */
export function rankPlaces(places, { smoothing = 5 } = {}) {
  const rated = places.filter(p => p.review_count > 0)

  // Global mean rating C, weighted by review volume. Fallback to 3.5.
  const totalReviews = rated.reduce((s, p) => s + p.review_count, 0)
  const C = totalReviews > 0
    ? rated.reduce((s, p) => s + p.avg_rating * p.review_count, 0) / totalReviews
    : 3.5
  const m = smoothing

  return places
    .map(p => {
      const v = p.review_count
      const R = p.avg_rating
      const score = v > 0 ? (v / (v + m)) * R + (m / (v + m)) * C : 0
      return { ...p, rank_score: score }
    })
    .sort((a, b) =>
      b.rank_score - a.rank_score ||
      b.review_count - a.review_count ||
      a.name.localeCompare(b.name)
    )
}

/**
 * Fully-ranked list of hospitals — MediBook hospitals + reviewed external
 * places — ordered best→worst by the ranking algorithm.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit]
 * @param {number} [opts.minReviews=1]  only rank places with ≥ this many reviews
 */
export async function getRankedHospitals({ limit, minReviews = 1 } = {}) {
  const [ours, external] = await Promise.all([
    getHospitalsWithRatings(),
    getReviewedExternalPlaces(),
  ])
  // Avoid double-counting: external stats never share a place_key with ours.
  const combined = [...ours, ...external].filter(p => p.review_count >= minReviews)
  const ranked = rankPlaces(combined)
  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked
}

// ─────────────────────────────────────────────
// Reviews CRUD (place-based)
// ─────────────────────────────────────────────

/**
 * List reviews for a place, newest first.
 */
export async function getPlaceReviews(placeKey, limit = 20) {
  const { data, error } = await supabase
    .from('hospital_reviews')
    .select('id, user_id, reviewer_name, rating, comment, created_at, updated_at')
    .eq('place_key', placeKey)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * The current user's review for a place, or null.
 */
export async function getMyPlaceReview(placeKey, userId) {
  if (!userId || !placeKey) return null
  const { data, error } = await supabase
    .from('hospital_reviews')
    .select('id, rating, comment')
    .eq('place_key', placeKey)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Create or update the current user's review for a place (MediBook or external).
 * Upserts on the (user_id, place_key) unique constraint.
 *
 * @param {Object} params
 * @param {Object} params.place   normalized place object (from getHospitalsWithRatings / places.js)
 * @param {string} params.userId
 * @param {number} params.rating  1–5
 * @param {string} [params.comment]
 * @param {string} [params.reviewerName]
 */
export async function upsertPlaceReview({ place, userId, rating, comment, reviewerName }) {
  const r = Math.round(Number(rating))
  if (!place?.placeKey) throw new Error('A hospital must be selected.')
  if (!userId) throw new Error('You must be signed in to leave a review.')
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new Error('Please choose a rating from 1 to 5 stars.')

  const cleanComment = comment ? sanitizeInput(comment).slice(0, 1000) : null
  const cleanName = reviewerName ? sanitizeInput(reviewerName).slice(0, 100) : null

  const row = {
    user_id: userId,
    place_key: place.placeKey,
    reviewer_name: cleanName,
    rating: r,
    comment: cleanComment,
  }

  if (place.external) {
    // External hospital — no hospitals row; snapshot its metadata.
    row.hospital_id = null
    row.place_name = place.name ? sanitizeInput(place.name).slice(0, 200) : null
    row.place_city = place.city ? sanitizeInput(place.city).slice(0, 120) : null
    row.place_lat = place.latitude ?? null
    row.place_lng = place.longitude ?? null
  } else {
    row.hospital_id = place.id
  }

  const { data, error } = await supabase
    .from('hospital_reviews')
    .upsert(row, { onConflict: 'user_id,place_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a review (author or admin, enforced by RLS).
 */
export async function deleteReview(reviewId) {
  const { error } = await supabase.from('hospital_reviews').delete().eq('id', reviewId)
  if (error) throw error
}
