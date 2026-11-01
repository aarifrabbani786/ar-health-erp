require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const connectionString = process.env.DATABASE_URL || "";
let pool = null;

if (connectionString) {
    try {
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });
        pool.connect()
            .then(() => console.log('Connected to PostgreSQL database successfully.'))
            .catch(err => console.error('Database connection warning:', err.message));
    } catch (e) {
        console.error('DB Init Error:', e.message);
    }
}

let dailySequence = { date: '', count: 0 };
function getNextUHID() {
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '').slice(0, 4) + new Date().getFullYear().toString().slice(-2);
    if (dailySequence.date !== todayStr) {
        dailySequence.date = todayStr;
        dailySequence.count = 1;
    } else {
        dailySequence.count += 1;
    }
    return `AR${todayStr}-${dailySequence.count.toString().padStart(2, '0')}`;
}

let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active' }
    ],
    patients: [
        { uhid: 'AR011126-01', title: 'Mr.', name: 'Aarif Rabbani', relation: 'S/O', guardian: 'Md Rabbani', age: 27, gender: 'Male', contact: '9876543210', adhaar: '123456789012', abha: 'ABHA12345678', address: 'Maharajganj, UP', doctor: 'Dr. A. Khan', fee: 500, payType: 'Cash', date: '2026-11-01 14:00' }
    ],
    doctors: [
        { id: 'DOC1', name: 'Dr. A. Khan (General Physician)', fee: 500 },
        { id: 'DOC2', name: 'Dr. Priya Singh (Gynecologist)', fee: 700 }
    ],
    bills: [
        { billNo: 'BILL-011126-01', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', doctor: 'Dr. A. Khan', totalFee: 500, payType: 'Cash', createdBy: 'Aarif (Super Admin)', dateTime: '2026-11-01 14:00' }
    ],
    medicines: [
        { medId: 'MED001', brandName: 'Paracetamol 650mg', generic: 'Paracetamol', batch: 'B2601', stock: 150, rate: 20.00, expiry: '2027-12-31' }
    ]
};

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const user = erpData.users.find(u => u.username === username && u.password === password);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid Username or Password' });
        if (user.status === 'Deactivated') return res.status(403).json({ success: false, message: 'Account deactivated.' });
        res.json({ success: true, user: { name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/users', (req, res) => res.json(erpData.users));
app.get('/api/doctors', (req, res) => res.json(erpData.doctors));
app.get('/api/next-uhid', (req, res) => res.json({ uhid: getNextUHID() }));

app.post('/api/patients/register', (req, res) => {
    try {
        const p = req.body;
        if (!/^\d{10}$/.test(p.contact)) return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });
        if (p.adhaar && !/^\d{12}$/.test(p.adhaar)) return res.status(400).json({ success: false, message: 'Aadhaar must be exactly 12 digits.' });

        const uhid = getNextUHID();
        const nowStr = new Date().toLocaleString('en-GB');

        const newPatient = {
            uhid, title: p.title || 'Mr.', name: p.name, relation: p.relation || 'C/O', guardian: p.guardian || '',
            age: p.age, gender: p.gender, contact: p.contact, adhaar: p.adhaar || '', abha: p.abha || '',
            address: p.address || '', doctor: p.doctor, fee: Number(p.fee || 0), payType: p.payType || 'Cash', date: nowStr
        };
        erpData.patients.unshift(newPatient);

        const billNo = `BILL-${Date.now().toString().slice(-6)}`;
        const newBill = {
            billNo, uhid, patientName: p.title + ' ' + p.name, doctor: p.doctor, totalFee: p.fee,
            payType: p.payType, createdBy: p.createdBy || 'Staff', dateTime: nowStr
        };
        erpData.bills.unshift(newBill);

        res.json({ success: true, message: 'Patient Registered & Bill Generated', patient: newPatient, bill: newBill });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/patients/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    if (q.length < 2) return res.json([]);
    const results = erpData.patients.filter(p => 
        p.name.toLowerCase().includes(q) || p.contact.includes(q) || p.uhid.toLowerCase().includes(q) || (p.adhaar && p.adhaar.includes(q))
    );
    res.json(results);
});

app.get('/api/module/:key', (req, res) => {
    const key = req.params.key;
    if (['patients', 'patient-search', 'patients-reg'].includes(key)) return res.json({ success: true, data: erpData.patients });
    if (['medicines', 'pharmacy'].includes(key)) return res.json({ success: true, data: erpData.medicines });
    if (['doctors'].includes(key)) return res.json({ success: true, data: erpData.doctors });
    if (['hospital-billing', 'bills'].includes(key)) return res.json({ success: true, data: erpData.bills });
    res.json({ success: true, data: erpData.patients });
});

app.get('/api/dashboard/metrics', (req, res) => {
    let rev = erpData.bills.reduce((acc, b) => acc + Number(b.totalFee), 0);
    res.json({ success: true, totalRevenue: rev, registeredPatients: erpData.patients.length, activeIpdBeds: 2, lowStockItems: 1 });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AR Healthcare ERP | Hospital • Pharmacy • Biomedical</title>
<style>
:root{--navy:#10243a;--navy2:#173650;--blue:#2674e8;--cyan:#16b8b0;--bg:#f3f6fb;--card:#fff;--text:#18283d;--muted:#718096;--line:#e4eaf2;--green:#16875d;--red:#c93c48;--shadow:0 8px 28px rgba(23,44,75,.07)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}
#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:linear-gradient(135deg,#eef2f7 0%,#c9d6ff 100%);position:fixed;z-index:9999}
.login-container{background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(16,36,58,0.15);width:min(850px,92vw);height:520px;display:flex;overflow:hidden}
.login-left{flex:1.2;padding:50px 45px;display:flex;flex-direction:column;justify-content:center}
.login-left h2{font-size:26px;color:var(--navy);font-weight:800;margin-bottom:8px}
.login-left p{font-size:13px;color:var(--muted);margin-bottom:30px}
.login-right{flex:1;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:50px 40px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.login-field{margin-bottom:18px;text-align:left}
.login-field label{display:block;font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px}
.login-input{width:100%;padding:13px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:#f8fafc;outline:none}
.login-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--blue),#1d5ec4);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-top:10px}
#app{display:none;height:100vh;width:100vw;flex-direction:row}
.sidebar{width:272px;background:linear-gradient(180deg,var(--navy),#0d1c2c);color:#d9e6f5;display:flex;flex-direction:column;flex-shrink:0}
.brand{display:flex;align-items:center;gap:12px;padding:22px 18px;border-bottom:1px solid #ffffff18}
.logo{width:43px;height:43px;border-radius:13px;background:linear-gradient(135deg,#23c6b8,#3478f6);display:grid;place-items:center;color:white;font-weight:900;font-size:16px}
.brand strong{display:block;font-size:14px;color:#fff}
.brand small{display:block;color:#9db3ca;font-size:11px;margin-top:4px}
.nav{padding:12px 10px 30px;overflow-y:auto;flex:1}
.nav-label{font-size:10px;letter-spacing:1.5px;color:#7893ae;padding:16px 11px 7px;font-weight:800}
.nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;margin:2px 0;color:#c6d4e4;font-size:12.5px;border:0;background:transparent;width:100%;text-align:left;cursor:pointer}
.nav-item:hover,.nav-item.active{background:#ffffff15;color:#fff}
.nav-item.active{box-shadow:inset 3px 0 #29c7be;font-weight:700}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.topbar{height:74px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px}
.profile{display:flex;align-items:center;gap:12px}
.avatar{width:38px;height:38px;border-radius:12px;background:#e4efff;color:#2464c4;display:grid;place-items:center;font-weight:800;font-size:13px}
.content{padding:27px 28px;overflow-y:auto;flex:1}
.view-section{display:none}
.view-section.active{display:block}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:22px}
.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow)}
.stat-label{font-size:11px;color:var(--muted);font-weight:700}
.stat-value{font-size:26px;font-weight:800;margin:12px 0 4px;color:var(--navy)}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:22px;margin-bottom:22px}
.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.panel-head h3{font-size:15px;margin:0;color:var(--navy);font-weight:700}
.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:15px}
.field{display:flex;flex-direction:column;gap:6px;position:relative}
.field label{font-size:11px;font-weight:700;color:var(--navy)}
.field input,.field select{padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px;outline:none}
table{width:100%;border-collapse:collapse}
th{text-align:left;background:#f8fafd;color:#7a8a9e;font-size:10px;letter-spacing:.7px;text-transform:uppercase;padding:12px 16px;font-weight:800}
td{padding:13px 16px;border-top:1px solid #edf1f6;font-size:12px}
.btn{border:1px solid var(--line);background:#fff;color:var(--text);border-radius:9px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer}
.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.btn.success{background:var(--cyan);border-color:var(--cyan);color:#fff}
.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
.suggestions-box{position:absolute;top:65px;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.1);max-height:200px;overflow-y:auto;z-index:100;display:none}
.suggestion-item{padding:10px 12px;border-bottom:1px solid #f0f4f9;cursor:pointer;font-size:12px}
.suggestion-item:hover{background:#f0f6ff}
#print-modal{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;justify-content:center;align-items:center;z-index:99999}
.print-card{background:#fff;padding:30px;border-radius:16px;width:min(600px,95vw);box-shadow:0 20px 50px rgba(0,0,0,0.3)}
@media print{
  body *{visibility:hidden}
  #print-card-area, #print-card-area *{visibility:visible}
  #print-card-area{position:absolute;left:0;top:0;width:100%}
  .no-print{display:none!important}
}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-container">
    <div class="login-left">
      <h2>Sign In</h2>
      <p>Enter your credentials to access AR Healthcare ERP</p>
      <form onsubmit="handleLogin(event)">
        <div class="login-field"><label>Username</label><input type="text" id="login-u" class="login-input" placeholder="Username..." required></div>
        <div class="login-field"><label>Password</label><input type="password" id="login-p" class="login-input" placeholder="Password..." required></div>
        <button type="submit" class="login-btn">Sign In ➔</button>
      </form>
    </div>
    <div class="login-right">
      <h2>AR HEALTHCARE ERP</h2>
      <p style="font-size:13px;line-height:1.6;opacity:.85;">A R PHARMA AND SURGICAL AGENCY</p>
    </div>
  </div>
</div>

<div id="app">
  <aside class="sidebar">
    <div class="brand"><div class="logo">AR</div><div><strong>AR HEALTHCARE ERP</strong><small>Hospital • Pharmacy • Biomedical</small></div></div>
    <nav class="nav" id="nav-menu"></nav>
  </aside>

  <main class="main">
    <header class="topbar">
      <h3 id="topbar-title" style="font-size:17px;font-weight:700;color:var(--navy);">Dashboard</h3>
      <div class="profile">
        <div class="avatar" id="user-avatar">AR</div>
        <div><strong id="user-display-name" style="font-size:13px;display:block;">-</strong><small id="user-display-role" style="font-size:10px;color:var(--muted);">-</small></div>
        <button class="btn btn-sm danger" onclick="handleLogout()" style="margin-left:15px;">Logout</button>
      </div>
    </header>

    <section class="content">
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-label">TODAY'S REVENUE</div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">2 / 20</div></div>
          <div class="stat"><div class="stat-label">LOW STOCK ALERTS</div><div class="stat-value" id="m-stock">1</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Recent OPD Registrations & Payments</h3></div>
          <table>
            <thead><tr><th>UHID</th><th>Patient Name</th><th>Doctor</th><th>Fee (₹)</th><th>Payment Type</th><th>Date & Time</th></tr></thead>
            <tbody id="dash-patients"></tbody>
          </table>
        </div>
      </div>

      <div id="view-module-container" class="view-section">
        <div class="panel" id="patient-reg-panel" style="display:none;">
          <div class="panel-head"><h3>New Patient Registration & Consultation Billing</h3></div>
          <form onsubmit="handlePatientRegistration(event)">
            <div class="form-grid">
              <div class="field"><label>Auto UHID (Date-Wise)</label><input type="text" id="reg-uhid" readonly style="background:#edf2f7;font-weight:700;color:var(--blue);"></div>
              <div class="field"><label>Live Patient Search (Auto-Fetch)</label><input type="text" id="live-search-input" placeholder="Type Name, Mobile, Aadhaar..." oninput="handleLiveSearch(this.value)" autocomplete="off"><div class="suggestions-box" id="search-suggestions"></div></div>
              <div class="field"><label>Title</label><select id="reg-title"><option>Mr.</option><option>Mrs.</option><option>Miss</option><option>Master</option><option>Baby of</option></select></div>
              <div class="field"><label>Patient Name *</label><input type="text" id="reg-name" required></div>
              <div class="field"><label>Relation</label><select id="reg-relation"><option>S/O</option><option>D/O</option><option>W/O</option><option>C/O</option></select></div>
              <div class="field"><label>Father / Guardian Name</label><input type="text" id="reg-guardian"></div>
              <div class="field"><label>Age *</label><input type="number" id="reg-age" required></div>
              <div class="field"><label>Gender</label><select id="reg-gender"><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div class="field"><label>Mobile No (10-Digit Locked) *</label><input type="text" id="reg-contact" maxlength="10" pattern="[0-9]{10}" required placeholder="10 digits"></div>
              <div class="field"><label>Aadhaar No (12-Digit Locked)</label><input type="text" id="reg-adhaar" maxlength="12" pattern="[0-9]{12}" placeholder="12 digits"></div>
              <div class="field"><label>ABHA ID</label><input type="text" id="reg-abha" placeholder="ABHA Number"></div>
              <div class="field"><label>Address</label><input type="text" id="reg-address" placeholder="District, State"></div>
              <div class="field"><label>Consulting Doctor *</label><select id="reg-doctor" onchange="autoFetchDoctorFee()" required></select></div>
              <div class="field"><label>Doctor Fee (₹) *</label><input type="number" id="reg-fee" required></div>
              <div class="field"><label>Payment Type *</label><select id="reg-paytype"><option>Cash</option><option>UPI / Online</option><option>Card</option></select></div>
            </div>
            <button type="submit" class="btn primary" style="padding:12px 25px;font-size:13px;">💾 Register Patient & Save Bill</button>
          </form>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h3 id="module-title-heading">Module Records</h3>
            <button class="btn primary btn-sm" id="module-add-btn" style="display:none;" onclick="togglePatientForm()">+ New Registration</button>
          </div>
          <div style="overflow-x:auto;">
            <table>
              <thead id="module-thead"></thead>
              <tbody id="module-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>

<div id="print-modal">
  <div class="print-card" id="print-card-area">
    <div style="text-align:center;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:15px;">
      <h2 style="margin:0;color:var(--navy);">A R PHARMA AND SURGICAL AGENCY</h2>
      <p style="margin:4px 0;font-size:12px;color:var(--muted);">Hospital Management & OPD Consultation Invoice</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:15px;">
      <div><strong>Bill No:</strong> <span id="pb-billno"></span></div>
      <div><strong>Date & Time:</strong> <span id="pb-datetime"></span></div>
      <div><strong>UHID:</strong> <span id="pb-uhid"></span></div>
      <div><strong>User / Staff:</strong> <span id="pb-user"></span></div>
    </div>
    <hr style="border:0;border-top:1px solid #ddd;">
    <div style="font-size:12px;margin:15px 0;">
      <p><strong>Patient Name:</strong> <span id="pb-name"></span></p>
      <p><strong>Age / Gender:</strong> <span id="pb-agegender"></span></p>
      <p><strong>Contact:</strong> <span id="pb-contact"></span> | <strong>Aadhaar:</strong> <span id="pb-adhaar"></span></p>
      <p><strong>Consulting Doctor:</strong> <span id="pb-doctor"></span></p>
    </div>
    <table style="width:100%;margin:15px 0;">
      <thead><tr><th>Description</th><th>Mode</th><th>Amount (₹)</th></tr></thead>
      <tbody>
        <tr>
          <td>OPD Doctor Consultation Fee</td>
          <td id="pb-paymode">Cash</td>
          <td id="pb-amount" style="font-weight:700;">₹0.00</td>
        </tr>
      </tbody>
    </table>
    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
      <button class="btn" onclick="document.getElementById('print-modal').style.display='none'">Close</button>
      <button class="btn primary" onclick="window.print()">🖨 Print A4 Bill</button>
    </div>
  </div>
</div>

<script>
let currentUser = null;
let activeModuleKey = 'dashboard';
let doctorsList = [];

const navGroups = [
  { label: "OVERVIEW", items: [["Dashboard", "dashboard", "▦"], ["Notifications", "notifications", "♧"], ["Tasks & Approvals", "approvals", "✓"]] },
  { label: "HOSPITAL MANAGEMENT", items: [["Patient Registration", "patients", "＋"], ["Patient Search", "patient-search", "⌕"], ["OPD & Appointments", "opd", "◷"], ["IPD Admissions", "admissions", "▤"], ["Wards & Beds", "beds", "▥"], ["Doctors & Departments", "doctors", "✚"], ["Nursing Station", "nursing", "♡"], ["Laboratory", "laboratory", "⚗"], ["Radiology", "radiology", "◉"], ["OT & ICU", "ot-icu", "✚"], ["Discharge Management", "discharge", "⇥"], ["Hospital Billing", "hospital-billing", "₹"], ["Medical Records", "medical-records", "▧"]] },
  { label: "PHARMACY", items: [["Pharmacy Dashboard", "pharmacy", "✚"], ["Medicine Master", "medicines", "▤"], ["Batch & Strip Stock", "batches", "▦"], ["Purchase Entry", "pharmacy-purchase", "＋"], ["Sales Billing", "pharmacy-sales", "₹"], ["Sales Return", "sales-return", "↩"], ["Customers", "customers", "♙"], ["Suppliers", "suppliers", "▣"], ["Barcode & Labels", "barcode", "▥"], ["Stock Transfer", "stock-transfer", "⇄"], ["Expiry & Low Stock", "stock-alerts", "⚠"], ["Pharmacy Reports", "pharmacy-reports", "▥"]] },
  { label: "CENTRAL STORE & PURCHASE", items: [["Inventory Dashboard", "inventory", "▦"], ["Item Master", "items", "▤"], ["Warehouses & Stores", "warehouses", "▣"], ["Requisitions", "requisitions", "☷"], ["Goods Receipt (GRN)", "grn", "⇩"], ["Stock Issue / Return", "stock-issue", "⇄"], ["Stock Ledger", "stock-ledger", "▤"], ["Purchase Orders", "purchase-orders", "▧"], ["Vendor Quotations", "quotations", "▤"], ["Supplier Payments", "supplier-payments", "₹"]] },
  { label: "BIOMEDICAL ENGINEERING", items: [["Biomedical Dashboard", "biomedical", "⌘"], ["Equipment Assets", "assets", "▣"], ["Equipment Complaints", "complaints", "⚠"], ["Work Orders & Repairs", "work-orders", "🔧"], ["Preventive Maintenance", "maintenance", "◷"], ["Calibration Register", "calibration", "✓"], ["AMC / CMC Contracts", "contracts", "▧"], ["Service Vendors", "service-vendors", "♙"], ["Equipment Handover", "handover", "⇄"], ["Equipment Reports", "biomed-reports", "▥"]] },
  { label: "FINANCE & HRMS", items: [["Accounts Dashboard", "accounts", "₹"], ["Income & Expenses", "expenses", "⇅"], ["Cash & Bank", "cash-bank", "▤"], ["Receivables / Payables", "receivables", "₹"], ["Employee Directory", "employees", "♙"], ["Attendance & Shifts", "attendance", "◷"], ["Leave & Duty Roster", "leave", "☷"], ["Payroll", "payroll", "₹"]] },
  { label: "REPORTS & ADMINISTRATION", items: [["Reports & Analytics", "reports", "▥"], ["Quality & Compliance", "quality", "✓"], ["Document Register", "documents", "▧"], ["User & Role Management", "users", "♙"], ["Role Permissions", "permissions", "⚿"], ["Audit Logs", "audit-logs", "☷"], ["Branch & Department Setup", "organization", "▦"], ["Settings & Backup", "settings", "⚙"]] }
];

window.onload = function() {
  const savedUser = localStorage.getItem('ar_erp_active_user');
  const savedPage = localStorage.getItem('ar_erp_active_page');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('user-display-name').innerText = currentUser.name;
    document.getElementById('user-display-role').innerText = currentUser.role;
    document.getElementById('user-avatar').innerText = currentUser.name.slice(0,2).toUpperCase();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    renderNav();
    loadDoctors();
    switchView(savedPage || 'dashboard');
  }
};

async function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('login-u').value;
  const p = document.getElementById('login-p').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('ar_erp_active_user', JSON.stringify(currentUser));
      localStorage.setItem('ar_erp_active_page', 'dashboard');
      document.getElementById('user-display-name').innerText = currentUser.name;
      document.getElementById('user-display-role').innerText = currentUser.role;
      document.getElementById('user-avatar').innerText = currentUser.name.slice(0,2).toUpperCase();
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      renderNav();
      loadDoctors();
      switchView('dashboard');
    } else {
      alert(data.message || 'Login Failed');
    }
  } catch (err) {
    alert('Network Error');
  }
}

function handleLogout() {
  localStorage.removeItem('ar_erp_active_user');
  localStorage.removeItem('ar_erp_active_page');
  location.reload();
}

function renderNav() {
  let html = "";
  navGroups.forEach(g => {
    let groupItemsHtml = "";
    g.items.forEach(i => {
      if (currentUser.role === 'Super Admin' || currentUser.permissions.includes('all') || currentUser.permissions.includes(i[1])) {
        groupItemsHtml += '<button class="nav-item ' + (i[1]===activeModuleKey?'active':'') + '" id="nav-btn-' + i[1] + '" onclick="switchView(\\'' + i[1] + '\\')"><span class="nav-icon">' + i[2] + '</span><span>' + i[0] + '</span></button>';
      }
    });
    if(groupItemsHtml !== "") {
      html += '<div class="nav-label">' + g.label + '</div>' + groupItemsHtml;
    }
  });
  document.getElementById('nav-menu').innerHTML = html;
}

async function loadDoctors() {
  const res = await fetch('/api/doctors');
  doctorsList = await res.json();
  let opt = '<option value="">-- Select Doctor --</option>';
  doctorsList.forEach(d => {
    opt += '<option value="' + d.name + '">' + d.name + ' (Fee: ₹' + d.fee + ')</option>';
  });
  document.getElementById('reg-doctor').innerHTML = opt;
}

function autoFetchDoctorFee() {
  const docName = document.getElementById('reg-doctor').value;
  const doc = doctorsList.find(d => d.name === docName);
  if (doc) document.getElementById('reg-fee').value = doc.fee;
}

async function fetchNextUHID() {
  const res = await fetch('/api/next-uhid');
  const data = await res.json();
  document.getElementById('reg-uhid').value = data.uhid;
}

function switchView(targetKey) {
  activeModuleKey = targetKey;
  localStorage.setItem('ar_erp_active_page', targetKey);

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeBtn = document.getElementById('nav-btn-' + targetKey);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

  if (targetKey === 'dashboard') {
    document.getElementById('view-dashboard').classList.add('active');
    loadDashboardMetrics();
  } else {
    document.getElementById('view-module-container').classList.add('active');
    
    if (targetKey === 'patients' || targetKey === 'patient-search') {
      document.getElementById('patient-reg-panel').style.display = 'block';
      document.getElementById('module-add-btn').style.display = 'inline-block';
      fetchNextUHID();
    } else {
      document.getElementById('patient-reg-panel').style.display = 'none';
      document.getElementById('module-add-btn').style.display = 'none';
    }
    loadUniqueModuleData(targetKey);
  }

  const foundItem = navGroups.flatMap(g => g.items).find(i => i[1] === targetKey);
  document.getElementById('topbar-title').innerText = foundItem ? foundItem[0].toUpperCase() : targetKey.toUpperCase();
}

function togglePatientForm() {
  const p = document.getElementById('patient-reg-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

async function loadDashboardMetrics() {
  const res = await fetch('/api/dashboard/metrics');
  const data = await res.json();
  if (data.success) {
    document.getElementById('m-rev').innerText = '₹' + data.totalRevenue.toFixed(2);
    document.getElementById('m-pat').innerText = data.registeredPatients;
  }

  const pRes = await fetch('/api/module/patients');
  const pData = await pRes.json();
  let html = "";
  (pData.data || []).forEach(p => {
    html += '<tr><td><b>' + p.uhid + '</b></td><td>' + p.title + ' ' + p.name + '</td><td>' + p.doctor + '</td><td>₹' + p.fee + '</td><td>' + p.payType + '</td><td>' + p.date + '</td></tr>';
  });
  document.getElementById('dash-patients').innerHTML = html;
}

async function loadUniqueModuleData(key) {
  document.getElementById('module-title-heading').innerText = key.toUpperCase().replace('-', ' ') + ' MASTER RECORDS';

  const res = await fetch('/api/module/' + key);
  const json = await res.json();
  const list = json.data || [];

  if (list.length === 0) {
    document.getElementById('module-thead').innerHTML = '<tr><th>Status</th></tr>';
    document.getElementById('module-tbody').innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--muted);">No records available.</td></tr>';
    return;
  }

  const columns = Object.keys(list[0]);
  document.getElementById('module-thead').innerHTML = '<tr>' + columns.map(c => '<th>' + c.toUpperCase() + '</th>').join('') + '</tr>';

  let rows = "";
  list.forEach(row => {
    rows += '<tr>' + columns.map(c => '<td>' + (row[c] !== undefined ? row[c] : '—') + '</td>').join('') + '</tr>';
  });
  document.getElementById('module-tbody').innerHTML = rows;
}

async function handleLiveSearch(val) {
  const box = document.getElementById('search-suggestions');
  if (val.trim().length < 2) {
    box.style.display = 'none';
    return;
  }
  const res = await fetch('/api/patients/search?q=' + encodeURIComponent(val));
  const data = await res.json();

  if (data.length === 0) {
    box.style.display = 'none';
    return;
  }

  let html = "";
  data.forEach(p => {
    html += '<div class="suggestion-item" onclick="autoFillPatient(\\'' + p.uhid + '\\')"><strong>' + p.title + ' ' + p.name + '</strong> (' + p.uhid + ') - Mob: ' + p.contact + '</div>';
  });
  box.innerHTML = html;
  box.style.display = 'block';
}

async function autoFillPatient(uhid) {
  const res = await fetch('/api/patients/search?q=' + uhid);
  const data = await res.json();
  if (data.length > 0) {
    const p = data[0];
    document.getElementById('reg-title').value = p.title || 'Mr.';
    document.getElementById('reg-name').value = p.name;
    document.getElementById('reg-relation').value = p.relation || 'S/O';
    document.getElementById('reg-guardian').value = p.guardian || '';
    document.getElementById('reg-age').value = p.age;
    document.getElementById('reg-gender').value = p.gender;
    document.getElementById('reg-contact').value = p.contact;
    document.getElementById('reg-adhaar').value = p.adhaar || '';
    document.getElementById('reg-abha').value = p.abha || '';
    document.getElementById('reg-address').value = p.address || '';
    document.getElementById('search-suggestions').style.display = 'none';
  }
}

async function handlePatientRegistration(e) {
  e.preventDefault();
  const body = {
    title: document.getElementById('reg-title').value,
    name: document.getElementById('reg-name').value,
    relation: document.getElementById('reg-relation').value,
    guardian: document.getElementById('reg-guardian').value,
    age: document.getElementById('reg-age').value,
    gender: document.getElementById('reg-gender').value,
    contact: document.getElementById('reg-contact').value,
    adhaar: document.getElementById('reg-adhaar').value,
    abha: document.getElementById('reg-abha').value,
    address: document.getElementById('reg-address').value,
    doctor: document.getElementById('reg-doctor').value,
    fee: document.getElementById('reg-fee').value,
    payType: document.getElementById('reg-paytype').value,
    createdBy: currentUser.name + ' (' + currentUser.role + ')'
  };

  const res = await fetch('/api/patients/register', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (data.success) {
    document.getElementById('pb-billno').innerText = data.bill.billNo;
    document.getElementById('pb-datetime').innerText = data.bill.dateTime;
    document.getElementById('pb-uhid').innerText = data.patient.uhid;
    document.getElementById('pb-user').innerText = data.bill.createdBy;
    document.getElementById('pb-name').innerText = data.patient.title + ' ' + data.patient.name + ' (' + data.patient.relation + ' ' + data.patient.guardian + ')';
    document.getElementById('pb-agegender').innerText = data.patient.age + ' Yrs / ' + data.patient.gender;
    document.getElementById('pb-contact').innerText = data.patient.contact;
    document.getElementById('pb-adhaar').innerText = data.patient.adhaar || 'N/A';
    document.getElementById('pb-doctor').innerText = data.patient.doctor;
    document.getElementById('pb-paymode').innerText = data.patient.payType;
    document.getElementById('pb-amount').innerText = '₹' + Number(data.patient.fee).toFixed(2);

    document.getElementById('print-modal').style.display = 'flex';
    loadUniqueModuleData(activeModuleKey);
    fetchNextUHID();
  } else {
    alert(data.message);
  }
}
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live on port ${PORT}`);
});