import { supabase } from '../lib/supabase'

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100)
}
export function paiseToRupees(paise) {
  return (Number(paise) / 100).toFixed(2)
}

/** Lazily load the Razorpay checkout script (also referenced in index.html). */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load payment gateway.')))
      return
    }
    const s = document.createElement('script')
    s.src = CHECKOUT_SRC
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load payment gateway.'))
    document.body.appendChild(s)
  })
}

// ─────────────────────────────────────────────
// Payment record
// ─────────────────────────────────────────────
export async function getPaymentForAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Doctor: request payment of `amountRupees` at consultation close. */
export async function requestAppointmentPayment(appointmentId, amountRupees) {
  const paise = rupeesToPaise(amountRupees)
  if (!Number.isFinite(paise) || paise < 100) {
    throw new Error('Enter a valid amount (at least ₹1).')
  }
  const { data, error } = await supabase.rpc('request_appointment_payment', {
    p_appointment_id: appointmentId,
    p_amount_paise: paise,
  })
  if (error) throw new Error(error.message || 'Could not request payment.')
  return data
}

/** Patient: confirm an offline (cash) payment → completes the appointment. */
export async function payOffline(appointmentId) {
  const { data, error } = await supabase.rpc('pay_appointment_offline', {
    p_appointment_id: appointmentId,
  })
  if (error) throw new Error(error.message || 'Could not record the payment.')
  return data
}

// ─────────────────────────────────────────────
// Online (Razorpay)
// ─────────────────────────────────────────────

/**
 * Build the Authorization header from the *current* session token.
 *
 * We attach the user's access token explicitly rather than relying on
 * supabase.functions.invoke to pick it up implicitly. On a freshly loaded
 * production build the functions client's auth header can lag behind the
 * restored session, which makes the edge function see no user and return
 * "Authentication required." Fetching the session here guarantees a valid
 * token is sent (and refreshes it if it's about to expire).
 */
async function authHeaders() {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    // Try a refresh in case the token just expired.
    const refreshed = await supabase.auth.refreshSession()
    session = refreshed.data?.session
  }
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again and retry the payment.')
  }
  return { Authorization: `Bearer ${session.access_token}` }
}

async function createOrder(appointmentId) {
  const headers = await authHeaders()
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
    body: { appointmentId },
    headers,
  })
  if (error) {
    const msg = (await error?.context?.json?.().catch(() => null))?.error
    throw new Error(msg || error.message || 'Could not start the payment.')
  }
  if (data?.error) throw new Error(data.error)
  return data // { key_id, order_id, amount, currency }
}

async function verifyPayment(payload) {
  const headers = await authHeaders()
  const { data, error } = await supabase.functions.invoke('razorpay-verify-payment', {
    body: payload,
    headers,
  })
  if (error) {
    const msg = (await error?.context?.json?.().catch(() => null))?.error
    throw new Error(msg || error.message || 'Payment verification failed.')
  }
  if (!data?.verified) throw new Error(data?.error || 'Payment could not be verified.')
  return data // { verified, receipt_number, appointment_id }
}

/**
 * Patient: pay online via Razorpay Standard Checkout.
 *
 * Orchestrates: create order → open Razorpay modal → verify signature on the
 * server → (only then) the appointment is completed. Resolves with the verify
 * result (incl. receipt_number) on success; rejects on failure/cancel.
 *
 * @param {object} opts
 * @param {number} opts.appointmentId
 * @param {object} opts.profile   - { name, email, phone } for prefill
 * @param {string} opts.doctorName
 */
export async function payOnline({ appointmentId, profile = {}, doctorName = '' }) {
  await loadRazorpayScript()
  const order = await createOrder(appointmentId)
  const keyId = RAZORPAY_KEY_ID || order.key_id
  if (!keyId) throw new Error('Payment gateway key is not configured.')

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'MediBook',
      description: doctorName ? `Consultation — Dr. ${doctorName}` : 'Consultation payment',
      prefill: {
        name: profile.name || '',
        email: profile.email || '',
        contact: profile.phone || '',
      },
      theme: { color: '#0077B6' },
      handler: async (response) => {
        try {
          const result = await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          resolve(result)
        } catch (err) {
          reject(err)
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    })

    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp?.error?.description || 'Payment failed. Please try again.'))
    })

    rzp.open()
  })
}
