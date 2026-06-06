/**
 * WhatsApp delivery status badge for appointment cards.
 */
export default function WhatsAppStatusBadge({ status }) {
  if (!status) return null

  const config = {
    SENT: { icon: 'bi-whatsapp', color: '#25D366', bg: 'rgba(37,211,102,0.1)', label: 'Sent ✓' },
    PENDING: { icon: 'bi-whatsapp', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Pending' },
    FAILED: { icon: 'bi-whatsapp', color: '#EF233C', bg: 'rgba(239,35,60,0.1)', label: 'Failed ✗' },
    NOT_ENABLED: { icon: 'bi-whatsapp', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', label: 'Not enabled' }
  }

  const { icon, color, bg, label } = config[status] || config.NOT_ENABLED

  return (
    <span
      className="whatsapp-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: color,
        border: `1px solid ${color}25`
      }}
      title={`WhatsApp: ${label}`}
    >
      <i className={`bi ${icon}`} style={{ fontSize: 12 }} />
      {label}
    </span>
  )
}
