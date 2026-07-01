import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--gray-500)', marginTop: 12, fontSize: 15 }}>
            Last updated: June 18, 2026 · Version 1.0
          </p>
        </div>

        {/* Content */}
        <div className="legal-content" style={{ fontSize: 15 }}>
          {/* Introduction */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>1. Introduction</h2>
            <p>
              MediBook ("we," "us," or "our") is committed to protecting the privacy and security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our hospital appointment booking platform ("the Platform").
            </p>
            <p style={{ marginTop: 12 }}>
              This policy complies with the Information Technology Act, 2000 (India), the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and applicable data protection regulations.
            </p>
          </section>

          {/* Data We Collect */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>2. Information We Collect</h2>

            <h3 style={subHeading}>2.1 Information You Provide</h3>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Data Category</th>
                    <th style={thStyle}>Details</th>
                    <th style={thStyle}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}><strong>Identity Data</strong></td>
                    <td style={tdStyle}>Full name, date of birth, gender</td>
                    <td style={tdStyle}>Account creation, appointment management</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Contact Data</strong></td>
                    <td style={tdStyle}>Email address, phone number, address</td>
                    <td style={tdStyle}>Communications, appointment reminders</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Health Data</strong></td>
                    <td style={tdStyle}>Blood group, medical reason for appointment, emergency contact</td>
                    <td style={tdStyle}>Healthcare service facilitation</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Professional Data</strong> (Doctors)</td>
                    <td style={tdStyle}>Medical license, specialization, qualifications, experience, consultation fees</td>
                    <td style={tdStyle}>Doctor profile, patient discovery</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Account Data</strong></td>
                    <td style={tdStyle}>Email, encrypted password, avatar image</td>
                    <td style={tdStyle}>Authentication, profile display</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 style={subHeading}>2.2 Information Collected Automatically</h3>
            <ul style={listStyle}>
              <li><strong>Device Information:</strong> Browser type, operating system, screen resolution, device identifiers.</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, timestamps, interaction patterns.</li>
              <li><strong>Session Data:</strong> Login timestamps, session duration, IP addresses.</li>
              <li><strong>Cookies:</strong> Authentication tokens, session identifiers, and preference cookies (see Section 7).</li>
            </ul>
          </section>

          {/* How We Use Data */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>3. How We Use Your Information</h2>
            <ul style={listStyle}>
              <li><strong>Service Delivery:</strong> To facilitate appointment booking, doctor discovery, and schedule management.</li>
              <li><strong>Communications:</strong> To send appointment confirmations, reminders (email, in-app), and important service updates.</li>
              <li><strong>Security:</strong> To detect fraud, prevent unauthorized access, and maintain platform integrity.</li>
              <li><strong>Improvement:</strong> To analyze usage patterns and improve Platform features and user experience.</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes.</li>
              <li><strong>Consent Management:</strong> To track and honor your consent preferences for data processing and communications.</li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>4. Legal Basis for Processing</h2>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Legal Basis</th>
                    <th style={thStyle}>Processing Activity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}><strong>Consent</strong></td>
                    <td style={tdStyle}>Marketing emails, optional data sharing</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Contract</strong></td>
                    <td style={tdStyle}>Account creation, appointment booking, service delivery</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Legitimate Interest</strong></td>
                    <td style={tdStyle}>Security monitoring, fraud prevention, service improvement</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Legal Obligation</strong></td>
                    <td style={tdStyle}>Tax compliance, regulatory reporting, law enforcement requests</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Data Sharing */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>5. Data Sharing and Disclosure</h2>
            <h3 style={subHeading}>5.1 We Share Data With</h3>
            <ul style={listStyle}>
              <li><strong>Healthcare Providers:</strong> Your appointment details and relevant health information are shared with the doctor you book with.</li>
              <li><strong>Service Providers:</strong> Third-party services for email delivery and cloud hosting (Supabase).</li>
              <li><strong>Legal Authorities:</strong> When required by law, court order, or governmental regulation.</li>
            </ul>

            <h3 style={subHeading}>5.2 We Do NOT</h3>
            <ul style={listStyle}>
              <li>Sell your personal data to third parties.</li>
              <li>Share your health data for advertising purposes.</li>
              <li>Transfer data to countries without adequate data protection without safeguards.</li>
            </ul>
          </section>

          {/* Data Security */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>6. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul style={listStyle}>
              <li><strong>Encryption:</strong> TLS 1.3 for data in transit; AES-256 encryption for sensitive data at rest.</li>
              <li><strong>Authentication:</strong> Secure password hashing (bcrypt), session management with idle timeouts, and tamper detection.</li>
              <li><strong>Access Control:</strong> Row-Level Security (RLS) policies ensuring users can only access their own data.</li>
              <li><strong>Monitoring:</strong> Audit logging of security events, session activities, and administrative actions.</li>
              <li><strong>Infrastructure:</strong> Hosted on Supabase (backed by AWS) with automated backups and disaster recovery.</li>
            </ul>
            <p style={{
              marginTop: 16,
              padding: '14px 18px',
              background: 'rgba(0, 119, 182, 0.06)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '4px solid var(--primary)',
              fontSize: 14,
              color: 'var(--gray-700)'
            }}>
              While we strive to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but are committed to promptly addressing any security incidents.
            </p>
          </section>

          {/* Cookies */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>7. Cookies and Local Storage</h2>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Purpose</th>
                    <th style={thStyle}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}><strong>Essential</strong></td>
                    <td style={tdStyle}>Authentication tokens, session management</td>
                    <td style={tdStyle}>Session / 30 days</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Functional</strong></td>
                    <td style={tdStyle}>User preferences, language, theme</td>
                    <td style={tdStyle}>1 year</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}><strong>Security</strong></td>
                    <td style={tdStyle}>CSRF protection, tamper detection</td>
                    <td style={tdStyle}>Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12 }}>
              We do not use advertising or third-party tracking cookies.
            </p>
          </section>

          {/* Your Rights */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>8. Your Rights</h2>
            <p>You have the right to:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
              {[
                { icon: 'bi-eye', title: 'Access', desc: 'Request a copy of your personal data we hold.' },
                { icon: 'bi-pencil-square', title: 'Rectification', desc: 'Correct inaccurate or incomplete data via your profile settings.' },
                { icon: 'bi-trash3', title: 'Deletion', desc: 'Request deletion of your account and associated data.' },
                { icon: 'bi-download', title: 'Portability', desc: 'Receive your data in a structured, machine-readable format.' },
                { icon: 'bi-x-circle', title: 'Withdraw Consent', desc: 'Revoke previously granted consents at any time.' },
                { icon: 'bi-flag', title: 'Complaint', desc: 'Lodge a complaint with the relevant data protection authority.' },
              ].map(right => (
                <div key={right.title} style={{
                  padding: '16px 20px',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--gray-200)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <i className={`bi ${right.icon}`} style={{ color: 'var(--primary)', fontSize: 18 }} />
                    <strong style={{ fontSize: 14, color: 'var(--dark)' }}>{right.title}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-600)' }}>{right.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Data Retention */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>9. Data Retention</h2>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Data Type</th>
                    <th style={thStyle}>Retention Period</th>
                    <th style={thStyle}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}>Account Data</td>
                    <td style={tdStyle}>Until account deletion</td>
                    <td style={tdStyle}>Service provision</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Appointment Records</td>
                    <td style={tdStyle}>7 years after completion</td>
                    <td style={tdStyle}>Medical record-keeping, legal compliance</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Consent Records</td>
                    <td style={tdStyle}>Duration of account + 5 years</td>
                    <td style={tdStyle}>Regulatory compliance, audit trail</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Security Logs</td>
                    <td style={tdStyle}>1 year</td>
                    <td style={tdStyle}>Security monitoring, incident response</td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Communication Logs</td>
                    <td style={tdStyle}>90 days</td>
                    <td style={tdStyle}>Delivery verification, troubleshooting</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Children */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>10. Children's Privacy</h2>
            <p>
              MediBook is not intended for children under 18 years of age. We do not knowingly collect personal information from minors. Appointments for minors must be booked by a parent or legal guardian using their own account. If we discover that we have collected data from a child without proper consent, we will delete it promptly.
            </p>
          </section>

          {/* Updates */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Material changes will be communicated via:
            </p>
            <ul style={listStyle}>
              <li>Email notification to your registered email address.</li>
              <li>In-app notification upon your next login.</li>
              <li>Updated "Last modified" date at the top of this page.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Your continued use of the Platform after changes constitutes acceptance of the updated policy. We recommend reviewing this page periodically.
            </p>
          </section>

          {/* Contact */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionHeading}>12. Contact Us</h2>
            <p>
              For privacy-related inquiries, data requests, or complaints:
            </p>
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              marginTop: 12,
              border: '1px solid var(--gray-200)'
            }}>
              <p style={{ margin: 0 }}><strong>Data Protection Officer</strong></p>
              <p style={{ margin: '4px 0 0', color: 'var(--gray-600)' }}>
                MediBook Privacy Team<br />
                Email: privacy@medibook.health<br />
                Response Time: Within 30 days of receipt
              </p>
            </div>
          </section>
        </div>

        {/* Back link */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-arrow-left" /> Back to MediBook
          </Link>
          <Link to="/terms-of-service" style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Terms of Service <i className="bi bi-arrow-right" />
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

const tableContainer = {
  overflowX: 'auto',
  marginTop: 12,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--gray-200)'
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  background: 'var(--gray-50)',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--gray-600)',
  borderBottom: '1px solid var(--gray-200)',
  whiteSpace: 'nowrap'
}

const tdStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--gray-100)',
  color: 'var(--gray-700)',
  verticalAlign: 'top'
}
