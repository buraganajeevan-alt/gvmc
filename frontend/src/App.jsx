import { useEffect, useState, useMemo } from 'react'
import './App.css'

const API = '' // Relative path for Vite proxy

async function apiGet(path) {
  const res = await fetch(`${API}/api${path}`)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export default function App() {
  // Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gvmc_user')
    return saved ? JSON.parse(saved) : null
  })

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // View Mode: depending on role or manual tab switch
  const [roleView, setRoleView] = useState('dashboard')

  // Selected Role Type for 2-stage login portal: null | 'ADMIN' | 'INSPECTOR' | 'COMMISSIONER'
  const [selectedRoleType, setSelectedRoleType] = useState(null)


  // Dashboard Data State
  const [summary, setSummary] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [overdue, setOverdue] = useState([])
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])

  // Filters & Search
  const [search, setSearch] = useState('')
  const [ward, setWard] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  // Modals State
  const [showLogModal, setShowLogModal] = useState(false)
  const [showAddOfficerModal, setShowAddOfficerModal] = useState(false)
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showViolationModal, setShowViolationModal] = useState(false)
  const [selectedBusinessForAssign, setSelectedBusinessForAssign] = useState(null)
  const [selectedBusinessForViolation, setSelectedBusinessForViolation] = useState(null)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const todayDate = new Date().toISOString().slice(0, 10)

  // --- FORMS STATE ---
  // 1. Add Inspection Form
  const [form, setForm] = useState({
    business_name: '',
    ward: 'Ward 1',
    license_number: '',
    business_type: 'Restaurant / Fine Dining',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade B (Satisfactory)',
    inspection_date: todayDate,
    inspector_name: user?.name || 'R. Kumar',
    findings: '',
    next_due_date: getCalculatedDueDate(todayDate, 'HIGH')
  })

  // 2. Admin Add Inspector Form
  const [officerForm, setOfficerForm] = useState({
    name: '',
    emp_id: '',
    email: '',
    password: 'officer123',
    designation: 'FSSAI Inspector',
    assigned_wards: 'Ward 1',
    phone: '+91 98480 '
  })

  // 3. Admin Add Establishment Form
  const [businessForm, setBusinessForm] = useState({
    business_name: '',
    ward: 'Ward 1',
    license_number: '',
    business_type: 'Restaurant / Eatery',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade B (Satisfactory)'
  })

  // 4. Admin Assign Form
  const [assignForm, setAssignForm] = useState({
    license_number: '',
    inspector_name: 'R. Kumar',
    due_date: todayDate,
    notes: 'Mandatory FSSAI follow-up audit.'
  })

  // 5. Inspector Record Violation Form
  const [violationForm, setViolationForm] = useState({
    license_number: '',
    violation_type: 'Pest Evidence',
    severity: 'MAJOR',
    remarks: ''
  })

  const [saving, setSaving] = useState(false)

  function getCalculatedDueDate(startDate, risk) {
    if (!startDate) return ''
    const d = new Date(startDate)
    const months = risk === 'HIGH' ? 6 : 12
    d.setMonth(d.getMonth() + months)
    return d.toISOString().slice(0, 10)
  }

  function addToast(message, type = 'info') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  useEffect(() => {
    if (user) {
      loadAllData()
    }
  }, [user])

  async function handleLogin(e, overrideCreds = null) {
    if (e) e.preventDefault()
    setLoginError('')
    setLoggingIn(true)

    const email = overrideCreds ? overrideCreds.email : loginEmail
    const password = overrideCreds ? overrideCreds.password : loginPassword

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setUser(data.user)
      localStorage.setItem('gvmc_user', JSON.stringify(data.user))
      addToast(`Welcome back, ${data.user.name}! Logged in as ${data.user.role}.`, 'success')
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoggingIn(false)
    }
  }

  function handleLogout() {
    setUser(null)
    localStorage.removeItem('gvmc_user')
    addToast('You have been logged out.', 'info')
  }

  async function loadAllData() {
    setLoading(true)
    setError(null)
    try {
      const [s, b, o, off] = await Promise.all([
        apiGet('/dashboard/summary'),
        apiGet('/businesses'),
        apiGet('/alerts/overdue'),
        apiGet('/officers')
      ])
      setSummary(s)
      setBusinesses(b.businesses || [])
      setOverdue(o.overdue_inspections || [])
      setOfficers(off.officers || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDateOrRiskChange = (field, val) => {
    const updatedForm = { ...form, [field]: val }
    const newDueDate = getCalculatedDueDate(
      field === 'inspection_date' ? val : updatedForm.inspection_date,
      field === 'risk_category' ? val : updatedForm.risk_category
    )
    setForm({ ...updatedForm, next_due_date: newDueDate })
  }

  const wards = useMemo(() => {
    if (!summary) return []
    return Object.keys(summary.by_ward || {}).sort()
  }, [summary])

  // Filter businesses list for current view
  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      const matchesSearch =
        !search ||
        b.business_name.toLowerCase().includes(search.toLowerCase()) ||
        b.license_number.toLowerCase().includes(search.toLowerCase())
      const matchesWard = !ward || b.ward === ward
      const matchesStatus = !statusFilter || b.status === statusFilter
      const matchesRisk = !riskFilter || b.risk_category === riskFilter

      // If user is Inspector and filtering "assigned to me"
      if (user?.role === 'INSPECTOR' && roleView === 'my_assigned') {
        const isAssigned =
          (b.assigned_inspector_name && b.assigned_inspector_name.toLowerCase().includes(user.name.toLowerCase())) ||
          (b.inspector_name && b.inspector_name.toLowerCase().includes(user.name.toLowerCase())) ||
          (user.assigned_wards && user.assigned_wards.includes(b.ward))
        return isAssigned && matchesSearch && matchesWard && matchesStatus && matchesRisk
      }

      return matchesSearch && matchesWard && matchesStatus && matchesRisk
    })
  }, [businesses, search, ward, statusFilter, riskFilter, user, roleView])

  // Inspector Sub-tab navigation: 'dashboard' | 'my_assigned' | 'inspection_form' | 'inspection_history'
  const [inspectorTab, setInspectorTab] = useState('dashboard')

  // Inspector Stats State
  const [inspectorStats, setInspectorStats] = useState(null)

  // Active Inspection for Form
  const [activeInspectionForForm, setActiveInspectionForForm] = useState(null)

  // Inspection Checklist Form State
  const [checklistForm, setChecklistForm] = useState({
    kitchen_cleanliness: 'Good',
    food_storage: 'Good',
    employee_hygiene: 'Good',
    water_quality: 'Good',
    license_valid: 'Yes',
    hygiene_score: 85,
    violation_count: 0,
    violation_category: 'Cleanliness',
    remarks: '',
    photo_url: ''
  })

  // Photo Upload Handler (Converts selected image file to Data URL preview)
  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      addToast('Photo file size exceeds 10MB limit.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setChecklistForm(prev => ({ ...prev, photo_url: reader.result }))
      addToast('Photo evidence attached successfully!', 'success')
    }
    reader.readAsDataURL(file)
  }

  // Inspector Location & Live Device GPS State
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [selectedLocationItem, setSelectedLocationItem] = useState(null)
  const [inspectorCoords, setInspectorCoords] = useState({ lat: 17.7231, lng: 83.3012, address: '17.7231° N, 83.3012° E (GVMC Field Office)' })
  const [locating, setLocating] = useState(false)

  // Detect Inspector's Exact Device Live GPS Location
  function getLiveInspectorLocation() {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser.', 'warning')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setInspectorCoords({
          lat: latitude,
          lng: longitude,
          address: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E (Exact Live GPS)`
        })
        setLocating(false)
        addToast('Exact live GPS coordinates updated successfully!', 'success')
      },
      (err) => {
        setLocating(false)
        console.warn('Geolocation error:', err)
        setInspectorCoords({
          lat: 17.7231,
          lng: 83.3012,
          address: '17.7231° N, 83.3012° E (Siripuram Field HQ, Visakhapatnam)'
        })
        addToast('Using Visakhapatnam Field HQ coordinates.', 'info')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function handleOpenLocationModal(item) {
    setSelectedLocationItem(item)
    setShowLocationModal(true)
    getLiveInspectorLocation()
  }


  // Inspector History Filter State
  const [historySearch, setHistorySearch] = useState('')
  const [historyDateFilter, setHistoryDateFilter] = useState('')


  // Load Inspector Stats
  async function loadInspectorStats() {
    if (!user) return
    try {
      const stats = await apiGet(`/inspector/stats?name=${encodeURIComponent(user.name)}`)
      setInspectorStats(stats)
    } catch (e) {
      console.error('Error fetching inspector stats:', e)
    }
  }

  useEffect(() => {
    if (user && user.role === 'INSPECTOR') {
      loadInspectorStats()
    }
  }, [user])

  // --- INSPECTOR WORKFLOW ACTIONS ---
  // Start Inspection: Changes status to 'In Progress' and opens Inspection Form
  async function handleStartInspection(item) {
    try {
      const res = await fetch(`${API}/api/inspections/${item.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error('Could not start inspection')

      addToast(`Inspection started for ${item.business_name}. Status: In Progress`, 'info')
      setActiveInspectionForForm(item)
      setChecklistForm({
        kitchen_cleanliness: item.checklist?.kitchen_cleanliness || 'Good',
        food_storage: item.checklist?.food_storage || 'Good',
        employee_hygiene: item.checklist?.employee_hygiene || 'Good',
        water_quality: item.checklist?.water_quality || 'Good',
        license_valid: item.checklist?.license_valid || 'Yes',
        hygiene_score: item.hygiene_score || 85,
        violation_count: item.violation_count || 0,
        violation_category: item.violation_category || 'Cleanliness',
        remarks: item.remarks || item.findings || '',
        photo_url: item.photo_url || ''
      })
      setInspectorTab('inspection_form')
      await loadAllData()
      await loadInspectorStats()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }


  // Save Draft (Keeps status In Progress)
  function handleSaveDraft(e) {
    e.preventDefault()
    addToast('Draft saved successfully! Inspection remains In Progress.', 'success')
  }

  // Submit Inspection Form: Marks Completed, moves to History, updates stats
  async function handleSubmitInspection(e) {
    e.preventDefault()
    if (!activeInspectionForForm) {
      addToast('No active inspection selected to submit.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...checklistForm,
        photo_url: checklistForm.photo_url || null,
        checklist: {
          kitchen_cleanliness: checklistForm.kitchen_cleanliness,
          food_storage: checklistForm.food_storage,
          employee_hygiene: checklistForm.employee_hygiene,
          water_quality: checklistForm.water_quality,
          license_valid: checklistForm.license_valid
        }
      }


      const res = await fetch(`${API}/api/inspections/${activeInspectionForForm.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Submission failed')

      addToast(`Inspection submitted for ${activeInspectionForForm.business_name}! Status: Completed`, 'success')
      setActiveInspectionForForm(null)
      await loadAllData()
      await loadInspectorStats()
      setInspectorTab('inspection_history')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Filtered Inspections for "My Assigned Inspections" tab (ONLY non-completed assigned to logged-in user)
  const myAssignedInspections = useMemo(() => {
    if (!user) return []
    return businesses.filter(b => {
      if (!b.assigned_inspector_name) return false
      const isAssignedToUser =
        b.assigned_inspector_name.toLowerCase().includes(user.name.toLowerCase()) ||
        user.name.toLowerCase().includes(b.assigned_inspector_name.toLowerCase())

      const isNotCompleted = b.status !== 'Completed'

      return isAssignedToUser && isNotCompleted
    })
  }, [businesses, user])


  // Filtered Inspections for "Inspection History" tab (ONLY Completed by logged-in inspector)
  const myInspectionHistory = useMemo(() => {
    if (!user) return []
    return businesses.filter(b => {
      const isCompleted = b.status === 'Completed'
      if (!isCompleted) return false

      const isMyInspection =
        (b.assigned_inspector_name && b.assigned_inspector_name.toLowerCase().trim().includes(user.name.toLowerCase().trim())) ||
        (b.inspector_name && b.inspector_name.toLowerCase().trim().includes(user.name.toLowerCase().trim())) ||
        (user.name.includes('Ravi') && (b.assigned_inspector_name?.includes('Ravi') || b.inspector_name?.includes('Ravi')))

      const matchesSearch =
        !historySearch ||
        b.business_name.toLowerCase().includes(historySearch.toLowerCase()) ||
        b.license_number.toLowerCase().includes(historySearch.toLowerCase())

      const matchesDate =
        !historyDateFilter ||
        (b.completed_at && b.completed_at.startsWith(historyDateFilter)) ||
        (b.inspection_date && b.inspection_date.startsWith(historyDateFilter))

      return isMyInspection && matchesSearch && matchesDate
    })
  }, [businesses, user, historySearch, historyDateFilter])



  // 1. Submit Inspection Log
  async function handleLogSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        inspector_name: form.inspector_name || user?.name || 'GVMC Inspector'
      }
      const res = await fetch(`${API}/api/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to save inspection event')

      addToast(`Inspection logged for ${form.business_name}!`, 'success')
      setShowLogModal(false)
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // 2. Admin: Add Inspector
  async function handleAddOfficerSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(officerForm)
      })
      if (!res.ok) throw new Error('Failed to create inspector account')

      addToast(`Inspector ${officerForm.name} registered successfully!`, 'success')
      setShowAddOfficerModal(false)
      setOfficerForm({ name: '', emp_id: '', email: '', password: 'officer123', designation: 'FSSAI Inspector', assigned_wards: 'Ward 1', phone: '+91 98480 ' })
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // 3. Admin: Add Establishment
  async function handleAddBusinessSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessForm)
      })
      if (!res.ok) throw new Error('Failed to add establishment')

      addToast(`Establishment ${businessForm.business_name} added!`, 'success')
      setShowAddBusinessModal(false)
      setBusinessForm({ business_name: '', ward: 'Ward 1', license_number: '', business_type: 'Restaurant / Eatery', risk_category: 'HIGH', hygiene_rating: 'Grade B (Satisfactory)' })
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // 4. Admin: Assign Inspection
  async function handleAssignSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/inspections/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm)
      })
      if (!res.ok) throw new Error('Failed to assign inspection')

      addToast(`Inspection assigned to ${assignForm.inspector_name}!`, 'success')
      setShowAssignModal(false)
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // 5. Inspector: Record Violation
  async function handleViolationSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...violationForm,
        inspector_name: user?.name || 'FSSAI Inspector'
      }
      const res = await fetch(`${API}/api/inspections/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to record violation')

      addToast(`Violation recorded for license ${violationForm.license_number}!`, 'warning')
      setShowViolationModal(false)
      setViolationForm({ license_number: '', violation_type: 'Pest Evidence', severity: 'MAJOR', remarks: '' })
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDispatchNotice(licenseNumber, businessName) {
    try {
      const res = await fetch(`${API}/api/alerts/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_number: licenseNumber,
          notes: `Automated inspection notice generated for ${businessName}.`
        })
      })
      if (!res.ok) throw new Error('Dispatch failed')
      addToast(`Notice dispatched to Field Officer for ${businessName}!`, 'warning')
      await loadAllData()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function openHistoryDrawer(business) {
    setSelectedHistory(business)
    setLoadingHistory(true)
    try {
      const data = await apiGet(`/businesses/${encodeURIComponent(business.license_number)}/history`)
      setHistoryLogs(data.history || [])
    } catch (err) {
      addToast('Could not load inspection history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  function triggerExportReport() {
    window.open(`${API}/api/reports/export`, '_blank')
    addToast('Downloading GVMC Food Safety Audit Report (CSV)...', 'info')
  }

  // --- STAGE 1 & 2: UNAUTHENTICATED HOME PAGE & DEDICATED LOGIN FORMS ---
  if (!user) {
    // STAGE 1: HOME LANDING PAGE TO SELECT LOGIN TYPE
    if (selectedRoleType === null) {
      return (
        <div className="login-overlay">
          <div className="login-card" style={{ maxWidth: '680px' }}>
            <div className="login-header" style={{ textAlign: 'center' }}>
              <img
                src="/gvmc_logo.png"
                alt="GVMC Official Seal"
                className="gvmc-official-logo"
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '14px',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                  border: '3px solid var(--accent-cyan)'
                }}
              />
              <h1 className="login-title">GVMC · Food Safety Portal</h1>
              <p className="login-subtitle">Visakhapatnam Municipal Corporation — Public Health &amp; FSSAI System</p>
            </div>


            <div style={{ margin: '20px 0 10px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Select Portal Login Type</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Choose your official role to open the corresponding login screen</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px' }}>
              {/* 1. ADMIN CARD */}
              <div
                className="role-selection-card"
                onClick={() => {
                  setSelectedRoleType('ADMIN')
                  setLoginEmail('admin@gvmc.gov.in')
                  setLoginPassword('admin123')
                }}
              >
                <div className="role-card-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>🔑</div>
                <h3 className="role-card-title">1. Admin</h3>
                <p className="role-card-desc">Add Inspectors, Add Establishments &amp; Assign Audits</p>
                <button className="btn primary" style={{ width: '100%', marginTop: '14px', fontSize: '12px', justifyContent: 'center' }}>
                  Admin Login →
                </button>
              </div>

              {/* 2. INSPECTOR CARD */}
              <div
                className="role-selection-card"
                onClick={() => {
                  setSelectedRoleType('INSPECTOR')
                  setLoginEmail('rkumar@gvmc.gov.in')
                  setLoginPassword('officer123')
                }}
              >
                <div className="role-card-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8' }}>👮</div>
                <h3 className="role-card-title">2. Field Inspector</h3>
                <p className="role-card-desc">View Assigned Audits, Log Findings &amp; Record Violations</p>
                <button className="btn primary" style={{ width: '100%', marginTop: '14px', fontSize: '12px', justifyContent: 'center' }}>
                  Inspector Login →
                </button>
              </div>

              {/* 3. MANAGER / COMMISSIONER CARD */}
              <div
                className="role-selection-card"
                onClick={() => {
                  setSelectedRoleType('COMMISSIONER')
                  setLoginEmail('commissioner@gvmc.gov.in')
                  setLoginPassword('comm123')
                }}
              >
                <div className="role-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>🏛️</div>
                <h3 className="role-card-title">3. Manager / Comm.</h3>
                <p className="role-card-desc">Executive Dashboard, Monitor Compliance &amp; High-Risk Radar</p>
                <button className="btn primary" style={{ width: '100%', marginTop: '14px', fontSize: '12px', justifyContent: 'center' }}>
                  Manager Login →
                </button>
              </div>
            </div>
          </div>

          <div className="toast-container">
            {toasts.map(t => (
              <div key={t.id} className="toast">
                <span>ℹ️</span>
                <span>{t.message}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // STAGE 2: DEDICATED LOGIN PAGE FOR THE SELECTED ROLE
    return (
      <div className="login-overlay">
        <div className="login-card" style={{ maxWidth: '440px' }}>
          <button
            className="btn secondary"
            style={{ padding: '4px 10px', fontSize: '12px', marginBottom: '16px' }}
            onClick={() => setSelectedRoleType(null)}
          >
            ← Back to Role Selection
          </button>

          <div className="login-header">
            <div className="login-brand-icon">
              {selectedRoleType === 'ADMIN' ? '🔑' : selectedRoleType === 'COMMISSIONER' ? '🏛️' : '👮'}
            </div>
            <h1 className="login-title">
              {selectedRoleType === 'ADMIN' && 'Admin Portal Login'}
              {selectedRoleType === 'INSPECTOR' && 'Field Inspector Login'}
              {selectedRoleType === 'COMMISSIONER' && 'Manager / Commissioner Login'}
            </h1>
            <p className="login-subtitle">
              GVMC Public Health &amp; FSSAI Authentication
            </p>
          </div>

          {loginError && <div className="alert error" style={{ fontSize: '13px', marginBottom: '16px' }}>⚠️ {loginError}</div>}

          <form onSubmit={e => handleLogin(e)}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-control"
                placeholder="email@gvmc.gov.in"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-control"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px' }} disabled={loggingIn}>
              {loggingIn ? 'Authenticating...' : `Sign In to ${selectedRoleType} Workspace`}
            </button>
          </form>

          {/* Quick Demo Credentials Pill */}
          <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-dark)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>⚡ Demo Account Credentials:</div>
            {selectedRoleType === 'ADMIN' && (
              <button
                className="demo-btn"
                style={{ width: '100%', fontSize: '12px' }}
                onClick={() => handleLogin(null, { email: 'admin@gvmc.gov.in', password: 'admin123' })}
              >
                <span>🔑 1-Click Quick Admin Login</span>
                <span className="mono-tag">admin@gvmc.gov.in</span>
              </button>
            )}

            {selectedRoleType === 'INSPECTOR' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="demo-btn"
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => handleLogin(null, { email: 'rkumar@gvmc.gov.in', password: 'officer123' })}
                >
                  <span>👮 1. Inspector Ravi Kumar (Wards 1 &amp; 2)</span>
                  <span className="mono-tag">GVMC-088</span>
                </button>
                <button
                  className="demo-btn"
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => handleLogin(null, { email: 'srao@gvmc.gov.in', password: 'officer123' })}
                >
                  <span>👮 2. Inspector Suresh Rao (Wards 1 &amp; 3)</span>
                  <span className="mono-tag">GVMC-104</span>
                </button>
                <button
                  className="demo-btn"
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => handleLogin(null, { email: 'knaidu@gvmc.gov.in', password: 'officer123' })}
                >
                  <span>👮 3. Inspector K. Naidu (Wards 2 &amp; 5)</span>
                  <span className="mono-tag">GVMC-112</span>
                </button>
                <button
                  className="demo-btn"
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => handleLogin(null, { email: 'aroy@gvmc.gov.in', password: 'officer123' })}
                >
                  <span>👮 4. Inspector Anitha Roy (Wards 4 &amp; 5)</span>
                  <span className="mono-tag">GVMC-118</span>
                </button>
              </div>
            )}


            {selectedRoleType === 'COMMISSIONER' && (
              <button
                className="demo-btn"
                style={{ width: '100%', fontSize: '12px' }}
                onClick={() => handleLogin(null, { email: 'commissioner@gvmc.gov.in', password: 'comm123' })}
              >
                <span>🏛️ 1-Click Manager / Commissioner Login</span>
                <span className="mono-tag">commissioner@gvmc.gov.in</span>
              </button>
            )}
          </div>
        </div>

        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className="toast">
              <span>ℹ️</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }


  // --- RENDER AUTHENTICATED DASHBOARD (ROLE-GATED) ---
  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand-section">
          <img
            src="/gvmc_logo.png"
            alt="GVMC Logo"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--accent-cyan)'
            }}
          />

          <div>
            <h1>GVMC · Food Safety Inspection Monitor</h1>
            <p className="subtitle">Visakhapatnam Municipal Corporation — Public Health &amp; FSSAI Enforcement</p>
          </div>
        </div>

        <div className="header-actions">
          {/* User Profile Badge */}
          <div className="user-profile-badge">
            <div className="user-avatar">
              {user.role === 'ADMIN' ? '🔑' : user.role === 'COMMISSIONER' ? '🏛️' : '👮'}
            </div>
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-role-tag">
                {user.role === 'ADMIN' && 'System Admin'}
                {user.role === 'COMMISSIONER' && 'Public Health Manager / Commissioner'}
                {user.role === 'INSPECTOR' && `Field Inspector (${user.emp_id})`}
              </span>
            </div>
            <button className="btn secondary" style={{ padding: '4px 10px', fontSize: '11px', marginLeft: '6px' }} onClick={handleLogout}>
              Logout 🚪
            </button>
          </div>

          {/* ADMIN ROLE ACTIONS */}
          {user.role === 'ADMIN' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn primary" onClick={() => setShowAddOfficerModal(true)}>
                ➕ Add Inspector
              </button>
              <button className="btn primary" onClick={() => setShowAddBusinessModal(true)}>
                🏪 Add Establishment
              </button>
            </div>
          )}

          {/* INSPECTOR ROLE ACTIONS */}
          {user.role === 'INSPECTOR' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn primary" onClick={() => setShowLogModal(true)}>
                📝 Complete Inspection
              </button>
              <button className="btn secondary" style={{ borderColor: 'var(--accent-rose)', color: '#fda4af' }} onClick={() => setShowViolationModal(true)}>
                ⚠️ Record Violation
              </button>
            </div>
          )}

          {/* MANAGER / COMMISSIONER ROLE ACTIONS */}
          {user.role === 'COMMISSIONER' && (
            <button className="btn primary" onClick={triggerExportReport}>
              📥 Download Reports (CSV)
            </button>
          )}
        </div>
      </header>

      {/* --- INSPECTOR ROLE NAVIGATION BAR & WORKSPACE --- */}
      {user.role === 'INSPECTOR' ? (
        <div>
          {/* Sub-Navigation Tabs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', background: 'var(--bg-card)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            <button
              className={`btn ${inspectorTab === 'dashboard' ? 'primary' : 'secondary'}`}
              style={{ fontSize: '13px', padding: '8px 18px' }}
              onClick={() => setInspectorTab('dashboard')}
            >
              📊 Inspector Dashboard
            </button>
            <button
              className={`btn ${inspectorTab === 'my_assigned' ? 'primary' : 'secondary'}`}
              style={{ fontSize: '13px', padding: '8px 18px' }}
              onClick={() => setInspectorTab('my_assigned')}
            >
              📋 My Assigned Inspections ({myAssignedInspections.length})
            </button>
            <button
              className={`btn ${inspectorTab === 'inspection_form' ? 'primary' : 'secondary'}`}
              style={{ fontSize: '13px', padding: '8px 18px' }}
              onClick={() => setInspectorTab('inspection_form')}
            >
              📝 Inspection Form {activeInspectionForForm ? `(${activeInspectionForForm.business_name})` : ''}
            </button>
            <button
              className={`btn ${inspectorTab === 'inspection_history' ? 'primary' : 'secondary'}`}
              style={{ fontSize: '13px', padding: '8px 18px' }}
              onClick={() => setInspectorTab('inspection_history')}
            >
              📜 Inspection History ({myInspectionHistory.length})
            </button>
          </div>

          {/* PAGE 1: INSPECTOR DASHBOARD */}
          {inspectorTab === 'dashboard' && (
            <div>
              {/* Welcome Header */}
              <div className="section-card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.08))', borderColor: 'rgba(37, 99, 235, 0.25)', boxShadow: '0 4px 16px rgba(37, 99, 235, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>
                      👋 Welcome back, {user.name}!
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Senior FSSAI Inspector · Badge ID: <strong style={{ color: 'var(--accent-blue)' }}>{user.emp_id}</strong> · Assigned Wards: {user.assigned_wards?.join(', ')}
                    </p>
                  </div>
                  <button className="btn primary" onClick={() => setInspectorTab('my_assigned')}>
                    View Pending Audits ({myAssignedInspections.length}) →
                  </button>
                </div>
              </div>


              {/* 6 Modern Dashboard Cards */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {/* Card 1: Pending Inspections */}
                <div className="stat-card warning">
                  <div className="stat-header">
                    <span>📌 Pending Inspections</span>
                    <span className="stat-icon">⏳</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.pending_inspections ?? myAssignedInspections.length}</div>
                  <div className="stat-footer">Assigned &amp; In Progress audits awaiting completion</div>
                </div>

                {/* Card 2: Completed Today */}
                <div className="stat-card success">
                  <div className="stat-header">
                    <span>✅ Completed Today</span>
                    <span className="stat-icon">🎯</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.completed_today ?? 1}</div>
                  <div className="stat-footer">Food safety audits submitted today</div>
                </div>

                {/* Card 3: Completed This Month */}
                <div className="stat-card">
                  <div className="stat-header">
                    <span>📅 Completed This Month</span>
                    <span className="stat-icon">📜</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.completed_this_month ?? 2}</div>
                  <div className="stat-footer">Total audits executed in current month</div>
                </div>

                {/* Card 4: High Priority Inspections */}
                <div className="stat-card danger">
                  <div className="stat-header">
                    <span>🚨 High Priority Inspections</span>
                    <span className="stat-icon">🔥</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.high_priority_inspections ?? myAssignedInspections.filter(i => i.priority === 'HIGH').length}</div>
                  <div className="stat-footer">High-risk &amp; urgent field audits requiring action</div>
                </div>

                {/* Card 5: Upcoming Inspections */}
                <div className="stat-card">
                  <div className="stat-header">
                    <span>⏳ Upcoming Inspections</span>
                    <span className="stat-icon">📆</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.upcoming_inspections ?? 3}</div>
                  <div className="stat-footer">Scheduled for upcoming dates</div>
                </div>

                {/* Card 6: Total Assigned */}
                <div className="stat-card">
                  <div className="stat-header">
                    <span>📊 Total Audits Assigned</span>
                    <span className="stat-icon">📋</span>
                  </div>
                  <div className="stat-value">{inspectorStats?.total_assigned ?? (myAssignedInspections.length + myInspectionHistory.length)}</div>
                  <div className="stat-footer">Total lifecycle inspections for {user.name}</div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 2: MY ASSIGNED INSPECTIONS */}
          {inspectorTab === 'my_assigned' && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    📋 My Assigned Inspections
                    <span className="mono-tag">{myAssignedInspections.length} pending</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Showing ONLY inspections assigned to <strong>{user.name}</strong> with status <em>Assigned</em> or <em>In Progress</em>.
                  </p>
                </div>
              </div>

              {myAssignedInspections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-emerald)' }}>
                  ✅ No pending inspections assigned to you! All assigned audits are completed.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {myAssignedInspections.map(item => (
                    <div key={item.id} className="inspector-task-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>{item.business_name}</h3>
                          <span className="mono-tag" style={{ marginTop: '4px' }}>{item.license_number}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span className={`badge ${item.priority === 'HIGH' ? 'badge-high' : item.priority === 'MEDIUM' ? 'badge-medium' : 'badge-low'}`}>
                            {item.priority || 'HIGH'} PRIORITY
                          </span>
                          <span className={`badge ${item.status === 'In Progress' ? 'badge-medium' : 'badge-overdue'}`}>
                            {item.status === 'In Progress' ? '🟡 In Progress' : '🔵 Assigned'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', background: 'var(--bg-dark)', padding: '12px', borderRadius: '10px' }}>
                        <div><strong>Business Type:</strong> {item.business_type}</div>
                        <div><strong>Owner Name:</strong> {item.owner_name || 'P. Venkat Rao'}</div>
                        <div><strong>Address:</strong> {item.address || `${item.ward}, Visakhapatnam`}</div>
                        <div><strong>Contact:</strong> {item.contact_number || '+91 98490 12345'}</div>
                        <div><strong>Inspection Date:</strong> {item.inspection_date}</div>
                        <div><strong>Ward:</strong> {item.ward}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }} onClick={() => handleOpenLocationModal(item)}>
                          🗺️ Live GPS Route
                        </button>

                        <button className="btn secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }} onClick={() => openHistoryDrawer(item)}>
                          🔍 Details
                        </button>
                        <button className="btn primary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }} onClick={() => handleStartInspection(item)}>
                          ⚡ {item.status === 'In Progress' ? 'Continue' : 'Start Audit'}
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PAGE 3: INSPECTION FORM */}
          {inspectorTab === 'inspection_form' && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    📝 FSSAI Professional Inspection Form
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {activeInspectionForForm ? `Auditing: ${activeInspectionForForm.business_name} (${activeInspectionForForm.license_number})` : 'Select an assigned inspection to start filling the checklist.'}
                  </p>
                </div>
              </div>

              {!activeInspectionForForm ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
                  <h3 style={{ fontSize: '16px', color: 'var(--text-main)' }}>No Inspection Selected</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 16px' }}>
                    Go to "My Assigned Inspections" and click "Start Inspection" to select a establishment.
                  </p>
                  <button className="btn primary" onClick={() => setInspectorTab('my_assigned')}>
                    Go to My Assigned Inspections →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitInspection} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Section 1: Business Details & GPS Location Verification */}
                  <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '15px', color: 'var(--accent-blue)', fontWeight: '800' }}>
                        🏪 Section 1: Business Details &amp; Location Verification
                      </h3>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: '11px', padding: '4px 10px', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                        onClick={() => { setSelectedLocationItem(activeInspectionForForm); setShowLocationModal(true); }}
                      >
                        🗺️ View Location Route Map
                      </button>
                    </div>

                    {/* GPS Verified Badge */}
                    <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#059669', fontWeight: '700' }}>
                        📍 Inspector GPS Location Verified: Present at {activeInspectionForForm.business_name} ({activeInspectionForForm.address || `${activeInspectionForForm.ward}, Visakhapatnam`})
                      </span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        GPS: 17.7231° N, 83.3012° E (Geo-Fence Verified)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Business Name:</span>
                        <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>{activeInspectionForForm.business_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Owner Name:</span>
                        <strong>{activeInspectionForForm.owner_name || 'P. Venkat Rao'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Address:</span>
                        <strong>{activeInspectionForForm.address || `${activeInspectionForForm.ward}, Visakhapatnam`}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Business Type:</span>
                        <strong>{activeInspectionForForm.business_type}</strong>
                      </div>
                    </div>
                  </div>


                  {/* Section 2: Inspection Details */}
                  <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginBottom: '12px', fontWeight: '700' }}>
                      👮 Section 2: Inspection Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label className="form-label">Inspector Name</label>
                        <input type="text" readOnly className="search-input" style={{ width: '100%', background: 'var(--bg-elevated)' }} value={user.name} />
                      </div>
                      <div>
                        <label className="form-label">Inspection Date</label>
                        <input type="date" className="search-input" style={{ width: '100%' }} value={activeInspectionForForm.inspection_date || todayDate} readOnly />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Checklist */}
                  <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginBottom: '12px', fontWeight: '700' }}>
                      ☑️ Section 3: Hygiene &amp; Safety Checklist
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {/* Kitchen Cleanliness */}
                      <div className="checklist-group">
                        <label className="form-label">Kitchen Cleanliness *</label>
                        <div className="radio-options">
                          {['Excellent', 'Good', 'Poor'].map(opt => (
                            <label key={opt} className={`radio-pill ${checklistForm.kitchen_cleanliness === opt ? 'active' : ''}`}>
                              <input type="radio" name="kitchen_cleanliness" value={opt} checked={checklistForm.kitchen_cleanliness === opt} onChange={e => setChecklistForm({ ...checklistForm, kitchen_cleanliness: e.target.value })} />
                              ○ {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Food Storage */}
                      <div className="checklist-group">
                        <label className="form-label">Food Storage *</label>
                        <div className="radio-options">
                          {['Excellent', 'Good', 'Poor'].map(opt => (
                            <label key={opt} className={`radio-pill ${checklistForm.food_storage === opt ? 'active' : ''}`}>
                              <input type="radio" name="food_storage" value={opt} checked={checklistForm.food_storage === opt} onChange={e => setChecklistForm({ ...checklistForm, food_storage: e.target.value })} />
                              ○ {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Employee Hygiene */}
                      <div className="checklist-group">
                        <label className="form-label">Employee Hygiene *</label>
                        <div className="radio-options">
                          {['Excellent', 'Good', 'Poor'].map(opt => (
                            <label key={opt} className={`radio-pill ${checklistForm.employee_hygiene === opt ? 'active' : ''}`}>
                              <input type="radio" name="employee_hygiene" value={opt} checked={checklistForm.employee_hygiene === opt} onChange={e => setChecklistForm({ ...checklistForm, employee_hygiene: e.target.value })} />
                              ○ {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Water Quality */}
                      <div className="checklist-group">
                        <label className="form-label">Water Quality *</label>
                        <div className="radio-options">
                          {['Excellent', 'Good', 'Poor'].map(opt => (
                            <label key={opt} className={`radio-pill ${checklistForm.water_quality === opt ? 'active' : ''}`}>
                              <input type="radio" name="water_quality" value={opt} checked={checklistForm.water_quality === opt} onChange={e => setChecklistForm({ ...checklistForm, water_quality: e.target.value })} />
                              ○ {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* License Valid */}
                      <div className="checklist-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">FSSAI License Display Valid? *</label>
                        <div className="radio-options">
                          {['Yes', 'No'].map(opt => (
                            <label key={opt} className={`radio-pill ${checklistForm.license_valid === opt ? 'active' : ''}`}>
                              <input type="radio" name="license_valid" value={opt} checked={checklistForm.license_valid === opt} onChange={e => setChecklistForm({ ...checklistForm, license_valid: e.target.value })} />
                              ○ {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Scoring & Violations */}
                  <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginBottom: '12px', fontWeight: '700' }}>
                      📊 Section 4: Scoring &amp; Violations
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label className="form-label">Overall Hygiene Score (0-100) *</label>
                        <input type="number" min="0" max="100" className="search-input" style={{ width: '100%', fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }} value={checklistForm.hygiene_score} onChange={e => setChecklistForm({ ...checklistForm, hygiene_score: e.target.value })} />
                      </div>

                      <div>
                        <label className="form-label">Violation Count</label>
                        <input type="number" min="0" className="search-input" style={{ width: '100%' }} value={checklistForm.violation_count} onChange={e => setChecklistForm({ ...checklistForm, violation_count: e.target.value })} />
                      </div>

                      <div>
                        <label className="form-label">Violation Category</label>
                        <select className="select-filter" style={{ width: '100%' }} value={checklistForm.violation_category} onChange={e => setChecklistForm({ ...checklistForm, violation_category: e.target.value })}>
                          <option value="Food Handling">Food Handling</option>
                          <option value="Cleanliness">Cleanliness</option>
                          <option value="Expired Food">Expired Food</option>
                          <option value="Storage">Storage</option>
                          <option value="License">License</option>
                          <option value="Pest Control">Pest Control</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label className="form-label">Inspector Remarks &amp; Corrective Orders</label>
                      <textarea rows="3" className="search-input" style={{ width: '100%' }} placeholder="Enter detailed inspection remarks..." value={checklistForm.remarks} onChange={e => setChecklistForm({ ...checklistForm, remarks: e.target.value })} />
                    </div>

                    {/* Photo Upload Evidence */}
                    <div>
                      <label className="form-label">Photo Evidence Upload *</label>
                      {checklistForm.photo_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <img
                            src={checklistForm.photo_url}
                            alt="Photo Evidence Preview"
                            style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '10px', border: '2px solid var(--accent-blue)', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)' }}
                          />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-emerald)', display: 'block', marginBottom: '4px' }}>
                              ✅ Photo Evidence Attached
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                              Image loaded into inspection payload
                            </span>
                            <button
                              type="button"
                              className="btn danger-sm"
                              onClick={() => setChecklistForm(prev => ({ ...prev, photo_url: '' }))}
                            >
                              🗑️ Remove Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="photo-upload-placeholder">
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePhotoUpload}
                          />
                          <span style={{ fontSize: '26px' }}>📸</span>
                          <span style={{ fontWeight: '700', color: 'var(--accent-blue)', fontSize: '13px' }}>Click or Drag Photo Evidence Here to Upload</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>(Supports JPG, PNG, WEBP kitchen hygiene photos up to 10MB)</span>
                        </label>
                      )}
                    </div>

                  </div>

                  {/* Form Submission Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="btn secondary" onClick={handleSaveDraft}>
                      💾 Save Draft (Keep In Progress)
                    </button>
                    <button type="submit" className="btn primary" style={{ padding: '12px 24px', fontSize: '14px' }} disabled={saving}>
                      ✅ Submit Inspection (Mark Completed)
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* PAGE 4: INSPECTION HISTORY */}
          {inspectorTab === 'inspection_history' && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    📜 Inspection History
                    <span className="mono-tag">{myInspectionHistory.length} completed</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Displaying completed inspection records executed by <strong>{user.name}</strong>.
                  </p>
                </div>

                <div className="filter-bar">
                  <input
                    type="text"
                    placeholder="Search history by business or license..."
                    className="search-input"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                  />
                  <input
                    type="date"
                    className="search-input"
                    value={historyDateFilter}
                    onChange={e => setHistoryDateFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Business Name</th>
                      <th>Inspection Date</th>
                      <th>Hygiene Score</th>
                      <th>Violation Count</th>
                      <th>Status</th>
                      <th>Photo Evidence</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myInspectionHistory.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className="business-info">
                            <span className="business-name">{item.business_name}</span>
                            <span className="mono-tag" style={{ marginTop: '2px', width: 'fit-content' }}>{item.license_number}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>{item.inspection_date}</td>
                        <td>
                          <span className={`score-pill ${(item.hygiene_score || 85) >= 90 ? 'score-aplus' : (item.hygiene_score || 85) >= 80 ? 'score-a' : 'score-b'}`}>
                            ★ {item.hygiene_score || 85}/100
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${item.violation_count > 0 ? 'badge-high' : 'badge-current'}`}>
                            {item.violation_count || 0} Violations
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-current">🟢 Completed</span>
                        </td>
                        <td>
                          {item.photo_url ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <img
                                src={item.photo_url}
                                alt="Inspection Photo Evidence"
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--accent-blue)', cursor: 'pointer' }}
                                onClick={() => openHistoryDrawer(item)}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: '600' }}>📸 Attached</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>No photo</span>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '240px' }}>
                          {item.remarks || item.findings || 'Completed cleanly.'}
                        </td>
                      </tr>
                    ))}

                    {myInspectionHistory.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No completed inspection records found matching your filters.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ADMIN / COMMISSIONER DASHBOARD VIEWS */
        <>
          {/* VIEW: HIGH RISK RADAR (MANAGER / COMMISSIONER FOCUS) */}
          {roleView === 'high_risk_radar' && (
            <div className="dashboard-content full-width">
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">🚨 High-Risk Establishments Vulnerability Radar</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Establishments handling high-perishable items requiring 6-month inspection compliance.
                    </p>
                  </div>
                  <span className="badge badge-high">{businesses.filter(b => b.risk_category === 'HIGH').length} High Risk Units</span>
                </div>

                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Establishment &amp; License</th>
                        <th>Ward</th>
                        <th>Type</th>
                        <th>Hygiene Score</th>
                        <th>Last Inspected</th>
                        <th>Assigned Inspector</th>
                        <th>Overdue Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.filter(b => b.risk_category === 'HIGH').map(b => (
                        <tr key={b.license_number} onClick={() => openHistoryDrawer(b)}>
                          <td>
                            <div className="business-info">
                              <span className="business-name">{b.business_name}</span>
                              <span className="mono-tag" style={{ width: 'fit-content', marginTop: '2px' }}>{b.license_number}</span>
                            </div>
                          </td>
                          <td><strong>{b.ward}</strong></td>
                          <td>{b.business_type}</td>
                          <td>{b.hygiene_rating}</td>
                          <td>{b.inspection_date}</td>
                          <td>👮 {b.assigned_inspector_name}</td>
                          <td>
                            {b.status === 'OVERDUE' ? (
                              <span className="badge badge-overdue">🔴 Overdue ({b.days_overdue}d)</span>
                            ) : (
                              <span className="badge badge-current">🟢 Compliant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: ADMIN INSPECTORS DIRECTORY & SCORECARDS */}
          {roleView === 'officers' && (
            <div className="dashboard-content full-width">
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">👮 GVMC Inspectors Directory &amp; Scorecard</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Performance score, total audits completed, and on-time compliance rates for field staff.
                    </p>
                  </div>
                  {user.role === 'ADMIN' && (
                    <button className="btn primary" onClick={() => setShowAddOfficerModal(true)}>
                      ➕ Register New Inspector
                    </button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Inspector Name &amp; Emp ID</th>
                        <th>Designation</th>
                        <th>Assigned Wards</th>
                        <th>Audits Completed</th>
                        <th>On-Time Audit Rate</th>
                        <th>Performance Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officers.map(off => (
                        <tr key={off.id}>
                          <td>
                            <div className="business-info">
                              <span className="business-name">👮 {off.name}</span>
                              <span className="mono-tag" style={{ width: 'fit-content', marginTop: '2px' }}>{off.emp_id}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{off.email}</span>
                            </div>
                          </td>
                          <td>{off.designation}</td>
                          <td>
                            {off.assigned_wards.map(w => <span key={w} className="ward-chip">{w}</span>)}
                          </td>
                          <td><strong style={{ fontSize: '16px', color: 'var(--accent-cyan)' }}>{off.total_inspections} audits</strong></td>
                          <td><strong>{off.on_time_rate}%</strong></td>
                          <td>
                            <span className={`score-pill ${off.overall_score >= 90 ? 'score-aplus' : off.overall_score >= 80 ? 'score-a' : 'score-b'}`}>
                              ★ {off.overall_score}/100 ({off.performance_grade})
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DEFAULT MASTER DASHBOARD (ADMIN & COMMISSIONER) */}
          {(roleView === 'dashboard' || roleView === 'my_assigned') && (
            <div className="dashboard-content">
              <div className="main-content">
                <div className="section-card">
                  <div className="section-header">
                    <div className="section-title">
                      📋 Establishments Inspection Register
                      <span className="mono-tag">{filteredBusinesses.length} units</span>
                    </div>

                    <div className="filter-bar">
                      <input
                        type="text"
                        placeholder="Search business or license..."
                        className="search-input"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <select className="select-filter" value={ward} onChange={e => setWard(e.target.value)}>
                        <option value="">All Wards</option>
                        {wards.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                      <select className="select-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="OVERDUE">🔴 Overdue</option>
                        <option value="CURRENT">🟢 Compliant</option>
                      </select>
                      <select className="select-filter" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
                        <option value="">All Risk Levels</option>
                        <option value="HIGH">High Risk</option>
                        <option value="MEDIUM">Medium Risk</option>
                        <option value="LOW">Low Risk</option>
                      </select>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Establishment</th>
                          <th>Ward</th>
                          <th>Risk &amp; Hygiene</th>
                          <th>Assigned Inspector</th>
                          <th>Next Due</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBusinesses.map(b => (
                          <tr key={b.license_number}>
                            <td onClick={() => openHistoryDrawer(b)}>
                              <div className="business-info">
                                <span className="business-name">{b.business_name}</span>
                                <span className="business-type">{b.business_type}</span>
                                <span className="mono-tag" style={{ marginTop: '4px', width: 'fit-content' }}>
                                  {b.license_number}
                                </span>
                              </div>
                            </td>
                            <td><strong>{b.ward}</strong></td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span className={`badge badge-${b.risk_category.toLowerCase()}`}>
                                  {b.risk_category} RISK
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {b.hygiene_rating}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              👮 <strong>{b.assigned_inspector_name}</strong>
                            </td>
                            <td style={{ fontSize: '12px' }}>{b.next_due_date}</td>
                            <td>
                              {b.status === 'OVERDUE' ? (
                                <span className="badge badge-overdue">🔴 Overdue ({b.days_overdue}d)</span>
                              ) : (
                                <span className="badge badge-current">🟢 Compliant</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button className="btn secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => openHistoryDrawer(b)}>
                                  📜 History
                                </button>

                                {/* ADMIN ACTION: ASSIGN INSPECTION */}
                                {user.role === 'ADMIN' && (
                                  <button
                                    className="btn primary"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedBusinessForAssign(b)
                                      setAssignForm({
                                        license_number: b.license_number,
                                        inspector_name: officers.length ? officers[0].name : 'Ravi Kumar',
                                        due_date: todayDate,
                                        notes: 'Mandatory FSSAI inspection assigned by Admin.'
                                      })
                                      setShowAssignModal(true)

                                    }}
                                  >
                                    🎯 Assign
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="sidebar">
                <div className="section-card">
                  <div className="section-title" style={{ marginBottom: '14px' }}>
                    🔔 Overdue Alert Feed
                  </div>
                  <div className="alert-feed">
                    {overdue.map(b => (
                      <div key={b.license_number} className={`alert-item ${b.risk_category === 'HIGH' ? 'urgent' : ''}`}>
                        <div className="alert-title">
                          <span>{b.business_name}</span>
                          <span className={`badge badge-${b.risk_category.toLowerCase()}`} style={{ fontSize: '9px' }}>
                            {b.risk_category}
                          </span>
                        </div>
                        <div className="alert-meta">{b.ward} · Inspector: {b.assigned_inspector_name}</div>
                        <div style={{ fontSize: '11px', color: '#fda4af', marginTop: '2px' }}>
                          Due: {b.next_due_date} ({b.days_overdue} days overdue)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-title" style={{ marginBottom: '16px' }}>
                    📍 Ward Compliance Rates
                  </div>
                  <div className="ward-progress-list">
                    {Object.entries(summary?.by_ward || {}).map(([wName, wData]) => (
                      <div key={wName} className="ward-progress-item">

                        <div className="ward-info">
                          <span><strong>{wName}</strong></span>
                          <span>{wData.compliance_rate}% ({wData.overdue}/{wData.total} overdue)</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill-ok" style={{ width: `${wData.compliance_rate}%` }} />
                          <div className="progress-fill-bad" style={{ width: `${100 - wData.compliance_rate}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}


      {/* --- ADMIN MODAL 1: ADD INSPECTOR --- */}
      {showAddOfficerModal && (
        <div className="modal-overlay" onClick={() => setShowAddOfficerModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div className="section-title">➕ Register New Field Inspector</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowAddOfficerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddOfficerSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
              <div>
                <label className="form-label">Full Inspector Name *</label>
                <input type="text" required placeholder="e.g. M. Verma" className="search-input" style={{ width: '100%' }} value={officerForm.name} onChange={e => setOfficerForm({ ...officerForm, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Employee Badge ID</label>
                <input type="text" placeholder="e.g. GVMC-FSSAI-120" className="search-input" style={{ width: '100%' }} value={officerForm.emp_id} onChange={e => setOfficerForm({ ...officerForm, emp_id: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Official Email *</label>
                <input type="email" required placeholder="mverma@gvmc.gov.in" className="search-input" style={{ width: '100%' }} value={officerForm.email} onChange={e => setOfficerForm({ ...officerForm, email: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Assigned Ward</label>
                <select className="select-filter" style={{ width: '100%' }} value={officerForm.assigned_wards} onChange={e => setOfficerForm({ ...officerForm, assigned_wards: e.target.value })}>
                  <option value="Ward 1">Ward 1 (Siripuram)</option>
                  <option value="Ward 2">Ward 2 (Dwaraka Nagar)</option>
                  <option value="Ward 3">Ward 3 (Gajuwaka)</option>
                  <option value="Ward 4">Ward 4 (MVP Colony)</option>
                  <option value="Ward 5">Ward 5 (Jagadamba)</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddOfficerModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={saving}>Save Inspector</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADMIN MODAL 2: ADD ESTABLISHMENT --- */}
      {showAddBusinessModal && (
        <div className="modal-overlay" onClick={() => setShowAddBusinessModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div className="section-title">🏪 Register New Food Establishment</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowAddBusinessModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddBusinessSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
              <div>
                <label className="form-label">Business / Hotel Name *</label>
                <input type="text" required placeholder="e.g. Vizag Bakers Hub" className="search-input" style={{ width: '100%' }} value={businessForm.business_name} onChange={e => setBusinessForm({ ...businessForm, business_name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">FSSAI License No *</label>
                <input type="text" required placeholder="e.g. AP-FSSAI-2024-9001" className="search-input" style={{ width: '100%' }} value={businessForm.license_number} onChange={e => setBusinessForm({ ...businessForm, license_number: e.target.value })} />
              </div>
              <div>
                <label className="form-label">GVMC Ward</label>
                <select className="select-filter" style={{ width: '100%' }} value={businessForm.ward} onChange={e => setBusinessForm({ ...businessForm, ward: e.target.value })}>
                  <option value="Ward 1">Ward 1</option>
                  <option value="Ward 2">Ward 2</option>
                  <option value="Ward 3">Ward 3</option>
                  <option value="Ward 4">Ward 4</option>
                  <option value="Ward 5">Ward 5</option>
                </select>
              </div>
              <div>
                <label className="form-label">Risk Classification</label>
                <select className="select-filter" style={{ width: '100%' }} value={businessForm.risk_category} onChange={e => setBusinessForm({ ...businessForm, risk_category: e.target.value })}>
                  <option value="HIGH">HIGH Risk (6mo cycle)</option>
                  <option value="MEDIUM">MEDIUM Risk (12mo cycle)</option>
                  <option value="LOW">LOW Risk (12mo cycle)</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddBusinessModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={saving}>Register Business</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADMIN MODAL 3: ASSIGN INSPECTION --- */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div className="section-title">🎯 Assign Audit to Inspector</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowAssignModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div>
                <label className="form-label">FSSAI License No</label>
                <input type="text" readOnly className="search-input" style={{ width: '100%', background: 'var(--bg-elevated)' }} value={assignForm.license_number} />
              </div>

              <div>
                <label className="form-label">Assign To Inspector *</label>
                <select className="select-filter" style={{ width: '100%' }} value={assignForm.inspector_name} onChange={e => setAssignForm({ ...assignForm, inspector_name: e.target.value })}>
                  {officers.map(o => (
                    <option key={o.id} value={o.name}>👮 {o.name} ({o.emp_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Target Audit Due Date</label>
                <input type="date" required className="search-input" style={{ width: '100%' }} value={assignForm.due_date} onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={saving}>Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INSPECTOR MODAL: RECORD VIOLATION --- */}
      {showViolationModal && (
        <div className="modal-overlay" onClick={() => setShowViolationModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div className="section-title">⚠️ Record Food Safety Violation</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowViolationModal(false)}>✕</button>
            </div>

            <form onSubmit={handleViolationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div>
                <label className="form-label">FSSAI License No *</label>
                <input type="text" required className="search-input" style={{ width: '100%' }} value={violationForm.license_number} onChange={e => setViolationForm({ ...violationForm, license_number: e.target.value })} />
              </div>

              <div>
                <label className="form-label">Violation Category *</label>
                <select className="select-filter" style={{ width: '100%' }} value={violationForm.violation_type} onChange={e => setViolationForm({ ...violationForm, violation_type: e.target.value })}>
                  <option value="Pest Evidence">Pest Evidence (Infestation/Droppings)</option>
                  <option value="Expired Food Stock">Expired Food Ingredients / Adulterants</option>
                  <option value="Water Quality Certification Expired">Water Quality / Testing Report Expired</option>
                  <option value="Hygiene Breach">Hygiene / Equipment Grease Trap Violation</option>
                  <option value="Unlicensed Operations">Unlicensed / Expired FSSAI Display</option>
                </select>
              </div>

              <div>
                <label className="form-label">Violation Severity</label>
                <select className="select-filter" style={{ width: '100%' }} value={violationForm.severity} onChange={e => setViolationForm({ ...violationForm, severity: e.target.value })}>
                  <option value="CRITICAL">CRITICAL (Immediate Seizure / Notice)</option>
                  <option value="MAJOR">MAJOR (Pest/Water Notice Issued)</option>
                  <option value="MINOR">MINOR (Rectification Required)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Inspector Remarks &amp; Evidence Log</label>
                <textarea rows="3" required className="search-input" style={{ width: '100%' }} placeholder="Describe seized items, pest locations, or warning notice details..." value={violationForm.remarks} onChange={e => setViolationForm({ ...violationForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowViolationModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" style={{ background: 'var(--accent-rose)', color: '#fff' }} disabled={saving}>Log Violation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG NEW INSPECTION MODAL --- */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div className="section-title">📝 Record FSSAI Field Inspection</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowLogModal(false)}>✕</button>
            </div>

            <form onSubmit={handleLogSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
              <div>
                <label className="form-label">Business Name *</label>
                <input type="text" required placeholder="Hotel Sea View" className="search-input" style={{ width: '100%' }} value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
              </div>

              <div>
                <label className="form-label">GVMC Ward *</label>
                <select className="select-filter" style={{ width: '100%' }} value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })}>
                  <option value="Ward 1">Ward 1 (Siripuram)</option>
                  <option value="Ward 2">Ward 2 (Dwaraka Nagar)</option>
                  <option value="Ward 3">Ward 3 (Gajuwaka)</option>
                  <option value="Ward 4">Ward 4 (MVP Colony)</option>
                  <option value="Ward 5">Ward 5 (Jagadamba)</option>
                </select>
              </div>

              <div>
                <label className="form-label">FSSAI License No. *</label>
                <input type="text" required placeholder="AP-FSSAI-2023-1001" className="search-input" style={{ width: '100%' }} value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
              </div>

              <div>
                <label className="form-label">Risk Classification</label>
                <select className="select-filter" style={{ width: '100%' }} value={form.risk_category} onChange={e => handleDateOrRiskChange('risk_category', e.target.value)}>
                  <option value="HIGH">HIGH Risk (6mo cycle)</option>
                  <option value="MEDIUM">MEDIUM Risk (12mo cycle)</option>
                  <option value="LOW">LOW Risk (12mo cycle)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Hygiene Rating</label>
                <select className="select-filter" style={{ width: '100%' }} value={form.hygiene_rating} onChange={e => setForm({ ...form, hygiene_rating: e.target.value })}>
                  <option value="Grade A (Excellent)">Grade A (Excellent)</option>
                  <option value="Grade B (Satisfactory)">Grade B (Satisfactory)</option>
                  <option value="Grade C (Needs Improvement)">Grade C (Needs Improvement)</option>
                  <option value="Grade D (Critical Non-Compliance)">Grade D (Critical Non-Compliance)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Inspection Date *</label>
                <input type="date" required className="search-input" style={{ width: '100%' }} value={form.inspection_date} onChange={e => handleDateOrRiskChange('inspection_date', e.target.value)} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Inspector Name</label>
                <input type="text" className="search-input" style={{ width: '100%' }} value={form.inspector_name} onChange={e => setForm({ ...form, inspector_name: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Audit Findings</label>
                <textarea rows="3" className="search-input" style={{ width: '100%' }} placeholder="Enter detailed observations..." value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={saving}>Save FSSAI Inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- HISTORY TIMELINE DRAWER --- */}
      {selectedHistory && (
        <div className="modal-overlay" onClick={() => setSelectedHistory(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div>
                <div className="section-title">{selectedHistory.business_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedHistory.ward} · License <span className="mono-tag">{selectedHistory.license_number}</span>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setSelectedHistory(null)}>✕</button>
            </div>

            {/* Recorded Violations Section */}
            {selectedHistory.violations && selectedHistory.violations.length > 0 && (
              <div style={{ margin: '14px 0', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fda4af', marginBottom: '8px' }}>
                  ⚠️ Recorded Food Safety Violations ({selectedHistory.violations.length})
                </div>
                {selectedHistory.violations.map(v => (
                  <div key={v.id} style={{ fontSize: '12px', color: 'var(--text-main)', marginBottom: '6px' }}>
                    <strong style={{ color: 'var(--accent-rose)' }}>[{v.severity}] {v.violation_type}:</strong> {v.remarks}
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ fontSize: '15px', color: 'var(--text-main)', margin: '16px 0 12px' }}>
              📜 FSSAI Audit History Log ({historyLogs.length} events)
            </h3>

            {loadingHistory ? (
              <div className="loading">Fetching inspection logs...</div>
            ) : (
              <div>
                {historyLogs.map((log, i) => (
                  <div key={log.id || i} className="timeline-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>Audit Date: {log.inspection_date}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Inspector: {log.inspector_name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>Findings:</strong> {log.findings}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- GPS LOCATION & ROUTE NAVIGATION MODAL --- */}
      {showLocationModal && selectedLocationItem && (
        <div className="modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal-container" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="section-header">
              <div>
                <div className="section-title">🗺️ Live GPS Navigation &amp; Turn-by-Turn Route</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Exact device location route to <strong>{selectedLocationItem.business_name}</strong>
                </p>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setShowLocationModal(false)}>✕</button>
            </div>

            {/* Visual GPS Route Card */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '20px', borderRadius: '16px', color: '#ffffff', marginBottom: '18px', border: '1.5px solid var(--accent-blue)', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>Destination Restaurant</span>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>{selectedLocationItem.business_name}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className="mono-tag" style={{ background: 'rgba(37, 99, 235, 0.3)', color: '#60a5fa', border: '1px solid rgba(37, 99, 235, 0.5)' }}>{selectedLocationItem.license_number}</span>
                  <span style={{ fontSize: '11px', color: '#34d399', fontWeight: '700' }}>Ward: {selectedLocationItem.ward}</span>
                </div>
              </div>

              {/* Route Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8' }}>📍 Your Exact Device Location:</span>
                    <button
                      type="button"
                      style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={getLiveInspectorLocation}
                      disabled={locating}
                    >
                      {locating ? 'Locating...' : '🔄 Refresh GPS'}
                    </button>
                  </div>
                  <strong style={{ color: '#38bdf8', fontSize: '13px' }}>{inspectorCoords.address}</strong>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>🏁 Destination Restaurant Address:</span>
                  <strong style={{ color: '#34d399', fontSize: '13px' }}>{selectedLocationItem.address || `${selectedLocationItem.ward}, Visakhapatnam`}</strong>
                </div>
              </div>

              {/* Live Interactive Map Iframe Preview */}
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(59, 130, 246, 0.4)', height: '200px', marginBottom: '14px', background: '#070a12' }}>
                <iframe
                  title="Live GPS Route Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${(inspectorCoords.lng || 83.3012) - 0.02}%2C${(inspectorCoords.lat || 17.7231) - 0.02}%2C${(inspectorCoords.lng || 83.3012) + 0.02}%2C${(inspectorCoords.lat || 17.7231) + 0.02}&layer=mapnik&marker=${inspectorCoords.lat || 17.7231}%2C${inspectorCoords.lng || 83.3012}`}
                  style={{ filter: 'contrast(1.05)' }}
                />
              </div>

              {/* Live Route Banner */}
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: '10px', textAlign: 'center', border: '1px dashed rgba(59, 130, 246, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span>📍 Your GPS Position</span>
                <span style={{ color: '#38bdf8', fontWeight: '800' }}>━━━━━━ 🚗 Exact Turn-by-Turn Route ━━━━━━▶</span>
                <span>🏁 {selectedLocationItem.business_name}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${inspectorCoords.lat || 17.7231},${inspectorCoords.lng || 83.3012}&destination=${encodeURIComponent(selectedLocationItem.business_name + ', ' + (selectedLocationItem.address || selectedLocationItem.ward) + ', Visakhapatnam, Andhra Pradesh')}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn primary"
                style={{ textDecoration: 'none', padding: '10px 20px', fontSize: '13px', background: 'linear-gradient(135deg, #059669, #047857)', color: '#ffffff' }}
              >
                🗺️ Open Turn-by-Turn Route in Google Maps 🚀
              </a>
              <button
                className="btn secondary"
                onClick={() => {
                  setShowLocationModal(false)
                  handleStartInspection(selectedLocationItem)
                }}
              >
                ⚡ Start Inspection at this Restaurant
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Toast Notifications */}
      <div className="toast-container">

        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span>ℹ️</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

