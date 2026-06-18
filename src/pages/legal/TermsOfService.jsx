import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

export default function TermsOfService() {
  return (
    <div>
      <Navbar />
      <div style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '48px 24px 80px',
        fontFamily: 'var(--font-main)',
        color: 'var(--gray-800)',
        lineHeight: 1.8
      }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div className="section-badge">Legal</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
            fontWeight: 800,
            color: 'var(--dark)',
            marginTop: 12,
            lineHeight: 1.2
          }}>
            Terms of Service
          </h1>
          <p style={{ color: 'var(--gray-500)', marginTop: 12, fontSize: 15 }}>
            Last updated: June 18, 2026 · Version 1.0
          </p>
        </div>

        {/* Content */}
        <div className="legal-content" style={{ fontSize: 15 }}>
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>1. Acceptance of Terms</h2>
            <p>
              By accessing or using MediBook ("the Platform"), a hospital appointment booking service, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Platform.
            </p>
            <p style={{ marginTop: 12 }}>
              These Terms constitute a legally binding agreement between you ("User," "Patient," or "Doctor") and MediBook ("we," "us," or "our"). By creating an account, you confirm that you are at least 18 years of age, or have parental/guardian consent.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>2. Description of Service</h2>
            <p>MediBook provides an online platform that enables:</p>
            <ul style={listStyle}>
              <li>Patients to search for, view profiles of, and book appointments with registered doctors and healthcare professionals.</li>
              <li>Doctors to manage their availability, schedules, and patient appointments.</li>
              <li>Automated appointment reminders via email, SMS, and WhatsApp.</li>
              <li>A secure, centralized healthcare appointment management system.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              MediBook is a <strong>technology platform</strong> and does not provide medical advice, diagnosis, or treatment. We are not a healthcare provider.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>3. User Accounts</h2>
            <h3 style={subHeading}>3.1 Registration</h3>
            <p>
              To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration and maintain the accuracy of such information.
            </p>
            <h3 style={subHeading}>3.2 Account Security</h3>
            <p>You are responsible for:</p>
            <ul style={listStyle}>
              <li>Maintaining the confidentiality of your account credentials.</li>
              <li>All activities that occur under your account.</li>
              <li>Notifying us immediately of any unauthorized access or security breach.</li>
            </ul>
            <h3 style={subHeading}>3.3 Account Types</h3>
            <ul style={listStyle}>
              <li><strong>Patient Account:</strong> For individuals seeking to book medical appointments.</li>
              <li><strong>Doctor Account:</strong> For licensed medical practitioners registered to offer their services.</li>
              <li><strong>Admin Account:</strong> Platform administrators with elevated access for system management.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>4. Appointment Booking</h2>
            <h3 style={subHeading}>4.1 Booking Process</h3>
            <ul style={listStyle}>
              <li>Appointments are subject to doctor availability and confirmation.</li>
              <li>A booking confirmation does not guarantee a specific consultation outcome.</li>
              <li>Patients must arrive on time for scheduled appointments.</li>
            </ul>
            <h3 style={subHeading}>4.2 Cancellation Policy</h3>
            <ul style={listStyle}>
              <li>Patients may cancel or reschedule appointments through the Platform.</li>
              <li>Doctors may cancel appointments due to emergencies or unforeseen circumstances.</li>
              <li>Repeated no-shows may result in account restrictions.</li>
            </ul>
            <h3 style={subHeading}>4.3 Consultation Fees</h3>
            <p>
              Consultation fees displayed on the Platform are set by individual doctors. MediBook is not responsible for billing disputes between patients and doctors. Payment terms are governed separately by the healthcare provider.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>5. Doctor Obligations</h2>
            <p>Registered doctors agree to:</p>
            <ul style={listStyle}>
              <li>Maintain valid medical licenses and registrations as required by applicable law.</li>
              <li>Provide accurate professional information including qualifications, specializations, and fees.</li>
              <li>Manage their availability calendars promptly and accurately.</li>
              <li>Treat patients with professional courtesy and in accordance with medical ethics.</li>
              <li>Comply with all applicable healthcare regulations and standards.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>6. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul style={listStyle}>
              <li>Use the Platform for any unlawful purpose or in violation of these Terms.</li>
              <li>Impersonate any person or entity, or falsely state your affiliation.</li>
              <li>Attempt to gain unauthorized access to the Platform or other users' accounts.</li>
              <li>Interfere with the Platform's security features or proper functioning.</li>
              <li>Scrape, crawl, or use automated tools to extract data from the Platform.</li>
              <li>Upload malicious code, viruses, or harmful content.</li>
              <li>Harass, abuse, or harm other users or healthcare professionals.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>7. Intellectual Property</h2>
            <p>
              All content, trademarks, logos, and intellectual property on the Platform are owned by or licensed to MediBook. You may not reproduce, distribute, or create derivative works from any Platform content without prior written consent.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law:</p>
            <ul style={listStyle}>
              <li>MediBook is not liable for the quality of medical care provided by doctors on the Platform.</li>
              <li>We do not guarantee the accuracy of doctor profiles, qualifications, or availability.</li>
              <li>MediBook shall not be liable for any indirect, incidental, special, or consequential damages.</li>
              <li>Our total liability shall not exceed the amount paid by you to MediBook in the preceding 12 months.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>9. Privacy</h2>
            <p>
              Your use of the Platform is also governed by our{' '}
              <Link to="/privacy-policy" style={{ fontWeight: 600 }}>Privacy Policy</Link>, which details how we collect, use, and protect your personal information. By using the Platform, you consent to the practices described therein.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>10. Termination</h2>
            <ul style={listStyle}>
              <li>You may deactivate your account at any time through your profile settings.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
              <li>Upon termination, your right to use the Platform ceases immediately.</li>
              <li>Sections relating to liability, intellectual property, and dispute resolution survive termination.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>11. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be communicated via email or in-app notification. Your continued use of the Platform after such changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>12. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India, including the Information Technology Act, 2000 and the Consumer Protection Act, 2019. Any disputes shall be subject to the exclusive jurisdiction of the courts in the relevant jurisdiction.
            </p>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>13. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us:
            </p>
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              marginTop: 12,
              border: '1px solid var(--gray-200)'
            }}>
              <p style={{ margin: 0 }}><strong>MediBook Support</strong></p>
              <p style={{ margin: '4px 0 0', color: 'var(--gray-600)' }}>
                Email: support@medibook.health<br />
                Subject: Terms of Service Inquiry
              </p>
            </div>
          </section>
        </div>

        {/* Back link */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--gray-200)' }}>
          <Link to="/" style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-arrow-left" /> Back to MediBook
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}

const sectionHeading = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--dark)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '2px solid var(--gray-100)'
}

const subHeading = {
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--gray-700)',
  marginTop: 16,
  marginBottom: 8
}

const listStyle = {
  paddingLeft: 24,
  marginTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6
}
