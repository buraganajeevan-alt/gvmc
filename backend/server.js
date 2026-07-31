const express = require('express');
const cors = require('cors');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// --- AUTHENTICATION ---
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = store.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please check email and password.' });
    }
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INSPECTOR OTP AUTHENTICATION ---
app.post('/api/auth/inspector/request-otp', (req, res) => {
  try {
    const { name, phone } = req.body;
    const result = store.requestInspectorOtp(name, phone);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/inspector/verify-otp', (req, res) => {
  try {
    const { phone, otp } = req.body;
    const result = store.verifyInspectorOtp(phone, otp);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json({ message: 'Inspector OTP verified successfully', user: result.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- OFFICERS DIRECTORY & PERFORMANCE SCORECARD ---
app.get('/api/officers', (req, res) => {
  try {
    const officers = store.getOfficersWithScorecard();
    res.json({ officers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN: ADD NEW INSPECTOR ---
app.post('/api/officers', (req, res) => {
  try {
    const { name, email, assigned_wards } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Inspector Name and Email are required.' });
    }
    const officer = store.createOfficer(req.body);
    res.status(201).json({ message: 'Inspector registered successfully', officer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN: ADD NEW ESTABLISHMENT ---
app.post('/api/businesses', (req, res) => {
  try {
    const { business_name, ward, license_number } = req.body;
    if (!business_name || !ward || !license_number) {
      return res.status(400).json({ error: 'Business Name, Ward, and License Number are required.' });
    }
    const business = store.createBusiness(req.body);
    res.status(201).json({ message: 'Establishment registered successfully', business });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message });
  }
});


// --- ADMIN: ASSIGN INSPECTION ---
app.post('/api/inspections/assign', (req, res) => {
  try {
    const { license_number, inspector_name, due_date, notes } = req.body;
    if (!license_number || !inspector_name) {
      return res.status(400).json({ error: 'License Number and Inspector Name are required' });
    }
    const updated = store.assignInspection(license_number, inspector_name, due_date, notes);
    if (!updated) {
      return res.status(404).json({ error: 'Establishment not found' });
    }
    res.json({ message: `Inspection assigned to ${inspector_name} successfully`, record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INSPECTOR: RECORD VIOLATION ---
app.post('/api/inspections/violations', (req, res) => {
  try {
    const { license_number, violation_type, severity, remarks, inspector_name } = req.body;
    if (!license_number || !violation_type) {
      return res.status(400).json({ error: 'License Number and Violation Type are required' });
    }
    const violation = store.recordViolation(license_number, violation_type, severity, remarks, inspector_name);
    res.status(201).json({ message: 'Violation recorded successfully', violation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INSPECTOR MODULE ENDPOINTS ---
app.get('/api/inspector/stats', (req, res) => {
  try {
    const inspectorName = req.query.name || 'Ravi Kumar';
    const stats = store.getInspectorStats(inspectorName);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inspections/:id/start', (req, res) => {
  try {
    const updated = store.startInspection(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Inspection record not found' });
    }
    res.json({ message: 'Inspection status updated to In Progress', record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inspections/:id/submit', (req, res) => {
  try {
    const updated = store.submitInspection(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Inspection record not found' });
    }
    res.json({ message: 'Inspection form submitted successfully and marked Completed', record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC CUSTOMER FEEDBACK ROUTE ---
app.post('/api/feedbacks', (req, res) => {
  try {
    const { license_number, business_name, rating, customer_name, customer_phone, comments } = req.body;
    if (!license_number || !business_name) {
      return res.status(400).json({ error: 'License number and business name are required.' });
    }
    const record = store.createFeedback({ license_number, business_name, rating, customer_name, customer_phone, comments });
    res.status(201).json({ message: 'Feedback submitted successfully', feedback: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/feedbacks', (req, res) => {
  try {
    const feedbacks = store.getFeedbacks();
    res.json({ feedbacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all inspections, optionally filtered by ward, risk_category, and/or overdue status


app.get('/api/inspections', (req, res) => {
  try {
    const filters = {};
    if (req.query.ward) filters.ward = req.query.ward;
    if (req.query.risk_category) filters.risk_category = req.query.risk_category;
    if (req.query.overdue === 'true' || req.query.overdue === 'false') filters.overdue = req.query.overdue;
    const inspections = store.getAll(filters);
    res.json({ inspections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single inspection by id
app.get('/api/inspections/:id', (req, res) => {
  try {
    const inspection = store.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json({ inspection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new inspection
app.post('/api/inspections', (req, res) => {
  try {
    const { business_name, ward, license_number, inspection_date, next_due_date } = req.body;
    if (!business_name || !ward || !license_number || !inspection_date || !next_due_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const newInspection = store.create(req.body);
    res.status(201).json({ id: newInspection.id, inspection: newInspection, message: 'Inspection logged successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update an inspection
app.put('/api/inspections/:id', (req, res) => {
  try {
    const updated = store.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json({ message: 'Inspection updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an inspection
app.delete('/api/inspections/:id', (req, res) => {
  try {
    const deleted = store.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json({ message: 'Inspection deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET per-business status (latest inspection per license) — core dashboard view
app.get('/api/businesses', (req, res) => {
  try {
    let businesses = store.getBusinesses();
    if (req.query.ward) {
      businesses = businesses.filter(b => b.ward === req.query.ward);
    }
    if (req.query.risk_category) {
      businesses = businesses.filter(b => b.risk_category === req.query.risk_category);
    }
    if (req.query.status === 'OVERDUE') {
      businesses = businesses.filter(b => b.status === 'OVERDUE');
    } else if (req.query.status === 'CURRENT') {
      businesses = businesses.filter(b => b.status === 'CURRENT');
    }
    res.json({ businesses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET inspection history timeline for a specific business license
app.get('/api/businesses/:license/history', (req, res) => {
  try {
    const history = store.getHistory(req.params.license);
    res.json({ license_number: req.params.license, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST dispatch automated inspection alert/notice to field team
app.post('/api/alerts/dispatch', (req, res) => {
  try {
    const { license_number, notes } = req.body;
    if (!license_number) {
      return res.status(400).json({ error: 'License number is required' });
    }
    const updated = store.dispatchNotice(license_number, notes);
    if (!updated) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json({ message: 'Inspection notice dispatched successfully to GVMC field officer', record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary statistics for dashboard
app.get('/api/dashboard/summary', (req, res) => {
  try {
    const summary = store.getSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET overdue inspections for alerts
app.get('/api/alerts/overdue', (req, res) => {
  try {
    const overdueInspections = store.getOverdue();
    res.json({ overdue_inspections: overdueInspections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export compliance report as CSV
app.get('/api/reports/export', (req, res) => {
  try {
    const businesses = store.getBusinesses();
    const headers = ['Business Name', 'Ward', 'License Number', 'Type', 'Risk Category', 'Hygiene Rating', 'Last Inspection Date', 'Inspector', 'Assigned Inspector', 'Next Due Date', 'Status', 'Days Overdue', 'Dispatch Status'];
    
    const rows = businesses.map(b => [
      `"${(b.business_name || '').replace(/"/g, '""')}"`,
      `"${b.ward}"`,
      `"${b.license_number}"`,
      `"${b.business_type}"`,
      `"${b.risk_category}"`,
      `"${b.hygiene_rating}"`,
      `"${b.inspection_date}"`,
      `"${b.inspector_name}"`,
      `"${b.assigned_inspector_name}"`,
      `"${b.next_due_date}"`,
      `"${b.status}"`,
      b.days_overdue,
      `"${b.dispatch_status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="GVMC_Food_Safety_Inspection_Report.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 GVMC Food Safety Monitoring Server running on port ${PORT}`);
});