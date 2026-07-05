import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ContactSupportSection from '../components/ContactSupportSection'
import { SPECIALIZATIONS } from '../data/specializations'

const STEPS = [
  { icon: 'bi-search', num: '01', title: 'Search Doctor', desc: 'Browse our network of qualified doctors by specialization, name, or department.' },
  { icon: 'bi-calendar-check', num: '02', title: 'Book Appointment', desc: 'Pick a convenient date and time slot that works for your schedule.' },
  { icon: 'bi-check-circle', num: '03', title: 'Get Confirmation', desc: 'Receive instant confirmation via email and SMS with appointment details.' },
]

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/doctors?search=${encodeURIComponent(searchQuery)}`)
    } else {
      navigate('/doctors')
    }
  }

  return (
    <div>
      <Navbar />

      {/* ── Hero Section ── */}
      <section className="hero-section">
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="row align-items-center">
            <div className="col-lg-7">
              <div className="section-badge" style={{ background: 'rgba(0,180,216,0.15)', color: 'var(--primary-light)' }}>
                #1 Hospital Booking Platform
              </div>
              <h1 className="hero-title">
                Book Your Doctor<br />
                <span style={{ color: 'var(--primary-light)' }}>Appointment</span> Online
              </h1>
              <p className="hero-subtitle">
                Skip the queues and book appointments with top specialists instantly.
                Real-time availability, smart reminders, and seamless healthcare experience.
              </p>

              {/* Search Bar */}
              <form onSubmit={handleSearch}>
                <div className="hero-search-bar">
                  <i className="bi bi-search" style={{ color: 'var(--gray-400)', fontSize: 20 }} />
                  <input
                    id="hero-search"
                    type="text"
                    placeholder="Search doctors, specializations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="btn-primary-custom" style={{ padding: '12px 28px', borderRadius: 'var(--radius-lg)' }}>
                    Search
                  </button>
                </div>
              </form>

              {/* Stats */}
              <div className="d-flex gap-5 mt-5">
                {[
                  { value: '200+', label: 'Expert Doctors' },
                  { value: '50K+', label: 'Happy Patients' },
                  { value: '15+', label: 'Specializations' },
                ].map(stat => (
                  <div key={stat.label}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: '80px 0', background: 'white' }}>
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-badge">Simple Process</div>
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Book your appointment in 3 easy steps</p>
          </div>

          <div className="row g-4 stagger-children">
            {STEPS.map((step, i) => (
              <div key={i} className="col-md-4">
                <div className="card-custom p-4 text-center h-100" style={{ border: 'none' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: '0 8px 24px rgba(0,119,182,0.3)'
                  }}>
                    <i className={`bi ${step.icon}`} style={{ fontSize: 28, color: 'white' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1 }}>
                    STEP {step.num}
                  </span>
                  <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: '10px 0 8px', color: 'var(--dark)' }}>
                    {step.title}
                  </h5>
                  <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Specializations ── */}
      <section style={{ padding: '80px 0', background: 'var(--gray-50)' }}>
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-badge">Our Experts</div>
            <h2 className="section-title">Browse by Specialization</h2>
            <p className="section-subtitle">Find the right specialist for your needs</p>
          </div>

          <div className="row g-3 stagger-children">
            {SPECIALIZATIONS.map((spec, i) => (
              <div key={i} className="col-6 col-md-3">
                <div
                  className="card-custom p-4 text-center cursor-pointer h-100"
                  onClick={() => navigate(`/specializations/${spec.slug}`)}
                  style={{ border: 'none' }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 'var(--radius-md)',
                    background: 'rgba(0,119,182,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px'
                  }}>
                    <i className={`bi ${spec.icon}`} style={{ fontSize: 24, color: 'var(--primary)' }} />
                  </div>
                  <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, margin: '0 0 4px', color: 'var(--dark)' }}>
                    {spec.name}
                  </h6>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>{spec.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hospital Finder entry (opens the /hospitals page) ── */}
      <section style={{ padding: '80px 0', background: 'white' }} aria-label="Find hospitals">
        <div className="container">
          <div
            className="hospital-finder-cta"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/hospitals')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/hospitals') } }}
          >
            <div className="hospital-finder-cta-inner">
              <div className="hospital-finder-icon">
                <i className="bi bi-geo-alt-fill" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="section-badge" style={{ background: 'rgba(0,180,216,0.15)', color: 'var(--primary-light)' }}>
                  Explore Hospitals
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 'clamp(1.5rem, 2.5vw, 2.2rem)', margin: '6px 0 10px' }}>
                  Find the Best Hospitals Near You
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.7, marginBottom: 20, maxWidth: 560 }}>
                  Open the interactive map to see every hospital around you — even ones not on MediBook —
                  read patient reviews, share your own opinion, and discover the top-ranked care.
                </p>
                <div className="d-flex flex-wrap gap-4 mb-3">
                  {[
                    { icon: 'bi-map', text: 'Every hospital on the map' },
                    { icon: 'bi-star-fill', text: 'Ranked by patient feedback' },
                    { icon: 'bi-search', text: 'Search beyond our network' },
                  ].map(f => (
                    <div key={f.text} className="d-flex align-items-center gap-2">
                      <i className={`bi ${f.icon}`} style={{ color: 'var(--primary-light)', fontSize: 16 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                <span className="btn-primary-custom" style={{ background: 'white', color: 'var(--primary)', pointerEvents: 'none' }}>
                  Open Hospital Finder <i className="bi bi-arrow-right ms-1" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '80px 0', background: 'white' }} aria-label="Patient testimonials">
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-badge">Testimonials</div>
            <h2 className="section-title">What Our Patients Say</h2>
            <p className="section-subtitle">Real experiences from people who trust MediBook</p>
          </div>

          <div className="row g-4 stagger-children">
            {[
              {
                name: 'Priya Sharma',
                role: 'Patient',
                rating: 5,
                text: 'MediBook made booking my cardiologist appointment so easy. I got timely reminders and the whole process was seamless. Highly recommended!',
                initial: 'PS',
                color: 'rgba(0,119,182,0.1)',
              },
              {
                name: 'Rahul Mehta',
                role: 'Patient',
                rating: 5,
                text: 'I love how I can see real-time availability of doctors. No more calling the hospital and waiting on hold. The interface is beautiful and intuitive.',
                initial: 'RM',
                color: 'rgba(45,198,83,0.1)',
              },
              {
                name: 'Anita Desai',
                role: 'Patient',
                rating: 4,
                text: 'The reminders feature is a game-changer. I never miss an appointment anymore. The doctors on this platform are all verified and professional.',
                initial: 'AD',
                color: 'rgba(249,199,79,0.15)',
              },
            ].map((testimonial, i) => (
              <div key={i} className="col-md-4">
                <div className="card-custom card-static p-4 h-100 d-flex flex-column">
                  {/* Stars */}
                  <div className="d-flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <i
                        key={s}
                        className={`bi ${s < testimonial.rating ? 'bi-star-fill' : 'bi-star'}`}
                        style={{ color: s < testimonial.rating ? '#F59E0B' : 'var(--gray-300)', fontSize: 14 }}
                      />
                    ))}
                  </div>
                  {/* Quote */}
                  <p style={{ color: 'var(--gray-600)', fontSize: 14, lineHeight: 1.8, flex: 1 }}>
                    "{testimonial.text}"
                  </p>
                  {/* Author */}
                  <div className="d-flex align-items-center gap-3 mt-3" style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, background: testimonial.color, color: 'var(--primary)' }}>
                      {testimonial.initial}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--dark)' }}>{testimonial.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="d-flex justify-content-center gap-5 mt-5 flex-wrap">
            {[
              { icon: 'bi-shield-check', text: 'SSL Encrypted' },
              { icon: 'bi-headset', text: '24/7 Support' },
              { icon: 'bi-patch-check', text: 'Verified Doctors' },
              { icon: 'bi-lock', text: 'HIPAA Compliant' },
            ].map((trust, i) => (
              <div key={i} className="d-flex align-items-center gap-2">
                <i className={`bi ${trust.icon}`} style={{ color: 'var(--primary)', fontSize: 18 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>{trust.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Doctors & Hospitals CTA ── */}
      <section style={{ padding: '80px 0', background: 'var(--gray-50)' }}>
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <div className="section-badge" style={{ background: 'rgba(45,198,83,0.1)', color: '#2DC653' }}>
                For Healthcare Professionals
              </div>
              <h2 className="section-title" style={{ textAlign: 'left' }}>
                Are you a Doctor or Hospital?
              </h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                Join MediBook's growing network of healthcare providers. List your practice,
                manage appointments, and reach thousands of patients looking for quality healthcare.
              </p>
              <div className="d-flex flex-column gap-3 mb-4">
                {[
                  { icon: 'bi-graph-up-arrow', text: 'Increase your patient reach and visibility' },
                  { icon: 'bi-calendar-check', text: 'Smart appointment management system' },
                  { icon: 'bi-shield-check', text: 'Verified and trusted platform' },
                  { icon: 'bi-cash-stack', text: 'No hidden fees — transparent pricing' },
                ].map(item => (
                  <div key={item.text} className="d-flex align-items-center gap-3">
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(0,119,182,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <i className={`bi ${item.icon}`} style={{ color: 'var(--primary)', fontSize: 16 }} />
                    </div>
                    <span style={{ color: 'var(--gray-600)', fontSize: 14, fontWeight: 500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <Link to="/collaborate" className="btn-primary-custom" id="collaborate-cta-btn">
                  Apply to Join <i className="bi bi-arrow-right ms-1" />
                </Link>
                <Link to="/collaborate/status" className="btn-outline-custom" id="collaborate-status-btn">
                  <i className="bi bi-clipboard2-pulse me-2" />Check Application Status
                </Link>
              </div>
            </div>
            <div className="col-lg-6">
              <div style={{
                background: 'linear-gradient(135deg, #03045E 0%, #0077B6 100%)',
                borderRadius: 'var(--radius-xl, 20px)',
                padding: '40px 32px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', width: 200, height: 200, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0,180,216,0.15) 0%, transparent 70%)',
                  top: -50, right: -30
                }} />
                <div className="d-flex flex-column gap-4" style={{ position: 'relative', zIndex: 2 }}>
                  {[
                    { icon: 'bi-person-badge', value: '200+', label: 'Doctors on Platform', color: 'rgba(0,180,216,0.15)' },
                    { icon: 'bi-hospital', value: '50+', label: 'Partner Hospitals', color: 'rgba(76,201,240,0.15)' },
                    { icon: 'bi-star-fill', value: '4.8/5', label: 'Average Rating', color: 'rgba(249,199,79,0.15)' },
                  ].map(stat => (
                    <div key={stat.label} className="d-flex align-items-center gap-3">
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: stat.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <i className={`bi ${stat.icon}`} style={{ color: 'white', fontSize: 20 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact, Feedback & Complaints ── */}
      <ContactSupportSection />

      {/* ── CTA ── */}
      <section style={{
        padding: '80px 0',
        background: 'linear-gradient(135deg, var(--dark) 0%, #0A2A6E 40%, var(--primary) 100%)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,180,216,0.15) 0%, transparent 70%)',
          top: -100, right: -50
        }} />
        <div className="container text-center" style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 800, color: 'white' }}>
            Ready to Book Your Appointment?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 12, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Join thousands of patients who trust MediBook for their healthcare needs.
          </p>
          <div className="d-flex gap-3 justify-content-center mt-4">
            <Link to="/register" className="btn-primary-custom" style={{ background: 'white', color: 'var(--primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              Get Started Free <i className="bi bi-arrow-right" />
            </Link>
            <Link to="/doctors" className="btn-outline-custom" style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>
              Browse Doctors
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
