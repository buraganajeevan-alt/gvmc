const store = require('./store');
const fs = require('fs');
const path = require('path');

const today = new Date();
function offsetDays(days) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function offsetMonths(months) {
  const d = new Date(today);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Seed 4 Inspectors + Admin + Commissioner:
const officers = [
  {
    id: 1,
    name: 'GVMC Admin Officer',
    emp_id: 'GVMC-ADM-001',
    email: 'admin@gvmc.gov.in',
    password: 'admin123',
    role: 'ADMIN',
    designation: 'GVMC System Administrator',
    assigned_wards: ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'],
    phone: '+91 891 2749999'
  },
  {
    id: 2,
    name: 'Dr. P. Sharma',
    emp_id: 'GVMC-COMM-001',
    email: 'commissioner@gvmc.gov.in',
    password: 'comm123',
    role: 'COMMISSIONER',
    designation: 'Public Health Commissioner / Manager',
    assigned_wards: ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'],
    phone: '+91 891 2748888'
  },
  {
    id: 3,
    name: 'Ravi Kumar',
    emp_id: 'GVMC-FSSAI-088',
    email: 'rkumar@gvmc.gov.in',
    password: 'officer123',
    role: 'INSPECTOR',
    designation: 'Senior FSSAI Inspector',
    assigned_wards: ['Ward 1', 'Ward 2'],
    phone: '+91 98480 11223'
  },
  {
    id: 4,
    name: 'Suresh Rao',
    emp_id: 'GVMC-FSSAI-104',
    email: 'srao@gvmc.gov.in',
    password: 'officer123',
    role: 'INSPECTOR',
    designation: 'FSSAI Field Inspector',
    assigned_wards: ['Ward 1', 'Ward 3'],
    phone: '+91 98480 33445'
  },
  {
    id: 5,
    name: 'K. Naidu',
    emp_id: 'GVMC-FSSAI-112',
    email: 'knaidu@gvmc.gov.in',
    password: 'officer123',
    role: 'INSPECTOR',
    designation: 'FSSAI Field Inspector',
    assigned_wards: ['Ward 2', 'Ward 5'],
    phone: '+91 98480 55667'
  },
  {
    id: 6,
    name: 'Anitha Roy',
    emp_id: 'GVMC-FSSAI-118',
    email: 'aroy@gvmc.gov.in',
    password: 'officer123',
    role: 'INSPECTOR',
    designation: 'FSSAI Field Inspector',
    assigned_wards: ['Ward 4', 'Ward 5'],
    phone: '+91 98480 77889'
  }
];

// 20 Licensed Food Establishments Data
const establishments = [
  { name: 'Hotel Sea View', type: 'Hotel / Fine Dining', owner: 'P. Venkat Rao', address: 'Beach Road, Siripuram, Visakhapatnam', phone: '+91 98490 12001', ward: 'Ward 1', priority: 'HIGH', risk: 'HIGH' },
  { name: 'Sri Lakshmi Tiffin Center', type: 'Tiffin Center / Mess', owner: 'M. Satyanarayana', address: 'D.No 12-4-2, Siripuram Circle, Ward 1', phone: '+91 98490 12002', ward: 'Ward 1', priority: 'HIGH', risk: 'MEDIUM' },
  { name: 'Coastal Biryani House', type: 'Multi-Cuisine Restaurant', owner: 'K. Srinivasa Reddy', address: 'Beach Road, Opposite Park, Ward 1', phone: '+91 98490 12003', ward: 'Ward 1', priority: 'MEDIUM', risk: 'HIGH' },
  { name: 'Ganga Mess & Caterers', type: 'Mess & Catering', owner: 'G. Appa Rao', address: 'Main Road, Siripuram, Ward 1', phone: '+91 98490 12004', ward: 'Ward 1', priority: 'LOW', risk: 'LOW' },

  { name: 'Green Leaf Veg Restaurant', type: 'Restaurant / Eatery', owner: 'V. Ramanathan', address: 'RTC Complex Road, Dwaraka Nagar, Ward 2', phone: '+91 98490 12005', ward: 'Ward 2', priority: 'HIGH', risk: 'MEDIUM' },
  { name: 'Madras Cafe', type: 'Cafeteria & Snacks', owner: 'S. Sundaram', address: '4th Lane, Dwaraka Nagar, Ward 2', phone: '+91 98490 12006', ward: 'Ward 2', priority: 'MEDIUM', risk: 'LOW' },
  { name: 'Vizag Sweets & Bakery', type: 'Sweet Shop / Bakery', owner: 'R. Koteswara Rao', address: 'Diamond Park Road, Ward 2', phone: '+91 98490 12007', ward: 'Ward 2', priority: 'HIGH', risk: 'HIGH' },
  { name: 'Bay View Cloud Kitchen', type: 'Cloud Kitchen', owner: 'D. Rajesh Kumar', address: 'Sector 3, Dwaraka Nagar, Ward 2', phone: '+91 98490 12008', ward: 'Ward 2', priority: 'MEDIUM', risk: 'HIGH' },

  { name: 'Blue Ocean Industrial Mess', type: 'Industrial Mess', owner: 'N. Chandrasekhar', address: 'Industrial Area Phase 2, Gajuwaka, Ward 3', phone: '+91 98490 12009', ward: 'Ward 3', priority: 'HIGH', risk: 'HIGH' },
  { name: 'Annapurna Packaged Foods', type: 'Food Processing', owner: 'T. Rama Murthy', address: 'Autonagar Main Road, Ward 3', phone: '+91 98490 12010', ward: 'Ward 3', priority: 'LOW', risk: 'LOW' },
  { name: 'Royal Spice Restaurant', type: 'Multi-Cuisine Restaurant', owner: 'B. Jagadeesh', address: 'Gajuwaka Junction, Ward 3', phone: '+91 98490 12011', ward: 'Ward 3', priority: 'HIGH', risk: 'HIGH' },
  { name: 'Steel City Tiffins', type: 'Tiffin Center', owner: 'K. Subba Rao', address: 'Old Gajuwaka Market, Ward 3', phone: '+91 98490 12012', ward: 'Ward 3', priority: 'LOW', risk: 'LOW' },

  { name: 'Seven Hills Bakery', type: 'Bakery & Confectionery', owner: 'Y. Nageswara Rao', address: 'Sector 4, MVP Colony, Ward 4', phone: '+91 98490 12013', ward: 'Ward 4', priority: 'MEDIUM', risk: 'MEDIUM' },
  { name: 'Sagar Kanya Seafood Outlet', type: 'Meat & Seafood Vendor', owner: 'M. Fishery Board', address: 'MVP Fish Market Complex, Ward 4', phone: '+91 98490 12014', ward: 'Ward 4', priority: 'HIGH', risk: 'HIGH' },
  { name: 'MVP Family Restaurant', type: 'Family Restaurant', owner: 'C. Prabhakar', address: 'Double Road, MVP Colony, Ward 4', phone: '+91 98490 12015', ward: 'Ward 4', priority: 'HIGH', risk: 'MEDIUM' },
  { name: 'Ocean Breeze Juice Bar', type: 'Beverages & Juices', owner: 'A. Kishore', address: 'Sector 1, MVP Colony, Ward 4', phone: '+91 98490 12016', ward: 'Ward 4', priority: 'LOW', risk: 'LOW' },

  { name: 'Jagadamba Sweets & Savories', type: 'Sweet Shop & Bakery', owner: 'S. Govinda Swamy', address: 'Jagadamba Center Circle, Ward 5', phone: '+91 98490 12017', ward: 'Ward 5', priority: 'HIGH', risk: 'HIGH' },
  { name: 'Grand Central Fast Food', type: 'Fast Food Eatery', owner: 'P. Anand Kumar', address: 'Cinema Hall Road, Ward 5', phone: '+91 98490 12018', ward: 'Ward 5', priority: 'HIGH', risk: 'MEDIUM' },
  { name: 'Visakha Heritage Caterers', type: 'Catering Service', owner: 'L. Mohan Rao', address: 'Near Super Bazar, Jagadamba, Ward 5', phone: '+91 98490 12019', ward: 'Ward 5', priority: 'MEDIUM', risk: 'HIGH' },
  { name: 'City Central Ice Cream Parlor', type: 'Ice Cream & Desserts', owner: 'N. Tarun Kumar', address: 'Jagadamba Complex, Ward 5', phone: '+91 98490 12020', ward: 'Ward 5', priority: 'LOW', risk: 'LOW' }
];

// Seed 25 Inspection Records
const inspectionRecords = [
  // --- RAVI KUMAR (Assigned: 3, In Progress: 2, Completed Today: 1, Completed Month: 2) ---
  {
    business_name: 'Hotel Sea View',
    ward: 'Ward 1',
    license_number: 'AP-FSSAI-2023-1001',
    business_type: 'Hotel / Fine Dining',
    owner_name: 'P. Venkat Rao',
    address: 'Beach Road, Siripuram, Visakhapatnam',
    contact_number: '+91 98490 12001',
    priority: 'HIGH',
    status: 'In Progress',
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade B (Satisfactory)',
    findings: 'Commercial kitchen audit in progress. Oil sample sent for lab test.'
  },
  {
    business_name: 'Coastal Biryani House',
    ward: 'Ward 1',
    license_number: 'AP-FSSAI-2023-1003',
    business_type: 'Multi-Cuisine Restaurant',
    owner_name: 'K. Srinivasa Reddy',
    address: 'Beach Road, Opposite Park, Ward 1',
    contact_number: '+91 98490 12003',
    priority: 'HIGH',
    status: 'Assigned',
    inspection_date: offsetDays(1),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade B (Satisfactory)',
    findings: 'Mandatory 6-month high risk audit assigned.'
  },
  {
    business_name: 'Green Leaf Veg Restaurant',
    ward: 'Ward 2',
    license_number: 'AP-FSSAI-2023-2001',
    business_type: 'Restaurant / Eatery',
    owner_name: 'V. Ramanathan',
    address: 'RTC Complex Road, Dwaraka Nagar, Ward 2',
    contact_number: '+91 98490 12005',
    priority: 'MEDIUM',
    status: 'Assigned',
    inspection_date: offsetDays(2),
    next_due_date: offsetMonths(12),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'MEDIUM',
    hygiene_rating: 'Grade A (Excellent)',
    findings: 'Annual routine hygiene check.'
  },
  {
    business_name: 'Vizag Sweets & Bakery',
    ward: 'Ward 2',
    license_number: 'AP-FSSAI-2023-2003',
    business_type: 'Sweet Shop / Bakery',
    owner_name: 'R. Koteswara Rao',
    address: 'Diamond Park Road, Ward 2',
    contact_number: '+91 98490 12007',
    priority: 'HIGH',
    status: 'In Progress',
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade C (Needs Improvement)',
    findings: 'Expired synthetic food color inspection underway.'
  },
  {
    business_name: 'Bay View Cloud Kitchen',
    ward: 'Ward 2',
    license_number: 'AP-FSSAI-2023-2004',
    business_type: 'Cloud Kitchen',
    owner_name: 'D. Rajesh Kumar',
    address: 'Sector 3, Dwaraka Nagar, Ward 2',
    contact_number: '+91 98490 12008',
    priority: 'HIGH',
    status: 'Completed',
    completed_at: new Date().toISOString(),
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade A (Excellent)',
    hygiene_score: 92,
    violation_count: 0,
    violation_category: 'Cleanliness',
    checklist: { kitchen_cleanliness: 'Excellent', food_storage: 'Good', employee_hygiene: 'Excellent', water_quality: 'Good', license_valid: 'Yes' },
    findings: 'All kitchen surfaces sanitized. Water testing report verified.',
    remarks: 'Compliant with FSSAI regulations.'
  },
  {
    business_name: 'Sri Lakshmi Tiffin Center',
    ward: 'Ward 1',
    license_number: 'AP-FSSAI-2023-1002',
    business_type: 'Tiffin Center / Mess',
    owner_name: 'M. Satyanarayana',
    address: 'D.No 12-4-2, Siripuram Circle, Ward 1',
    contact_number: '+91 98490 12002',
    priority: 'MEDIUM',
    status: 'Completed',
    completed_at: offsetDays(-5) + 'T10:30:00.000Z',
    inspection_date: offsetDays(-5),
    next_due_date: offsetMonths(12),
    assigned_inspector_name: 'Ravi Kumar',
    inspector_name: 'Ravi Kumar',
    risk_category: 'MEDIUM',
    hygiene_rating: 'Grade C (Needs Improvement)',
    hygiene_score: 72,
    violation_count: 1,
    violation_category: 'Pest Control',
    checklist: { kitchen_cleanliness: 'Good', food_storage: 'Poor', employee_hygiene: 'Good', water_quality: 'Good', license_valid: 'Yes' },
    findings: 'Pest control records missing. Notice issued for 15-day compliance.',
    remarks: 'Follow up required for pest control log.'
  },

  // --- SURESH RAO (Assigned / Completed) ---
  {
    business_name: 'Blue Ocean Industrial Mess',
    ward: 'Ward 3',
    license_number: 'AP-FSSAI-2023-3001',
    business_type: 'Industrial Mess',
    owner_name: 'N. Chandrasekhar',
    address: 'Industrial Area Phase 2, Gajuwaka, Ward 3',
    contact_number: '+91 98490 12009',
    priority: 'HIGH',
    status: 'Assigned',
    inspection_date: offsetDays(1),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Suresh Rao',
    inspector_name: 'Suresh Rao',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade A (Excellent)',
    findings: 'High capacity mess audit scheduled.'
  },
  {
    business_name: 'Royal Spice Restaurant',
    ward: 'Ward 3',
    license_number: 'AP-FSSAI-2023-3003',
    business_type: 'Multi-Cuisine Restaurant',
    owner_name: 'B. Jagadeesh',
    address: 'Gajuwaka Junction, Ward 3',
    contact_number: '+91 98490 12011',
    priority: 'HIGH',
    status: 'In Progress',
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Suresh Rao',
    inspector_name: 'Suresh Rao',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade D (Critical Non-Compliance)',
    findings: 'Water quality certification expired >60 days.'
  },
  {
    business_name: 'Ganga Mess & Caterers',
    ward: 'Ward 1',
    license_number: 'AP-FSSAI-2023-1004',
    business_type: 'Mess & Catering',
    owner_name: 'G. Appa Rao',
    address: 'Main Road, Siripuram, Ward 1',
    contact_number: '+91 98490 12004',
    priority: 'LOW',
    status: 'Completed',
    completed_at: offsetDays(-2) + 'T14:15:00.000Z',
    inspection_date: offsetDays(-2),
    next_due_date: offsetMonths(12),
    assigned_inspector_name: 'Suresh Rao',
    inspector_name: 'Suresh Rao',
    risk_category: 'LOW',
    hygiene_rating: 'Grade B (Satisfactory)',
    hygiene_score: 84,
    violation_count: 0,
    violation_category: 'Cleanliness',
    checklist: { kitchen_cleanliness: 'Good', food_storage: 'Good', employee_hygiene: 'Good', water_quality: 'Good', license_valid: 'Yes' },
    findings: 'Routine inspection passed.',
    remarks: 'Compliant.'
  },

  // --- K. NAIDU ---
  {
    business_name: 'Madras Cafe',
    ward: 'Ward 2',
    license_number: 'AP-FSSAI-2023-2002',
    business_type: 'Cafeteria & Snacks',
    owner_name: 'S. Sundaram',
    address: '4th Lane, Dwaraka Nagar, Ward 2',
    contact_number: '+91 98490 12006',
    priority: 'LOW',
    status: 'Assigned',
    inspection_date: offsetDays(3),
    next_due_date: offsetMonths(12),
    assigned_inspector_name: 'K. Naidu',
    inspector_name: 'K. Naidu',
    risk_category: 'LOW',
    hygiene_rating: 'Grade B (Satisfactory)',
    findings: 'Routine annual check.'
  },
  {
    business_name: 'Jagadamba Sweets & Savories',
    ward: 'Ward 5',
    license_number: 'AP-FSSAI-2023-5001',
    business_type: 'Sweet Shop & Bakery',
    owner_name: 'S. Govinda Swamy',
    address: 'Jagadamba Center Circle, Ward 5',
    contact_number: '+91 98490 12017',
    priority: 'HIGH',
    status: 'In Progress',
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'K. Naidu',
    inspector_name: 'K. Naidu',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade B (Satisfactory)',
    findings: 'Batch testing of sweet color additives.'
  },

  // --- ANITHA ROY ---
  {
    business_name: 'Seven Hills Bakery',
    ward: 'Ward 4',
    license_number: 'AP-FSSAI-2023-4001',
    business_type: 'Bakery & Confectionery',
    owner_name: 'Y. Nageswara Rao',
    address: 'Sector 4, MVP Colony, Ward 4',
    contact_number: '+91 98490 12013',
    priority: 'MEDIUM',
    status: 'Assigned',
    inspection_date: offsetDays(1),
    next_due_date: offsetMonths(12),
    assigned_inspector_name: 'Anitha Roy',
    inspector_name: 'Anitha Roy',
    risk_category: 'MEDIUM',
    hygiene_rating: 'Grade A (Excellent)',
    findings: 'Routine bakery audit.'
  },
  {
    business_name: 'Sagar Kanya Seafood Outlet',
    ward: 'Ward 4',
    license_number: 'AP-FSSAI-2023-4002',
    business_type: 'Meat & Seafood Vendor',
    owner_name: 'M. Fishery Board',
    address: 'MVP Fish Market Complex, Ward 4',
    contact_number: '+91 98490 12014',
    priority: 'HIGH',
    status: 'In Progress',
    inspection_date: offsetDays(0),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: 'Anitha Roy',
    inspector_name: 'Anitha Roy',
    risk_category: 'HIGH',
    hygiene_rating: 'Grade C (Needs Improvement)',
    findings: 'Cold chain temperature verification in progress.'
  }
];

// Additional records to make 25 total
for (let i = 1; i <= 12; i++) {
  const est = establishments[(i + 4) % establishments.length];
  const inspName = officers[2 + (i % 4)].name;
  inspectionRecords.push({
    business_name: `${est.name} (Unit ${i})`,
    ward: est.ward,
    license_number: `AP-FSSAI-2023-${3000 + i}`,
    business_type: est.type,
    owner_name: est.owner,
    address: est.address,
    contact_number: est.phone,
    priority: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
    status: i % 3 === 0 ? 'Completed' : i % 2 === 0 ? 'Assigned' : 'In Progress',
    completed_at: i % 3 === 0 ? offsetDays(-i) + 'T11:00:00.000Z' : null,
    inspection_date: offsetDays(-i),
    next_due_date: offsetMonths(6),
    assigned_inspector_name: inspName,
    inspector_name: inspName,
    risk_category: est.risk,
    hygiene_rating: 'Grade B (Satisfactory)',
    hygiene_score: 80 + (i % 15),
    violation_count: i % 4 === 0 ? 1 : 0,
    violation_category: 'Storage',
    checklist: { kitchen_cleanliness: 'Good', food_storage: 'Good', employee_hygiene: 'Good', water_quality: 'Good', license_valid: 'Yes' },
    findings: `Historical audit log #${i} recorded.`,
    remarks: 'Routine inspection complete.'
  });
}

// Reset & write
fs.writeFileSync(path.join(__dirname, 'inspections.json'), '[]');
fs.writeFileSync(path.join(__dirname, 'officers.json'), '[]');
fs.writeFileSync(path.join(__dirname, 'violations.json'), '[]');

store.initDB();
store.writeOfficers(officers);

let count = 0;
for (const record of inspectionRecords) {
  store.create({
    ...record,
    created_at: new Date().toISOString()
  });
  count++;
}

console.log(`✅ Seeded ${count} inspection records across 20 establishments and 4 inspectors.`);
process.exit(0);