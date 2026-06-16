import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer style={{
      background: 'var(--dark)',
      color: 'rgba(255,255,255,0.7)',
      padding: '60px 0 30px',
      marginTop: 'auto'
    }}>
      <div className="container">
        <div className="row g-4">
          {/* Brand */}
          <div className="col-lg-4 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-heart-pulse-fill" style={{ fontSize: 28, color: 'var(--primary-light)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'white' }}>
                Medi<span style={{ color: 'var(--primary-light)' }}>Book</span>
              </span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 300 }}>
              Your trusted platform for hassle-free hospital appointment booking. Find the right doctor, book instantly, and take control of your health.
            </p>
            <div className="d-flex gap-3 mt-3">
              {['facebook', 'twitter', 'instagram', 'linkedin'].map(social => (
                <span
                  key={social}
                  role="link"
                  aria-disabled="true"
                  aria-label={`${social} (coming soon)`}
                  className="footer-social-icon"
                >
                  <i className={`bi bi-${social}`} />
                </span>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-lg-2 col-md-6">
            <h6 style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
              Quick Links
            </h6>
            <div className="d-flex flex-column gap-2">
              {[
                { to: '/', label: 'Home' },
                { to: '/doctors', label: 'Find Doctors' },
                { to: '/login', label: 'Login' },
                { to: '/register', label: 'Register' },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecoration: 'none', transition: 'var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-light)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Specializations */}
          <div className="col-lg-3 col-md-6">
            <h6 style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
              Specializations
            </h6>
            <div className="d-flex flex-column gap-2">
              {['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dermatology'].map(spec => (
                <span key={spec} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{spec}</span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="col-lg-3 col-md-6">
            <h6 style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
              Contact Us
            </h6>
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-start gap-3">
                <i className="bi bi-geo-alt" style={{ color: 'var(--primary-light)', fontSize: 18, marginTop: 2 }} />
                <span style={{ fontSize: 14 }}>123 Medical Center Drive, Health City, HC 10001</span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-telephone" style={{ color: 'var(--primary-light)', fontSize: 16 }} />
                <span style={{ fontSize: 14 }}>+1 (555) 123-4567</span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-envelope" style={{ color: 'var(--primary-light)', fontSize: 16 }} />
                <span style={{ fontSize: 14 }}>support@medibook.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider + Copyright */}
        <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '40px 0 20px' }} />
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <p style={{ fontSize: 13, margin: 0, color: 'rgba(255,255,255,0.4)' }}>
            © {year} MediBook. All rights reserved.
          </p>
          <div className="d-flex gap-4">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(item => (
              <span
                key={item}
                role="link"
                aria-disabled="true"
                className="footer-policy-link"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
