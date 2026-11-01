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
    pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    pool.connect()
        .then(() => console.log('Connected to Supabase PostgreSQL database successfully.'))
        .catch(err => console.error('Database connection warning:', err.message));
}

// Comprehensive ERP Database Store for Every Sidebar Module
let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active' }
    ],
    patients: [
        { uhid: 'UHID2026001', name: 'Aarif Rabbani', age: 27, gender: 'Male', contact: '9876543210', address: 'Maharajganj, UP', status: 'Active OPD' },
        { uhid: 'UHID2026002', name: 'Ramesh Verma', age: 42, gender: 'Male', contact: '9812345678', address: 'Gorakhpur, UP', status: 'Admitted IPD' }
    ],
    opd: [
        { token: '#101', uhid: 'UHID2026001', patientName: 'Aarif Rabbani', doctor: 'Dr. A. Khan', department: 'General Medicine', status: 'Waiting' }
    ],
    admissions: [
        { ipdNo: 'IPD-901', uhid: 'UHID2026002', patientName: 'Ramesh Verma', ward: 'General Ward A', bed: 'BED-101', admitDate: '2026-11-01', status: 'Admitted' }
    ],
    beds: [
        { ward: 'General Ward A', bedNo: 'BED-101', type: 'Standard', status: 'Occupied', patient: 'Ramesh Verma' },
        { ward: 'General Ward A', bedNo: 'BED-102', type: 'Standard', status: 'Available', patient: 'None' },
        { ward: 'ICU Ward 1', bedNo: 'ICU-01', type: 'Critical', status: 'Available', patient: 'None' }
    ],
    doctors: [
        { docId: 'DOC-01', name: 'Dr. A. Khan', specialty: 'General Physician', opdDays: 'Mon-Sat', status: 'Available' },
        { docId: 'DOC-02', name: 'Dr. Priya Singh', specialty: 'Cardiologist', opdDays: 'Tue, Thu, Sat', status: 'In Surgery' }
    ],
    laboratory: [
        { labId: 'LAB-501', uhid: 'UHID2026001', testName: 'Complete Blood Count (CBC)', sampleDate: '2026-11-01', result: 'Normal', status: 'Completed' }
    ],
    radiology: [
        { radId: 'RAD-301', uhid: 'UHID2026002', scanType: 'Chest X-Ray PA View', technician: 'Rahul Sharma', status: 'Report Ready' }
    ],
    medicines: [
        { medId: 'MED001', brandName: 'Paracetamol 650mg', generic: 'Paracetamol', batch: 'B2601', stock: 150, rate: 20.00, expiry: '2027-12-31' },
        { medId: 'MED002', brandName: 'Amoxycillin 500mg', generic: 'Amoxycillin', batch: 'B2602', stock: 15, rate: 45.00, expiry: '2026-11-20' }
    ],
    assets: [
        { assetId: 'AST-001', name: 'Digital X-Ray Machine', department: 'Radiology', pmDate: '2026-12-15', status: 'Operational' },
        { assetId: 'AST-002', name: 'ECG Monitor 12-Lead', department: 'ICU', pmDate: '2026-11-05', status: 'Under Repair' }
    ],
    employees: [
        { empId: 'EMP-001', name: 'Dr. A. Khan', designation: 'Senior Physician', department: 'Hospital', status: 'Active' },
        { empId: 'EMP-002', name: 'Sunita Sharma', designation: 'Head Nurse', department: 'Nursing', status: 'Active' }
    ],
    accounts: [
        { txnId: 'TXN-901', type: 'Income', category: 'OPD Billing', amount: 1200.00, date: '2026-11-01', status: 'Cleared' }
    ],
    settings: [
        { settingKey: 'Hospital Name', value: 'AR Healthcare Super Speciality', category: 'General', updatedBy: 'Super Admin' },
        { settingKey: 'GSTIN Number', value: '09AABCA1234F1Z9', category: 'Financial', updatedBy: 'Super Admin' },
        { settingKey: 'Automatic Backup', value: 'Enabled (Daily 12:00 AM)', category: 'System', updatedBy: 'Super Admin' }
    ],
    auditLogs: [
        { logId: 'LOG-881', user: 'Aarif (Super Admin)', action: 'User Permission Updated', ipAddress: '192.168.1.10', timestamp: '2026-11-01 14:30' }
    ]
};

// --- AUTH & API ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = erpData.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid Username or Password' });
    if (user.status === 'Deactivated') return res.status(403).json({ success: false, message: 'Account deactivated.' });
    res.json({ success: true, user: { name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status } });
});

app.get('/api/users', (req, res) => res.json(erpData.users));

// Generic Dynamic Data Getter for all 50+ Modules
app.get('/api/module/:key', (req, res) => {
    const key = req.params.key;
    if (erpData[key]) {
        return res.json({ success: true, data: erpData[key] });
    }
    // Mapping fallback if key matches similar modules
    if (['patients', 'patient-search', 'patients-reg'].includes(key)) return res.json({ success: true, data: erpData.patients });
    if (['opd', 'appointments'].includes(key)) return res.json({ success: true, data: erpData.opd });
    if (['admissions', 'ipd'].includes(key)) return res.json({ success: true, data: erpData.admissions });
    if (['beds', 'wards'].includes(key)) return res.json({ success: true, data: erpData.beds });
    if (['doctors', 'departments'].includes(key)) return res.json({ success: true, data: erpData.doctors });
    if (['laboratory'].includes(key)) return res.json({ success: true, data: erpData.laboratory });
    if (['radiology'].includes(key)) return res.json({ success: true, data: erpData.radiology });
    if (['medicines', 'pharmacy', 'batches', 'stock-alerts'].includes(key)) return res.json({ success: true, data: erpData.medicines });
    if (['assets', 'biomedical'].includes(key)) return res.json({ success: true, data: erpData.assets });
    if (['employees', 'attendance', 'payroll'].includes(key)) return res.json({ success: true, data: erpData.employees });
    if (['accounts', 'expenses', 'cash-bank'].includes(key)) return res.json({ success: true, data: erpData.accounts });
    if (['settings'].includes(key)) return res.json({ success: true, data: erpData.settings });
    if (['audit-logs'].includes(key)) return res.json({ success: true, data: erpData.auditLogs });

    // Default return empty array with dummy row structure for unpopulated modules
    res.json({ success: true, data: [{ refId: 'REF-001', description: 'Sample Record for ' + key, category: 'General', date: '2026-11-01', status: 'Active' }] });
});

app.get('/api/dashboard/metrics', (req, res) => {
    res.json({
        success: true,
        totalRevenue: 12450.00,
        registeredPatients: erpData.patients.length,
        activeIpdBeds: erpData.beds.filter(b => b.status === 'Occupied').length,
        pharmacySalesCount: 8,
        lowStockItems: erpData.medicines.filter(m => m.stock < 50).length
    });
});

app.post('/api/ai/chat', (req, res) => {
    const { query } = req.body;
    res.json({ success: true, reply: `**AR AI Assistant**: Aapke query "${query}" ke mutabiq system bilkul active aur synchronized hai. Sabhi modules apne specific tables aur columns ke sath load ho rahe hain!` });
});

// --- SINGLE-FILE FRONTEND WITH STRICT MODULE ROUTING ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AR Healthcare ERP | Hospital • Pharmacy • Biomedical</title>
<style>
:root{--navy:#10243a;--navy2:#173650;--blue:#2674e8;--cyan:#16b8b0;--bg:#f3f6fb;--card:#fff;--text:#18283d;--muted:#718096;--line:#e4eaf2;--green:#16875d;--orange:#c77a12;--red:#c93c48;--shadow:0 8px 28px rgba(23,44,75,.07)}
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

table{width:100%;border-collapse:collapse}
th{text-align:left;background:#f8fafd;color:#7a8a9e;font-size:10px;letter-spacing:.7px;text-transform:uppercase;padding:12px 16px;font-weight:800}
td{padding:13px 16px;border-top:1px solid #edf1f6;font-size:12px}

.btn{border:1px solid var(--line);background:#fff;color:var(--text);border-radius:9px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer}
.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.btn.success{background:var(--cyan);border-color:var(--cyan);color:#fff}
.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
.btn-sm{padding:5px 10px;font-size:11px}

#ai-panel{position:fixed;bottom:25px;right:25px;width:340px;background:#fff;border-radius:16px;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;z-index:999;border:1px solid var(--line)}
.ai-header{background:linear-gradient(135deg,#16b8b0,#2674e8);color:#fff;padding:14px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.ai-body{padding:15px;height:240px;overflow-y:auto;font-size:12px;line-height:1.5;background:#f9fbfe}
.ai-footer{padding:10px;display:flex;gap:8px;border-top:1px solid var(--line);background:#fff}
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
      <h2>Hello, Friend!</h2>
      <p style="font-size:13px;line-height:1.6;opacity:.85;">Welcome to Commercial Enterprise HIMS & Pharmacy ERP.</p>
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
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="btn btn-sm success" onclick="toggleAiPanel()">🤖 AR AI Assistant</button>
        <div class="profile">
          <div class="avatar" id="user-avatar">AR</div>
          <div><strong id="user-display-name" style="font-size:13px;display:block;">-</strong><small id="user-display-role" style="font-size:10px;color:var(--muted);">-</small></div>
          <button class="btn btn-sm danger" onclick="handleLogout()" style="margin-left:15px;">Logout</button>
        </div>
      </div>
    </header>

    <section class="content">
      <!-- DASHBOARD VIEW -->
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-label">TODAY'S REVENUE</div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">1 / 20</div></div>
          <div class="stat"><div class="stat-label">LOW STOCK ALERTS</div><div class="stat-value" id="m-stock">0</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Recent System Operations & Revenue Overview</h3></div>
          <table>
            <thead><tr><th>Ref ID</th><th>Module</th><th>Activity / Description</th><th>Timestamp</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td><b>LOG-881</b></td><td>Administration</td><td>User Permission Updated</td><td>2026-11-01 14:30</td><td><span style="color:var(--green);font-weight:700;">Active</span></td></tr>
              <tr><td><b>INV-311</b></td><td>Pharmacy POS</td><td>Paracetamol 650mg Sold (Qty: 2)</td><td>2026-10-31 11:15</td><td><span style="color:var(--green);font-weight:700;">Completed</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- DYNAMIC MODULE VIEW (STRICTLY UNIQUE PER SIDEBAR ITEM) -->
      <div id="view-module-container" class="view-section">
        <div class="panel">
          <div class="panel-head">
            <h3 id="module-title-heading">Module Records</h3>
            <button class="btn primary btn-sm" onclick="alert('Record creation initialized for this module.')">+ Add New Record</button>
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

<div id="ai-panel">
  <div class="ai-header">
    <span>🤖 AR AI Assistant</span>
    <button onclick="toggleAiPanel()" style="background:transparent;border:none;color:#fff;cursor:pointer;font-weight:800;">✕</button>
  </div>
  <div class="ai-body" id="ai-messages">
    <div><b>AR AI:</b> Namaste Aarif bhai! Main aapka AR AI assistant hoon. Kisi bhi sidebar module ke bare me puchhein.</div>
  </div>
  <div class="ai-footer">
    <input type="text" id="ai-input" placeholder="Ask AI..." style="flex:1;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;" onkeypress="if(event.key==='Enter')sendAiQuery()">
    <button class="btn primary btn-sm" onclick="sendAiQuery()">Send</button>
  </div>
</div>

<script>
let currentUser = null;
let activeModuleKey = 'dashboard';

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
        groupItemsHtml += \`<button class="nav-item \${i[1]===activeModuleKey?'active':''}" id="nav-btn-\${i[1]}" onclick="switchView('\${i[1]}')"><span class="nav-icon">\${i[2]}</span><span>\${i[0]}</span></button>\`;
      }
    });
    if(groupItemsHtml !== "") {
      html += \`<div class="nav-label">\${g.label}</div>\` + groupItemsHtml;
    }
  });
  document.getElementById('nav-menu').innerHTML = html;
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
    loadUniqueModuleData(targetKey);
  }

  const foundItem = navGroups.flatMap(g => g.items).find(i => i[1] === targetKey);
  document.getElementById('topbar-title').innerText = foundItem ? foundItem[0].toUpperCase() : targetKey.toUpperCase();
}

async function loadDashboardMetrics() {
  const res = await fetch('/api/dashboard/metrics');
  const data = await res.json();
  if (data.success) {
    document.getElementById('m-rev').innerText = '₹' + data.totalRevenue.toFixed(2);
    document.getElementById('m-pat').innerText = data.registeredPatients;
    document.getElementById('m-stock').innerText = data.lowStockItems;
  }
}

async function loadUniqueModuleData(key) {
  document.getElementById('module-title-heading').innerText = key.toUpperCase().replace('-', ' ') + ' MASTER TABLE';

  const res = await fetch('/api/module/' + key);
  const json = await res.json();
  const list = json.data || [];

  if (list.length === 0) {
    document.getElementById('module-thead').innerHTML = '<tr><th>Status</th></tr>';
    document.getElementById('module-tbody').innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--muted);">No records available for ' + key + '.</td></tr>';
    return;
  }

  const columns = Object.keys(list[0]);
  document.getElementById('module-thead').innerHTML = '<tr>' + columns.map(c => \`<th>\${c.toUpperCase()}</th>\`).join('') + '</tr>';

  let rows = "";
  list.forEach(row => {
    rows += '<tr>' + columns.map(c => \`<td>\${row[c] !== undefined ? row[c] : '—'}</td>\`).join('') + '</tr>';
  });
  document.getElementById('module-tbody').innerHTML = rows;
}

function toggleAiPanel() {
  const p = document.getElementById('ai-panel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
}

async function sendAiQuery() {
  const inp = document.getElementById('ai-input');
  const msg = inp.value.trim();
  if (!msg) return;

  const box = document.getElementById('ai-messages');
  box.innerHTML += \`<div style="margin-top:8px;text-align:right;"><b>You:</b> \${msg}</div>\`;
  inp.value = '';

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ query: msg })
  });
  const data = await res.json();
  box.innerHTML += \`<div style="margin-top:8px;color:var(--navy);"><b>AR AI:</b> \${data.reply}</div>\`;
  box.scrollTop = box.scrollHeight;
}
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live on port ${PORT}`);
});