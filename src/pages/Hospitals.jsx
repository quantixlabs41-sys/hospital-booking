import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import HospitalDiscovery from '../components/HospitalDiscovery'

export default function Hospitals() {
  return (
    <div>
      <Navbar />

      {/* Header */}
      <section style={{
        padding: '56px 0 40px',
        background: 'linear-gradient(135deg, #03045E 0%, #0077B6 100%)',
      }}>
        <div className="container text-center">
          <div className="section-badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
            <i className="bi bi-geo-alt me-1" />Hospital Finder
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', margin: '10px 0 8px' }}>
            Find &amp; Rate Hospitals Near You
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 620, margin: '0 auto' }}>
            Explore every hospital on the map — on MediBook or not — read patient reviews,
            and rank the best care by real feedback.
          </p>
        </div>
      </section>

      <main id="main-content" style={{ padding: '40px 0 80px', background: 'var(--gray-50)' }}>
        <div className="container">
          <HospitalDiscovery />
        </div>
      </main>

      <Footer />
    </div>
  )
}
