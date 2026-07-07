import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// Peer-to-peer "Smart Swap" slot exchange service.
// See supabase/migrations/033_smart_swap.sql.
// ─────────────────────────────────────────────

/** Offer up one of my active, future, unpaid appointments for swap. */
export async function createSwapOffer(appointmentId, note = '') {
  const { data, error } = await supabase.rpc('create_swap_offer', {
    p_appointment_id: appointmentId,
    p_note: note || null,
  })
  if (error) throw new Error(error.message || 'Could not create the swap offer.')
  return data
}

/** Withdraw one of my OPEN offers. */
export async function cancelSwapOffer(offerId) {
  const { data, error } = await supabase.rpc('cancel_swap_offer', { p_offer_id: offerId })
  if (error) throw new Error(error.message || 'Could not cancel the offer.')
  return data
}

/**
 * Anonymized offers I'm eligible to accept (doctors I hold a later slot with).
 * Each row includes my suggested "give-up" appointment.
 */
export async function listSwapOffers() {
  const { data, error } = await supabase.rpc('list_swap_offers')
  if (error) throw new Error(error.message || 'Could not load swap offers.')
  return (data ?? []).map(r => ({
    offerId: r.offer_id,
    doctorId: r.doctor_id,
    doctorName: r.doctor_name,
    specialization: r.specialization,
    offerDate: r.offer_date,
    offerSlotStart: r.offer_slot_start,
    discountPercent: r.discount_percent,
    note: r.note,
    myAppointmentId: r.my_appointment_id,
    myAppointmentDate: r.my_appointment_date,
    mySlotStart: r.my_slot_start,
  }))
}

/** Accept an offer, swapping my (later) appointment for the earlier offered slot. */
export async function acceptSwapOffer(offerId, myAppointmentId) {
  const { data, error } = await supabase.rpc('accept_swap_offer', {
    p_offer_id: offerId,
    p_taker_appointment_id: myAppointmentId,
  })
  if (error) {
    if (error.code === 'P0002' || /no longer available|changed hands/i.test(error.message || '')) {
      throw new Error('This offer was just taken or changed. Please refresh.')
    }
    throw new Error(error.message || 'Could not complete the swap.')
  }
  return data
}

/** My own swap offers (any status), newest first — via RLS (owner-readable). */
export async function getMySwapOffers() {
  const { data, error } = await supabase
    .from('slot_swap_offers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
