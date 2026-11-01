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

// Global In-Memory Database Store for all ERP Modules
let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active' }
    ],
    patients: [
        { id: 1, uhid: 'UHID2026001', name: 'Aarif Rabbani', age: 27, sex: 'Male', contact: '9876543210', address: 'Maharajganj, UP', status: 'Active OPD' },
        { id: 2, uhid: 'UHID2026002', name: 'Ramesh Verma', age: 42, sex: 'Male', contact: '9812345678', address: 'Gorakhpur, UP', status: 'Admitted IPD' }
    ],
    opdTokens: [
        { token: 1, uhid: 'UHID2026001', patientName: 'Aarif Rabbani', doctor: 'Dr. A. Khan (General)', status: 'Waiting', date: '2026-11-01' }
    ],
    medicines: [
        { id: 1, med_id: 'MED001', brand_name: 'Paracetamol 650mg', generic_name: 'Paracetamol', batch_no: 'B2601', available_qty: 150, sale_rate: 20.00, mrp: 22.00, units_per_pack: 10, expiry: '2027-12-31', status: 'In Stock' },
        { id: 2, med_id: 'MED002', brand_name: 'Amoxycillin 500mg', generic_name: 'Amoxycillin', batch_no: 'B2602', available_qty: 15, sale_rate: 45.00, mrp: 50.00, units_per_pack: 10, expiry: '2026-11-20', status: 'Low Stock' }
    ],
    bills: [
        { id: 1, inv_no: 'PBILL311026846', date: '2026-10-31', uhid: 'UHID2026001', customer_name: 'Aarif Rabbani', mobile: '9876543210', items_count: 2, net_total: 800.00 }
    ],
    assets: [
        { id: 1, assetId: 'AST-001', name: 'Digital X-Ray Machine', department: 'Radiology', status: 'Operational', pmDue: '2026-12-15' },
        { id: 2, assetId: 'AST-002', name: 'ECG Monitor 12-Lead', department: 'ICU', status: 'Under Repair', pmDue: '2026-11-05' }
    ],
    employees: [
        { id: 1, employeeId: 'EMP-001', name: 'Dr. A. Khan', designation: 'Senior Physician', department: 'Hospital', status: 'Active' },
        { id: 2, employeeId: 'EMP-002', name: 'Sunita Sharma', designation: 'Head Nurse', department: 'Nursing', status: 'Active' }
    ],
    ipdBeds: [
        { ward: 'General Ward A', bedNo: 'BED-101', uhid: 'UHID2026002', patientName: 'Ramesh Verma', status: 'Occupied' },
        { ward: 'General Ward A', bedNo: 'BED-102', uhid: '', patientName: 'Vacant', status: 'Available' },
        { ward: 'ICU Ward 1', bedNo: 'ICU-01', uhid: '', patientName: 'Vacant', status: 'Available' }
    ],
    purchases: [
        { id: 1, poNo: 'PO-2026-001', vendor: 'MedTech Pharma Supplies', date: '2026-10-25', amount: 15400.00, status: 'Approved' }
    ],
    accounts: [
        { id: 1, txnId: 'TXN-901', type: 'Income', category: 'OPD Billing', amount: 1200.00, date: '2026-11-01', status: 'Cleared' },
        { id: 2, txnId: 'TXN-902', type: 'Expense', category: 'Pharmacy Restock', amount: 4500.00, date: '2026-10-30', status: 'Cleared' }
    ]
};

// --- AUTH & RBAC ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = erpData.users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid Username or Password' });
    }
    if (user.status === 'Deactivated') {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated by Super Admin.' });
    }
    res.json({ success: true, user: { name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status } });
});

app.get('/api/users', (req, res) => res.json(erpData.users));

app.post('/api/users', (req, res) => {
    const { name, username, password, role, permissions } = req.body;
    if (erpData.users.some(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    const newUser = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        name,
        username,
        password,
        role: role || 'Staff',
        permissions: permissions || ['dashboard'],
        status: 'Active'
    };
    erpData.users.push(newUser);
    res.json({ success: true, message: 'User Created Successfully', user: newUser });
});

app.post('/api/users/update-permission', (req, res) => {
    const { userId, permissions } = req.body;
    const user = erpData.users.find(u => u.id === userId);
    if (user) {
        user.permissions = permissions;
        res.json({ success: true, message: `Permissions updated for ${user.name}` });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.post('/api/users/toggle-status', (req, res) => {
    const { userId } = req.body;
    const user = erpData.users.find(u => u.id === userId);
    if (user) {
        if (user.username === 'Aarif') {
            return res.status(400).json({ success: false, message: 'Cannot deactivate Primary Super Admin account' });
        }
        user.status = user.status === 'Active' ? 'Deactivated' : 'Active';
        res.json({ success: true, message: `User status changed to ${user.status}` });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// --- CORE DATA ENDPOINTS ---
app.get('/api/dashboard/metrics', (req, res) => {
    let totalRevenue = erpData.bills.reduce((acc, b) => acc + Number(b.net_total), 0);
    res.json({
        success: true,
        totalRevenue,
        registeredPatients: erpData.patients.length,
        activeIpdBeds: erpData.ipdBeds.filter(b => b.status === 'Occupied').length,
        pharmacySalesCount: erpData.bills.length,
        lowStockItems: erpData.medicines.filter(m => m.available_qty < 50).length
    });
});

app.get('/api/patients', (req, res) => res.json(erpData.patients));
app.post('/api/patients', (req, res) => {
    const p = req.body;
    const uhid = `UHID${Date.now().toString().slice(-6)}`;
    const newPatient = { id: Date.now(), uhid, name: p.name, age: p.age, sex: p.sex, contact: p.contact, address: p.address || 'Local', status: p.status || 'Active OPD' };
    erpData.patients.unshift(newPatient);
    erpData.opdTokens.unshift({ token: erpData.opdTokens.length + 1, uhid, patientName: p.name, doctor: 'Dr. A. Khan (General)', status: 'Waiting', date: new Date().toISOString().split('T')[0] });
    res.json({ success: true, message: 'Patient Registered & UHID Generated', patient: newPatient });
});

app.get('/api/medicines', (req, res) => res.json(erpData.medicines));
app.post('/api/medicines', (req, res) => {
    const m = req.body;
    const newMed = {
        id: Date.now(),
        med_id: `MED${Date.now().toString().slice(-4)}`,
        brand_name: m.brand_name,
        generic_name: m.generic_name || m.brand_name,
        batch_no: m.batch_no || 'B-NEW',
        available_qty: Number(m.available_qty || 100),
        sale_rate: Number(m.sale_rate || 10),
        mrp: Number(m.mrp || 12),
        units_per_pack: 10,
        expiry: m.expiry || '2028-12-31',
        status: Number(m.available_qty) < 50 ? 'Low Stock' : 'In Stock'
    };
    erpData.medicines.unshift(newMed);
    res.json({ success: true, message: 'Medicine added to stock master', medicine: newMed });
});

app.get('/api/bills', (req, res) => res.json(erpData.bills));
app.post('/api/bills', (req, res) => {
    const { uhid, cust, mob, medId, qty, price } = req.body;
    const invNo = `PBILL${Date.now().toString().slice(-8)}`;
    const netTotal = Number(price) * Number(qty);
    const med = erpData.medicines.find(m => m.med_id === medId || m.id === Number(medId));
    if (med) med.available_qty = Math.max(0, med.available_qty - Number(qty));

    const newBill = { id: Date.now(), inv_no: invNo, date: new Date().toISOString().split('T')[0], uhid: uhid || 'WALK-IN', customer_name: cust || 'Walk-in', mobile: mob || '', items_count: Number(qty), net_total: netTotal };
    erpData.bills.unshift(newBill);
    res.json({ success: true, message: 'POS Bill Generated & Stock Deducted', bill: newBill });
});

app.get('/api/opd-tokens', (req, res) => res.json(erpData.opdTokens));
app.post('/api/opd-tokens/attend', (req, res) => {
    const { tokenNo } = req.body;
    const item = erpData.opdTokens.find(t => t.token === Number(tokenNo));
    if (item) item.status = 'Completed';
    res.json({ success: true, message: 'Consultation Completed' });
});

app.get('/api/assets', (req, res) => res.json(erpData.assets));
app.get('/api/employees', (req, res) => res.json(erpData.employees));
app.get('/api/ipd', (req, res) => res.json(erpData.ipdBeds));
app.get('/api/purchases', (req, res) => res.json(erpData.purchases));
app.get('/api/accounts', (req, res) => res.json(erpData.accounts));

// --- AR AI ASSISTANT ENDPOINT ---
app.post('/api/ai/chat', (req, res) => {
    const { query } = req.body;
    const text = (query || "").toLowerCase();
    let reply = "I am **AR AI Assistant**. How can I help you with Hospital, Pharmacy or Asset operations?";

    if (text.includes("patient") || text.includes("uhid")) {
        reply = `**AR AI Summary**: Total registered patients: **${erpData.patients.length}**. Latest Patient: **${erpData.patients[0]?.name || 'N/A'}** (${erpData.patients[0]?.uhid || ''}).`;
    } else if (text.includes("stock") || text.includes("medicine")) {
        const low = erpData.medicines.filter(m => m.available_qty < 50);
        reply = `**AR AI Inventory Alert**: Total medicines: **${erpData.medicines.length}**. Low stock items: **${low.length}** (${low.map(x=>x.brand_name).join(', ') || 'None'}).`;
    } else if (text.includes("revenue") || text.includes("sale") || text.includes("bill")) {
        const total = erpData.bills.reduce((a, b) => a + Number(b.net_total), 0);
        reply = `**AR AI Financial Report**: Total revenue recorded: **₹${total.toFixed(2)}** across **${erpData.bills.length}** bills.`;
    } else if (text.includes("bed") || text.includes("ipd")) {
        const occ = erpData.ipdBeds.filter(b => b.status === 'Occupied').length;
        reply = `**AR AI Ward Status**: Occupied Beds: **${occ} / ${erpData.ipdBeds.length}**.`;
    }
    res.json({ success: true, reply });
});

// --- SINGLE-FILE FRONTEND INTEGRATION ---
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

/* LOGIN SCREEN */
#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:linear-gradient(135deg,#eef2f7 0%,#c9d6ff 100%);position:fixed;z-index:9999}
.login-container{background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(16,36,58,0.15);width:min(850px,92vw);height:520px;display:flex;overflow:hidden}
.login-left{flex:1.2;padding:50px 45px;display:flex;flex-direction:column;justify-content:center}
.login-left h2{font-size:26px;color:var(--navy);font-weight:800;margin-bottom:8px}
.login-left p{font-size:13px;color:var(--muted);margin-bottom:30px}
.login-right{flex:1;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:50px 40px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative}
.login-field{margin-bottom:18px;text-align:left}
.login-field label{display:block;font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px}
.login-input{width:100%;padding:13px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:#f8fafc;outline:none}
.login-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--blue),#1d5ec4);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-top:10px}

/* MAIN APP */
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

/* CHART STYLING */
.chart-box{height:180px;display:flex;align-items:flex-end;gap:12px;padding:10px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 39px,#f0f4f9 40px);border-bottom:1px solid var(--line)}
.chart-bar-group{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}
.bars-wrap{display:flex;align-items:flex-end;gap:4px;height:140px;width:100%;justify-content:center}
.bar-single{width:16px;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#5e9cff,#2876ed)}
.bar-single.alt{background:linear-gradient(180deg,#62d7ce,#17b8ae)}

table{width:100%;border-collapse:collapse}
th{text-align:left;background:#f8fafd;color:#7a8a9e;font-size:10px;letter-spacing:.7px;text-transform:uppercase;padding:12px 16px;font-weight:800}
td{padding:13px 16px;border-top:1px solid #edf1f6;font-size:12px}

.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:15px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:11px;font-weight:700;color:var(--navy)}
.field input,.field select{padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px;outline:none}

.btn{border:1px solid var(--line);background:#fff;color:var(--text);border-radius:9px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer}
.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.btn.success{background:var(--cyan);border-color:var(--cyan);color:#fff}
.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
.btn-sm{padding:5px 10px;font-size:11px}

/* AR AI FLOATING WIDGET */
#ai-panel{position:fixed;bottom:25px;right:25px;width:340px;background:#fff;border-radius:16px;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;z-index:999;border:1px solid var(--line)}
.ai-header{background:linear-gradient(135deg,#16b8b0,#2674e8);color:#fff;padding:14px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.ai-body{padding:15px;height:240px;overflow-y:auto;font-size:12px;line-height:1.5;background:#f9fbfe}
.ai-footer{padding:10px;display:flex;gap:8px;border-top:1px solid var(--line);background:#fff}
</style>
</head>
<body>

<!-- LOGIN SCREEN -->
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
      <h2 style="font-size:28px;margin-bottom:12px;">Hello, Friend!</h2>
      <p style="font-size:13px;line-height:1.6;opacity:.85;">Welcome to Commercial Enterprise HIMS & Pharmacy ERP.</p>
    </div>
  </div>
</div>

<!-- MAIN APP -->
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
      
      <!-- 1. DASHBOARD -->
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-label">TODAY'S REVENUE</div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">1 / 20</div></div>
          <div class="stat"><div class="stat-label">LOW STOCK ALERTS</div><div class="stat-value" id="m-stock">0</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;">
          <div class="panel">
            <div class="panel-head"><h3>Operations Revenue vs Restock Overview</h3></div>
            <div class="chart-box">
              <div class="chart-bar-group"><div class="bars-wrap"><div class="bar-single" style="height:60%;"></div><div class="bar-single alt" style="height:40%;"></div></div><span style="font-size:10px;margin-top:6px;">Mon</span></div>
              <div class="chart-bar-group"><div class="bars-wrap"><div class="bar-single" style="height:80%;"></div><div class="bar-single alt" style="height:55%;"></div></div><span style="font-size:10px;margin-top:6px;">Tue</span></div>
              <div class="chart-bar-group"><div class="bars-wrap"><div class="bar-single" style="height:70%;"></div><div class="bar-single alt" style="height:45%;"></div></div><span style="font-size:10px;margin-top:6px;">Wed</span></div>
              <div class="chart-bar-group"><div class="bars-wrap"><div class="bar-single" style="height:90%;"></div><div class="bar-single alt" style="height:65%;"></div></div><span style="font-size:10px;margin-top:6px;">Thu</span></div>
              <div class="chart-bar-group"><div class="bars-wrap"><div class="bar-single" style="height:85%;"></div><div class="bar-single alt" style="height:50%;"></div></div><span style="font-size:10px;margin-top:6px;">Fri</span></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Priority System Alerts</h3></div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="padding:10px;background:#fff4df;border-radius:8px;font-size:12px;color:#c77a12;"><strong>⚠ Low Medicine Stock</strong><br>Amoxycillin 500mg requires restock.</div>
              <div style="padding:10px;background:#fff0f1;border-radius:8px;font-size:12px;color:#c93c48;"><strong>🔧 Maintenance Due</strong><br>ECG Monitor 12-Lead reported Under Repair.</div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Recent POS Invoices</h3></div>
          <table>
            <thead><tr><th>Invoice No</th><th>Date</th><th>Customer / UHID</th><th>Mobile</th><th>Items</th><th>Net Total (₹)</th></tr></thead>
            <tbody id="dash-bills"></tbody>
          </table>
        </div>
      </div>

      <!-- DYNAMIC SHARED CONTAINER FOR ALL OTHER MODULES WITH FULL TABLES & FORMS -->
      <div id="view-module-container" class="view-section">
        <div class="panel" id="module-form-box" style="display:none;">
          <div class="panel-head"><h3 id="module-form-title">Add New Entry</h3></div>
          <form id="generic-module-form" onsubmit="handleModuleSubmit(event)">
            <div class="form-grid" id="module-form-fields"></div>
            <button type="submit" class="btn primary">+ Save Record</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h3 id="module-table-title">Module Master Table</h3>
            <button class="btn primary btn-sm" id="module-add-btn" onclick="toggleModuleForm()">+ Add Record</button>
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

<!-- AR AI ASSISTANT CHAT PANEL -->
<div id="ai-panel">
  <div class="ai-header">
    <span>🤖 AR AI Assistant</span>
    <button onclick="toggleAiPanel()" style="background:transparent;border:none;color:#fff;cursor:pointer;font-weight:800;">✕</button>
  </div>
  <div class="ai-body" id="ai-messages">
    <div><strong>AR AI:</strong> Namaste Aarif bhai! Main aapka AR AI assistant hoon. ERP ke bare me kuch bhi puchhein.</div>
  </div>
  <div class="ai-footer">
    <input type="text" id="ai-input" placeholder="Ask AI..." style="flex:1;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;" onkeypress="if(event.key==='Enter')sendAiQuery()">
    <button class="btn primary btn-sm" onclick="sendAiQuery()">Send</button>
  </div>
</div>

<script>
let currentUser = null;
let activeModuleKey = 'dashboard';

// Complete Sidebar Menu Mapping matching your Screenshots
const navGroups = [
  { label: "OVERVIEW", items: [["Dashboard", "dashboard", "▦"], ["Notifications", "notifications", "♧"], ["Tasks & Approvals", "approvals", "✓"]] },
  { label: "HOSPITAL MANAGEMENT", items: [["Patient Registration", "patients", "＋"], ["Patient Search", "patient-search", "⌕"], ["OPD & Appointments", "opd", "◷"], ["IPD Admissions", "admissions", "▤"], ["Wards & Beds", "beds", "▥"], ["Doctors & Departments", "doctors", "✚"], ["Nursing Station", "nursing", "♡"], ["Laboratory", "laboratory", "⚗"], ["Radiology", "radiology", "◉"], ["OT & ICU", "ot-icu", "✚"], ["Discharge Management", "discharge", "⇥"], ["Hospital Billing", "hospital-billing", "₹"], ["Medical Records", "medical-records", "▧"]] },
  { label: "PHARMACY", items: [["Pharmacy Dashboard", "pharmacy", "✚"], ["Medicine Master", "medicines", "▤"], ["Batch & Strip Stock", "batches", "▦"], ["Purchase Entry", "pharmacy-purchase", "＋"], ["Sales Billing", "pharmacy-sales", "₹"], ["Sales Return", "sales-return", "↩"], ["Customers", "customers", "♙"], ["Suppliers", "suppliers", "▣"], ["Barcode & Labels", "barcode", "▥"], ["Stock Transfer", "stock-transfer", "⇄"], ["Expiry & Low Stock", "stock-alerts", "⚠"], ["Pharmacy Reports", "pharmacy-reports", "▥"]] },
  { label: "CENTRAL STORE & PURCHASE", items: [["Inventory Dashboard", "inventory", "▦"], ["Item Master", "items", "▤"], ["Warehouses & Stores", "warehouses", "▣"], ["Requisitions", "requisitions", "☷"], ["Goods Receipt (GRN)", "grn", "⇩"], ["Stock Issue / Return", "stock-issue", "⇄"], ["Stock Ledger", "stock-ledger", "▤"], ["Purchase Orders", "purchase-orders", "▧"], ["Vendor Quotations", "quotations", "▤"], ["Supplier Payments", "supplier-payments", "₹"]] },
  { label: "BIOMEDICAL ENGINEERING", items: [["Biomedical Dashboard", "biomedical", "⌘"], ["Equipment Assets", "assets", "▣"], ["Equipment Complaints", "complaints", "⚠"], ["Work Orders & Repairs", "work-orders", "🔧"], ["Preventive Maintenance", "maintenance", "◷"], ["Calibration Register", "calibration", "✓"], ["AMC / CMC Contracts", "contracts", "▧"], ["Service Vendors", "service-vendors", "♙"], ["Equipment Handover", "handover", "⇄"], ["Equipment Reports", "biomed-reports", "▥"]] },
  { label: "FINANCE & HRMS", items: [["Accounts Dashboard", "accounts", "₹"], ["Income & Expenses", "expenses", "⇅"], ["Cash & Bank", "cash-bank", "▤"], ["Receivables / Payables", "receivables", "₹"], ["Employee Directory", "employees", "♙"], ["Attendance & Shifts", "attendance", "◷"], ["Leave & Duty Roster", "leave", "☷"], ["Payroll", "payroll", "₹"]] },
  { label: "REPORTS & ADMINISTRATION", items: [["Reports & Analytics", "reports", "▥"], ["Quality & Compliance", "quality", "✓"], ["Document Register", "documents", "▧"], ["User & Role Management", "users", "♙"], ["Role Permissions", "permissions", "⚿"], ["Audit Logs", "audit-logs", "☷"], ["Branch & Department Setup", "organization", "▦"], ["Settings & Backup", "settings", "⚙"]] }
];

// Auto Session Restore on Refresh
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
    loadDashboardData();
  } else {
    document.getElementById('view-module-container').classList.add('active');
    loadModuleData(targetKey);
  }

  const foundItem = navGroups.flatMap(g => g.items).find(i => i[1] === targetKey);
  document.getElementById('topbar-title').innerText = foundItem ? foundItem[0].toUpperCase() : targetKey.toUpperCase();
}

async function loadDashboardData() {
  const mRes = await fetch('/api/dashboard/metrics');
  const mData = await mRes.json();
  if (mData.success) {
    document.getElementById('m-rev').innerText = '₹' + mData.totalRevenue.toFixed(2);
    document.getElementById('m-pat').innerText = mData.registeredPatients;
    document.getElementById('m-stock').innerText = mData.lowStockItems;
  }
  const bRes = await fetch('/api/bills');
  const bills = await bRes.json();
  let bHtml = "";
  bills.forEach(b => {
    bHtml += \`<tr><td>\${b.inv_no}</td><td>\${b.date}</td><td>\${b.customer_name} (\${b.uhid})</td><td>\${b.mobile||'-'}</td><td>\${b.items_count}</td><td>₹\${Number(b.net_total).toFixed(2)}</td></tr>\`;
  });
  document.getElementById('dash-bills').innerHTML = bHtml;
}

async function loadModuleData(key) {
  document.getElementById('module-form-box').style.display = 'none';
  document.getElementById('module-table-title').innerText = key.toUpperCase().replace('-', ' ') + ' RECORDS';

  let apiEndpoint = '/api/patients';
  let columns = [];
  let formHtml = "";

  if (['patients', 'patient-search', 'patients-reg'].includes(key)) {
    apiEndpoint = '/api/patients';
    columns = ['UHID', 'Patient Name', 'Age / Sex', 'Contact', 'Address', 'Status'];
    formHtml = \`
      <div class="field"><label>Patient Name</label><input type="text" id="fm-1" required></div>
      <div class="field"><label>Age</label><input type="number" id="fm-2" required></div>
      <div class="field"><label>Gender</label><select id="fm-3"><option>Male</option><option>Female</option></select></div>
      <div class="field"><label>Contact</label><input type="text" id="fm-4" required></div>
      <div class="field"><label>Address</label><input type="text" id="fm-5"></div>
    \`;
  } else if (['medicines', 'pharmacy', 'batches', 'stock-alerts'].includes(key)) {
    apiEndpoint = '/api/medicines';
    columns = ['Med ID', 'Brand Name', 'Generic Name', 'Batch No', 'Available Stock', 'Rate (₹)', 'Expiry', 'Status'];
    formHtml = \`
      <div class="field"><label>Brand Name</label><input type="text" id="fm-1" required></div>
      <div class="field"><label>Generic Name</label><input type="text" id="fm-2"></div>
      <div class="field"><label>Batch No</label><input type="text" id="fm-3" required></div>
      <div class="field"><label>Quantity</label><input type="number" id="fm-4" value="100" required></div>
      <div class="field"><label>Sale Rate (₹)</label><input type="number" id="fm-5" value="20" required></div>
    \`;
  } else if (['assets', 'biomedical', 'complaints', 'work-orders'].includes(key)) {
    apiEndpoint = '/api/assets';
    columns = ['Asset ID', 'Equipment Name', 'Department', 'PM Due Date', 'Status'];
  } else if (['employees', 'attendance', 'payroll', 'leave'].includes(key)) {
    apiEndpoint = '/api/employees';
    columns = ['Employee ID', 'Full Name', 'Designation', 'Department', 'Status'];
  } else if (['users', 'permissions'].includes(key)) {
    apiEndpoint = '/api/users';
    columns = ['User ID', 'Full Name', 'Username', 'Role', 'Permissions', 'Status'];
  } else {
    apiEndpoint = '/api/patients';
    columns = ['Ref ID', 'Title / Description', 'Category', 'Date', 'Status'];
  }

  // Render Table Headers
  document.getElementById('module-thead').innerHTML = '<tr>' + columns.map(c => \`<th>\${c}</th>\`).join('') + '</tr>';
  document.getElementById('module-form-fields').innerHTML = formHtml;

  // Fetch & Render Rows
  const res = await fetch(apiEndpoint);
  const data = await res.json();
  let rowsHtml = "";

  if (Array.isArray(data) && data.length > 0) {
    data.forEach(item => {
      const vals = Object.values(item).slice(1);
      rowsHtml += '<tr>' + vals.map(v => \`<td>\${typeof v === 'object' ? JSON.stringify(v) : v}</td>\`).join('') + '</tr>';
    });
  } else {
    rowsHtml = \`<tr><td colspan="\${columns.length}" style="text-align:center;padding:20px;color:var(--muted);">No records found in \${key}. Click + Add Record to insert data.</td></tr>\`;
  }
  document.getElementById('module-tbody').innerHTML = rowsHtml;
}

function toggleModuleForm() {
  const box = document.getElementById('module-form-box');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function handleModuleSubmit(e) {
  e.preventDefault();
  let endpoint = '/api/patients';
  let bodyData = {};

  if (['patients', 'patient-search'].includes(activeModuleKey)) {
    endpoint = '/api/patients';
    bodyData = {
      name: document.getElementById('fm-1').value,
      age: document.getElementById('fm-2').value,
      sex: document.getElementById('fm-3').value,
      contact: document.getElementById('fm-4').value,
      address: document.getElementById('fm-5').value
    };
  } else if (['medicines', 'pharmacy', 'batches'].includes(activeModuleKey)) {
    endpoint = '/api/medicines';
    bodyData = {
      brand_name: document.getElementById('fm-1').value,
      generic_name: document.getElementById('fm-2').value,
      batch_no: document.getElementById('fm-3').value,
      available_qty: document.getElementById('fm-4').value,
      sale_rate: document.getElementById('fm-5').value
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(bodyData)
  });
  const data = await res.json();
  if (data.success) {
    alert(data.message);
    toggleModuleForm();
    loadModuleData(activeModuleKey);
  }
}

// AR AI ASSISTANT FUNCTIONS
function toggleAiPanel() {
  const p = document.getElementById('ai-panel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
}

async function sendAiQuery() {
  const inp = document.getElementById('ai-input');
  const msg = inp.value.trim();
  if (!msg) return;

  const box = document.getElementById('ai-messages');
  box.innerHTML += \`<div style="margin-top:8px;text-align:right;"><strong>You:</strong> \${msg}</div>\`;
  inp.value = '';

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ query: msg })
  });
  const data = await res.json();
  box.innerHTML += \`<div style="margin-top:8px;color:var(--navy);"><strong>AR AI:</strong> \${data.reply}</div>\`;
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