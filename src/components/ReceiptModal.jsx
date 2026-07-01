import { createPortal } from 'react-dom'
import { paiseToRupees } from '../services/payments'

/**
 * Printable payment receipt.
 *
 * Rendered via a portal on <body> so that print CSS can hide the whole app
 * (#root) and show only the receipt — giving a clean single page instead of
 * the app's content spilling across several pages.
 *
 * Props:
 * - payment: payments row (amount_paise, method, status, receipt_number, paid_at, razorpay_payment_id)
 * - doctorName, patientName
 * - appointment: { appointment_date, slot_start_time }
 * - onClose
 */
export default function ReceiptModal({ payment, doctorName, patientName, appointment, onClose }) {
  if (!payment) return null

  const visit = appointment?.appointment_date
    ? `${new Date(appointment.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      + (appointment.slot_start_time ? ` · ${appointment.slot_start_time.substring(0, 5)}` : '')
    : '—'

  const content = (
    <div className="receipt-portal">
      <div className="overlay" onClick={onClose} />
      <div className="receipt-card">
        <div id="receipt-printable">
          {/* Header */}
          <div className="receipt-head">
            <div className="receipt-brand">
              <i className="bi bi-heart-pulse-fill" />
              <span>Medi<span style={{ color: 'var(--primary)' }}>Book</span></span>
            </div>
            <div className="receipt-sub">Payment Receipt</div>
            <span className="receipt-paid-badge"><i className="bi bi-check-circle-fill" /> PAID</span>
          </div>

          {/* Meta */}
          <div className="receipt-rows">
            <Row label="Receipt No." value={payment.receipt_number || '—'} strong />
            <Row label="Patient" value={patientName || '—'} />
            <Row label="Doctor" value={doctorName ? `Dr. ${doctorName}` : '—'} />
            <Row label="Visit" value={visit} />
            <Row label="Description" value="Consultation fee" />
            <Row label="Method" value={payment.method === 'OFFLINE' ? 'Cash / Offline' : 'Online (Razorpay)'} />
            {payment.razorpay_payment_id && <Row label="Transaction ID" value={payment.razorpay_payment_id} />}
            <Row label="Paid on" value={payment.paid_at ? new Date(payment.paid_at).toLocaleString('en-IN') : '—'} />
          </div>

          {/* Total */}
          <div className="receipt-total">
            <span>Total Paid</span>
            <span className="receipt-amount">₹{paiseToRupees(payment.amount_paise)}</span>
          </div>

          <div className="receipt-foot">
            This is a computer-generated receipt and does not require a signature.<br />
            Thank you for choosing MediBook.
          </div>
        </div>

        <div className="d-flex gap-2 px-4 pb-4 receipt-actions">
          <button className="btn-ghost flex-fill" onClick={onClose}>Close</button>
          <button className="btn-primary-custom flex-fill" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" />Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function Row({ label, value, strong }) {
  return (
    <div className="receipt-row">
      <span className="receipt-row-label">{label}</span>
      <span className="receipt-row-value" style={strong ? { fontWeight: 700 } : undefined}>{value}</span>
    </div>
  )
}
