import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDoctors } from '../../services/doctors'
import { getDepartments } from '../../services/admin'
import DoctorCard from '../../components/DoctorCard'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import useDebounce from '../../hooks/useDebounce'
import { SkeletonDoctorCard } from '../../components/SkeletonLoader'

const SPECIALIZATIONS = [
  'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
  'Dermatology', 'Gynecology', 'Ophthalmology', 'ENT',
  'General Physician', 'Psychiatry', 'Urology', 'Oncology'
]

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({ name: '', specialization: '', department_id: '' })

  // Debounce the name search to avoid API call on every keystroke
  const debouncedName = useDebounce(filters.name, 300)

  useEffect(() => {
    getDepartments().then(setDepartments).catch(console.error)
  }, [])

  // Load doctors whenever debounced name or other filters change
  useEffect(() => {
    loadData({ ...filters, name: debouncedName })
  }, [debouncedName, filters.specialization, filters.department_id])

  async function loadData(f) {
    try {
      setLoading(true)
      const data = await getDoctors(f)
      setDoctors(data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(key, val) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  function clearFilters() {
    setFilters({ name: '', specialization: '', department_id: '' })
  }

  return (
    <div>
      <Navbar />

      {/* Page Header */}
      <div className="page-header">
        <div className="container">
          <div className="section-badge">Our Specialists</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'white', fontFamily: 'var(--font-display)', position: 'relative', zIndex: 1 }}>
            Find the Right Doctor
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 10, fontSize: 16, position: 'relative', zIndex: 1 }}>
            Browse {doctors.length}+ verified doctors across all specializations
          </p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row g-4">
          {/* Filters Sidebar */}
          <div className="col-lg-3">
            <div className="card-custom p-4 position-sticky" style={{ top: 90 }}>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-funnel me-2 text-primary" />Filters
                </h6>
                <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={clearFilters}>
                  Clear All
                </button>
              </div>

              {/* Search by name */}
              <div className="mb-4">
                <label className="form-label-custom">Search Doctor</label>
                <div className="search-input-wrapper">
                  <i className="bi bi-search" />
                  <input
                    id="doctor-search-name"
                    type="text"
                    className="form-input-custom"
                    placeholder="Doctor name..."
                    value={filters.name}
                    onChange={e => handleFilterChange('name', e.target.value)}
                  />
                </div>
              </div>

              {/* Specialization */}
              <div className="mb-4">
                <label className="form-label-custom">Specialization</label>
                <div className="d-flex flex-column gap-2">
                  {SPECIALIZATIONS.map(spec => (
                    <label
                      key={spec}
                      className="d-flex align-items-center gap-2 cursor-pointer"
                      style={{ fontSize: 14, color: 'var(--gray-600)', padding: '4px 0' }}
                    >
                      <input
                        type="radio"
                        name="specialization"
                        value={spec}
                        checked={filters.specialization === spec}
                        onChange={e => handleFilterChange('specialization', e.target.value)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      {spec}
                    </label>
                  ))}
                </div>
              </div>

              {departments.length > 0 && (
                <div className="mb-4">
                  <label className="form-label-custom">Department</label>
                  <select
                    id="doctor-filter-dept"
                    className="form-input-custom"
                    value={filters.department_id}
                    onChange={e => handleFilterChange('department_id', e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Doctor Grid */}
          <div className="col-lg-9">
            {loading ? (
              <SkeletonDoctorCard count={6} />
            ) : doctors.length === 0 ? (
              <div className="empty-state">
                <i className="bi bi-person-x" />
                <p>No doctors found matching your filters</p>
                <button className="btn-outline-custom mt-3" onClick={clearFilters}>Clear Filters</button>
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <p style={{ color: 'var(--gray-500)', fontSize: 14, margin: 0 }}>
                    Showing <strong>{doctors.length}</strong> doctor{doctors.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="row g-3 stagger-children">
                  {doctors.map(doc => (
                    <div key={doc.id} className="col-md-6 col-xl-4">
                      <DoctorCard doctor={doc} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
