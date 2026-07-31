const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'inspections.json');
const officersPath = path.join(__dirname, 'officers.json');
const violationsPath = path.join(__dirname, 'violations.json');

// Initialize database files if they don't exist
function initDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(officersPath)) {
    fs.writeFileSync(officersPath, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(violationsPath)) {
    fs.writeFileSync(violationsPath, JSON.stringify([], null, 2));
  }
}

// Read inspection events
function readAll() {
  if (!fs.existsSync(dbPath)) return [];
  const data = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(data || '[]');
}

// Write inspection events
function writeAll(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Read officers
function readOfficers() {
  if (!fs.existsSync(officersPath)) return [];
  const data = fs.readFileSync(officersPath, 'utf8');
  return JSON.parse(data || '[]');
}

// Write officers
function writeOfficers(data) {
  fs.writeFileSync(officersPath, JSON.stringify(data, null, 2));
}

// Read violations
function readViolations() {
  if (!fs.existsSync(violationsPath)) return [];
  const data = fs.readFileSync(violationsPath, 'utf8');
  return JSON.parse(data || '[]');
}

// Write violations
function writeViolations(data) {
  fs.writeFileSync(violationsPath, JSON.stringify(data, null, 2));
}

// Date-only comparison helpers
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isPast(dateStr) {
  if (!dateStr) return false;
  return dateStr < todayStr();
}
function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const t = new Date(todayStr()).getTime();
  const d = new Date(dateStr).getTime();
  return Math.round((d - t) / 86400000);
}

// --- AUTHENTICATION ---
function authenticateUser(email, password) {
  const officers = readOfficers();
  const user = officers.find(
    o => o.email.toLowerCase() === (email || '').toLowerCase() && o.password === password
  );
  if (!user) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// --- IN-MEMORY OTP STORE FOR INSPECTOR MOBILE LOGIN ---
const otpStore = new Map();

function cleanPhone(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

function cleanName(n) {
  return String(n || '').trim().toLowerCase();
}

function requestInspectorOtp(name, phone) {
  const officers = readOfficers();
  const targetPhone = cleanPhone(phone);
  const targetName = cleanName(name);

  if (!targetPhone || !targetName) {
    return { success: false, message: 'Please provide both Inspector Name and Mobile Phone Number.' };
  }

  // Match by Name and Phone Number
  const officer = officers.find(o => {
    const oName = cleanName(o.name);
    const oPhone = cleanPhone(o.phone);
    return (oName === targetName || oName.includes(targetName) || targetName.includes(oName)) && oPhone === targetPhone;
  });

  if (!officer) {
    return {
      success: false,
      message: `No registered Field Inspector found matching Name "${name}" and Phone Number "${phone}". Please check details or contact Admin.`
    };
  }

  // Demo OTP: '4289'
  const otp = '4289';
  otpStore.set(targetPhone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    officer
  });

  return {
    success: true,
    otp,
    phone: targetPhone,
    inspectorName: officer.name,
    message: `OTP sent successfully to +91 ${targetPhone}`
  };
}

function verifyInspectorOtp(phone, otpInput) {
  const targetPhone = cleanPhone(phone);
  const record = otpStore.get(targetPhone);

  if (!record) {
    return { success: false, message: 'OTP session expired or not found. Please request a new OTP.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(targetPhone);
    return { success: false, message: 'OTP has expired. Please request a new OTP.' };
  }

  if (String(otpInput).trim() !== record.otp) {
    return { success: false, message: 'Invalid OTP entered. Please enter the 4-digit code (Demo Code: 4289).' };
  }

  otpStore.delete(targetPhone);
  const { password: _, ...userWithoutPassword } = record.officer;
  return { success: true, user: userWithoutPassword };
}

// --- ADMIN: CREATE NEW INSPECTOR ---
function createOfficer(officerData) {
  const officers = readOfficers();
  const newId = officers.length ? Math.max(...officers.map(o => o.id)) + 1 : 1;
  const newOfficer = {
    id: newId,
    name: officerData.name,
    emp_id: officerData.emp_id || `GVMC-FSSAI-${String(newId).padStart(3, '0')}`,
    email: officerData.email || `${officerData.name.toLowerCase().replace(/\s+/g, '')}@gvmc.gov.in`,
    password: officerData.password || 'officer123',
    role: officerData.role || 'INSPECTOR',
    designation: officerData.designation || 'FSSAI Inspector',
    assigned_wards: Array.isArray(officerData.assigned_wards)
      ? officerData.assigned_wards
      : [officerData.assigned_wards || 'Ward 1'],
    phone: officerData.phone || '9849012345',
    created_at: new Date().toISOString()
  };
  officers.push(newOfficer);
  writeOfficers(officers);
  return newOfficer;
}


// --- ADMIN: CREATE NEW ESTABLISHMENT ---
function createBusiness(businessData) {
  const all = readAll();
  const newId = all.length ? Math.max(...all.map(i => i.id)) + 1 : 1;
  const record = {
    id: newId,
    business_name: businessData.business_name,
    ward: businessData.ward,
    license_number: businessData.license_number,
    business_type: businessData.business_type || 'Restaurant / Eatery',
    risk_category: businessData.risk_category || 'MEDIUM',
    hygiene_rating: businessData.hygiene_rating || 'Grade B (Satisfactory)',
    inspection_date: businessData.inspection_date || todayStr(),
    inspector_name: null,
    assigned_inspector_name: businessData.assigned_inspector_name || null,
    status: businessData.assigned_inspector_name ? 'Assigned' : 'Unassigned',
    findings: businessData.findings || 'Newly registered establishment. Pending inspector assignment by Admin.',
    next_due_date: businessData.next_due_date || todayStr(),
    dispatch_status: 'NONE',
    created_at: new Date().toISOString()
  };
  all.push(record);
  writeAll(all);
  return record;
}

// --- ADMIN: ASSIGN INSPECTION TO INSPECTOR ---
function assignInspection(licenseNumber, inspectorName, dueDate, notes) {
  const all = readAll();
  const matching = all.filter(item => item.license_number === licenseNumber);
  if (!matching.length) return null;

  matching.sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date));
  const latest = matching[0];

  const index = all.findIndex(item => item.id === latest.id);
  all[index].assigned_inspector_name = inspectorName;
  all[index].inspector_name = inspectorName;
  all[index].status = 'Assigned';
  if (dueDate) all[index].next_due_date = dueDate;
  all[index].assignment_notes = notes || `Inspection assigned to ${inspectorName}.`;
  all[index].assignment_status = 'ASSIGNED';
  all[index].assigned_at = new Date().toISOString();

  writeAll(all);
  return all[index];
}


// --- INSPECTOR: RECORD VIOLATION ---
function recordViolation(licenseNumber, violationType, severity, remarks, inspectorName) {
  const violations = readViolations();
  const newViolation = {
    id: violations.length + 1,
    license_number: licenseNumber,
    violation_type: violationType, // 'PEST_EVIDENCE' | 'EXPIRED_STOCK' | 'WATER_QUALITY' | 'HYGIENE_BREACH'
    severity: severity || 'MAJOR', // 'CRITICAL' | 'MAJOR' | 'MINOR'
    remarks: remarks || 'Non-compliance observed during audit.',
    inspector_name: inspectorName || 'FSSAI Inspector',
    logged_at: new Date().toISOString()
  };
  violations.push(newViolation);
  writeViolations(violations);
  return newViolation;
}

// --- OFFICER PERFORMANCE SCORECARD ---
function getOfficersWithScorecard() {
  const officers = readOfficers();
  const inspections = readAll();
  const businesses = getBusinesses();

  return officers
    .filter(o => o.role === 'INSPECTOR' || o.role === 'OFFICER')
    .map(officer => {
      const officerInspections = inspections.filter(i =>
        (i.inspector_name && i.inspector_name.toLowerCase().includes(officer.name.toLowerCase())) ||
        (i.assigned_inspector_name && i.assigned_inspector_name.toLowerCase().includes(officer.name.toLowerCase()))
      );

      const totalAudits = officerInspections.length;
      const onTimeAudits = officerInspections.filter(i => {
        return i.findings && !i.findings.toLowerCase().includes('critical') && !i.findings.toLowerCase().includes('expired');
      }).length;

      const onTimeRate = totalAudits ? Math.round((onTimeAudits / totalAudits) * 100) : 85;

      const assignedWards = officer.assigned_wards || [];
      const wardBusinesses = businesses.filter(b => assignedWards.includes(b.ward));
      const totalWardUnits = wardBusinesses.length;
      const overdueWardUnits = wardBusinesses.filter(b => b.status === 'OVERDUE').length;

      const complianceRate = totalWardUnits
        ? Math.round(((totalWardUnits - overdueWardUnits) / totalWardUnits) * 100)
        : 80;

      const volumeBonus = Math.min(20, totalAudits * 2);
      const overallScore = Math.min(99, Math.round((onTimeRate * 0.4) + (complianceRate * 0.4) + volumeBonus));

      let grade = 'A';
      if (overallScore >= 90) grade = 'A+';
      else if (overallScore >= 80) grade = 'A';
      else if (overallScore >= 70) grade = 'B';
      else grade = 'C';

      return {
        id: officer.id,
        name: officer.name,
        emp_id: officer.emp_id,
        email: officer.email,
        designation: officer.designation || 'FSSAI Inspector',
        assigned_wards: officer.assigned_wards || [],
        phone: officer.phone || '+91 98480 12345',
        total_inspections: totalAudits,
        on_time_rate: onTimeRate,
        ward_compliance_rate: complianceRate,
        overall_score: overallScore,
        performance_grade: grade,
      };
    });
}

// --- ADMIN: ASSIGN INSPECTION TO INSPECTOR ---

function assignInspection(licenseNumber, inspectorName, dueDate, notes) {
  const all = readAll();
  let updatedRecord = null;

  for (let i = 0; i < all.length; i++) {
    if (all[i].license_number === licenseNumber) {
      all[i].assigned_inspector_name = inspectorName;
      all[i].inspector_name = inspectorName;
      all[i].status = 'Assigned';
      if (dueDate) all[i].next_due_date = dueDate;
      all[i].assignment_notes = notes || `Inspection assigned to ${inspectorName}.`;
      all[i].assignment_status = 'ASSIGNED';
      all[i].assigned_at = new Date().toISOString();
      updatedRecord = all[i];
    }
  }

  if (updatedRecord) {
    writeAll(all);
  }
  return updatedRecord;
}

// --- INSPECTOR: RECORD VIOLATION ---
function recordViolation(licenseNumber, violationType, severity, remarks, inspectorName) {
  const violations = readViolations();
  const newId = violations.length ? Math.max(...violations.map(v => v.id)) + 1 : 1;
  const newViolation = {
    id: newId,
    license_number: licenseNumber,
    violation_type: violationType,
    severity: severity || 'MAJOR',
    remarks: remarks,
    inspector_name: inspectorName || 'GVMC Inspector',
    recorded_at: new Date().toISOString()
  };
  violations.push(newViolation);
  writeViolations(violations);
  return newViolation;
}

// --- INSPECTOR MODULE CORE FUNCTIONS ---
function startInspection(id) {
  const all = readAll();
  const index = all.findIndex(item => item.id === Number(id));
  if (index === -1) return null;

  all[index].status = 'In Progress';
  all[index].started_at = new Date().toISOString();
  writeAll(all);
  return all[index];
}

function submitInspection(id, formData) {
  const all = readAll();
  const index = all.findIndex(item => item.id === Number(id));
  if (index === -1) return null;

  const score = Number(formData.hygiene_score) || 85;
  let ratingGrade = 'Grade A (Excellent)';
  if (score < 60) ratingGrade = 'Grade D (Critical Non-Compliance)';
  else if (score < 75) ratingGrade = 'Grade C (Needs Improvement)';
  else if (score < 85) ratingGrade = 'Grade B (Satisfactory)';

  all[index].status = 'Completed';
  all[index].hygiene_score = score;
  all[index].hygiene_rating = ratingGrade;
  all[index].completed_at = new Date().toISOString();
  all[index].inspection_date = todayStr();
  all[index].remarks = formData.remarks || all[index].remarks;
  all[index].checklist = formData.checklist || all[index].checklist;
  all[index].violation_count = Number(formData.violation_count) || 0;
  all[index].violation_category = formData.violation_category || 'Cleanliness';
  all[index].photo_url = formData.photo_url || all[index].photo_url || null;

  writeAll(all);


  const updated = all[index];

  // If violations exist, log to violations.json
  if (Number(formData.violation_count) > 0) {
    recordViolation(
      all[index].license_number,
      formData.violation_category || 'Cleanliness',
      'MAJOR',
      formData.remarks || 'Violation recorded during audit.',
      all[index].inspector_name || all[index].assigned_inspector_name
    );
  }

  return updated;
}

function getInspectorStats(inspectorName) {
  const businesses = getBusinesses();
  const today = todayStr();
  const currentMonth = today.substring(0, 7); // 'YYYY-MM'

  const myAudits = businesses.filter(item =>
    item.assigned_inspector_name &&
    (item.assigned_inspector_name.toLowerCase().includes(inspectorName.toLowerCase()) ||
     inspectorName.toLowerCase().includes(item.assigned_inspector_name.toLowerCase()))
  );

  const pending = myAudits.filter(i => i.status !== 'Completed');
  const completedToday = myAudits.filter(i => i.status === 'Completed' && i.completed_at && i.completed_at.startsWith(today));
  const completedThisMonth = myAudits.filter(i => i.status === 'Completed' && ((i.inspection_date && i.inspection_date.startsWith(currentMonth)) || (i.completed_at && i.completed_at.startsWith(currentMonth))));
  const highPriority = myAudits.filter(i => i.status !== 'Completed' && i.priority === 'HIGH');
  const upcoming = myAudits.filter(i => i.status !== 'Completed' && i.inspection_date >= today);

  return {
    total_assigned: myAudits.length,
    pending_inspections: pending.length,
    completed_today: completedToday.length,
    completed_this_month: completedThisMonth.length,
    high_priority_inspections: highPriority.length,
    upcoming_inspections: upcoming.length
  };
}



// Get all history logs for a specific license number

function getHistory(licenseNumber) {
  const all = readAll();
  return all
    .filter(item => item.license_number === licenseNumber)
    .sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date));
}

// Latest inspection event per licensed business (by license_number)
function getBusinesses() {
  const all = readAll();
  const violations = readViolations();
  const byLicense = new Map();
  const historyCounts = new Map();

  for (const rec of all) {
    const lic = rec.license_number;
    historyCounts.set(lic, (historyCounts.get(lic) || 0) + 1);

    const existing = byLicense.get(lic);
    if (!existing || rec.inspection_date > existing.inspection_date) {
      byLicense.set(lic, rec);
    }
  }

  const businesses = [];
  for (const [license, rec] of byLicense) {
    const overdue = isPast(rec.next_due_date);
    const unitViolations = violations.filter(v => v.license_number === license);

    businesses.push({
      ...rec,
      business_type: rec.business_type || 'Food Business',
      risk_category: rec.risk_category || 'MEDIUM',
      hygiene_rating: rec.hygiene_rating || 'Grade B (Satisfactory)',
      assigned_inspector_name: rec.assigned_inspector_name || null,
      dispatch_status: rec.dispatch_status || 'NONE',
      dispatched_at: rec.dispatched_at || null,
      status: rec.status || (overdue ? 'OVERDUE' : 'CURRENT'),
      is_overdue: overdue,
      days_overdue: overdue ? -daysUntil(rec.next_due_date) : daysUntil(rec.next_due_date),
      history_count: historyCounts.get(license) || 1,
      violations: unitViolations
    });
  }
  return businesses;
}


// Full append-only log, with optional filters
function getAll(filters = {}) {
  let log = readAll();
  if (filters.ward) {
    log = log.filter(item => item.ward === filters.ward);
  }
  if (filters.risk_category) {
    log = log.filter(item => item.risk_category === filters.risk_category);
  }
  if (filters.overdue === 'true') {
    log = log.filter(item => isPast(item.next_due_date));
  } else if (filters.overdue === 'false') {
    log = log.filter(item => !isPast(item.next_due_date));
  }
  return log;
}

// Find an event by id
function findById(id) {
  return readAll().find(item => item.id === parseInt(id));
}

// Create a new inspection event
function create(inspection) {
  const all = readAll();
  const newId = all.length ? Math.max(...all.map(i => i.id)) + 1 : 1;
  const record = {
    id: newId,
    business_name: inspection.business_name,
    ward: inspection.ward,
    license_number: inspection.license_number,
    business_type: inspection.business_type || 'Restaurant / Eatery',
    risk_category: inspection.risk_category || 'MEDIUM',
    hygiene_rating: inspection.hygiene_rating || 'Grade B (Satisfactory)',
    inspection_date: inspection.inspection_date,
    inspector_name: inspection.inspector_name || 'GVMC FSSAI Officer',
    assigned_inspector_name: inspection.assigned_inspector_name || inspection.inspector_name || 'GVMC FSSAI Officer',
    findings: inspection.findings || 'Routine inspection completed.',
    next_due_date: inspection.next_due_date,
    dispatch_status: inspection.dispatch_status || 'NONE',
    dispatched_at: inspection.dispatched_at || null,
    created_at: new Date().toISOString()
  };
  all.push(record);
  writeAll(all);
  return record;
}

// Update an event by id
function update(id, updates) {
  const all = readAll();
  const index = all.findIndex(item => item.id === parseInt(id));
  if (index === -1) return null;
  all[index] = { ...all[index], ...updates };
  writeAll(all);
  return all[index];
}

// Dispatch an automated inspection notice for an overdue business
function dispatchNotice(licenseNumber, notes) {
  const all = readAll();
  const matching = all.filter(item => item.license_number === licenseNumber);
  if (!matching.length) return null;

  matching.sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date));
  const latest = matching[0];

  const index = all.findIndex(item => item.id === latest.id);
  all[index].dispatch_status = 'DISPATCHED';
  all[index].dispatched_at = new Date().toISOString();
  all[index].dispatch_notes = notes || 'Automated inspection notice generated by GVMC Public Health.';

  writeAll(all);
  return all[index];
}

// Delete an event by id
function remove(id) {
  const all = readAll();
  const next = all.filter(item => item.id !== parseInt(id));
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

// Overdue businesses (latest record per license is past due)
function getOverdue() {
  return getBusinesses()
    .filter(b => b.status === 'OVERDUE')
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

// Summary statistics for dashboard (per-business basis)
function getSummary() {
  const businesses = getBusinesses();
  const total = businesses.length;
  const overdue = businesses.filter(b => b.status === 'OVERDUE').length;
  const highRiskOverdue = businesses.filter(b => b.status === 'OVERDUE' && b.risk_category === 'HIGH').length;
  const wards = new Set(businesses.map(b => b.ward)).size;

  const byWard = {};
  const byRisk = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const b of businesses) {
    if (byRisk[b.risk_category] !== undefined) {
      byRisk[b.risk_category]++;
    }

    if (!byWard[b.ward]) {
      byWard[b.ward] = { total: 0, overdue: 0, high_risk_overdue: 0 };
    }
    byWard[b.ward].total++;
    if (b.status === 'OVERDUE') {
      byWard[b.ward].overdue++;
      if (b.risk_category === 'HIGH') {
        byWard[b.ward].high_risk_overdue++;
      }
    }
  }

  for (const w in byWard) {
    const wt = byWard[w].total;
    const wo = byWard[w].overdue;
    byWard[w].compliance_rate = wt ? Math.round(((wt - wo) / wt) * 100) : 0;
  }

  return {
    total_businesses: total,
    overdue_businesses: overdue,
    high_risk_overdue: highRiskOverdue,
    compliance_rate: total ? Math.round(((total - overdue) / total) * 100) : 0,
    wards_covered: wards,
    by_ward: byWard,
    by_risk: byRisk
  };
}

module.exports = {
  initDB,
  readAll,
  readOfficers,
  writeOfficers,
  readViolations,
  writeViolations,
  authenticateUser,
  requestInspectorOtp,
  verifyInspectorOtp,
  createOfficer,

  createBusiness,
  assignInspection,
  recordViolation,
  getOfficersWithScorecard,
  startInspection,
  submitInspection,
  getInspectorStats,
  getAll,
  findById,
  create,
  update,
  remove,
  getBusinesses,
  getHistory,
  dispatchNotice,
  getOverdue,
  getSummary
};