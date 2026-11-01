require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Supabase PostgreSQL Database Connection
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

// Enterprise Central Store with RBAC, UHID & Calculations
let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'] }
    ],
    patients: [
        { id: 1, uhid: 'UHID2026001', name: 'Aarif Rabbani', age: 27, sex: 'Male', contact: '9876543210', address: 'Maharajganj, UP', status: 'Active OPD' }
    ],
    opdTokens: [
        { token: 1, uhid: 'UHID2026001', patientName: 'Aarif Rabbani', doctor: 'Dr. A. Khan (General)', status: 'Waiting', date: '2026-11-01' }
    ],
    medicines: [
        { id: 1, med_id: 'MED001', brand_name: 'Paracetamol 650mg', generic_name: 'Paracetamol', batch_no: 'B2601', available_qty: 150, sale_rate: 20.00, mrp: 22.00, units_per_pack: 10 },
        { id: 2, med_id: 'MED002', brand_name: 'Amoxycillin 500mg', generic_name: 'Amoxycillin', batch_no: 'B2602', available_qty: 85, sale_rate: 45.00, mrp: 50.00, units_per_pack: 10 }
    ],
    bills: [
        { id: 1, inv_no: 'PBILL311026846', date: '2026-10-31', uhid: 'UHID2026001', customer_name: 'Aarif Rabbani', mobile: '9876543210', items_count: 2, net_total: 800.00 }
    ],
    attendance: [
        { id: 1, empName: 'Aarif Rabbani', role: 'Super Admin', date: '2026-11-01', checkIn: '09:00 AM', status: 'Present' }
    ],
    ipdBeds: [
        { ward: 'General Ward A', bedNo: 'BED-101', uhid: 'UHID2026001', patientName: 'Rahul Verma', status: 'Occupied' },
        { ward: 'General Ward A', bedNo: 'BED-102', uhid: '', patientName: 'Vacant', status: 'Available' }
    ]
};

// --- REST API ENDPOINTS ---

// 1. Interactive Auth & User Creation (Super Admin Control)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = erpData.users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, user: { name: user.name, username: user.username, role: user.role, permissions: user.permissions } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Username or Password' });
    }
});

app.get('/api/users', (req, res) => {
    res.json(erpData.users);
});

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
        role: role || 'Receptionist',
        permissions: permissions || ['read']
    };
    erpData.users.push(newUser);
    res.json({ success: true, message: 'New Staff User Created Successfully', user: newUser });
});

// 2. Universal Patient Registration & Search
app.get('/api/patients', async (req, res) => {
    try {
        if (pool) {
            const dbRes = await pool.query('SELECT * FROM patients ORDER BY id DESC');
            if (dbRes.rows.length > 0) return res.json(dbRes.rows);
        }
        res.json(erpData.patients);
    } catch (err) {
        res.json(erpData.patients);
    }
});

app.post('/api/patients', async (req, res) => {
    const p = req.body;
    const existing = erpData.patients.find(x => x.contact === p.contact);
    if (existing) {
        return res.json({ success: true, message: 'Patient already registered with UHID', patient: existing });
    }
    const uhid = `UHID${Date.now().toString().slice(-6)}`;
    const newPatient = { id: Date.now(), uhid, name: p.name, age: p.age, sex: p.sex, contact: p.contact, address: p.address || 'Local', status: 'Active OPD' };
    erpData.patients.unshift(newPatient);

    // Auto-create token for registered patient
    erpData.opdTokens.unshift({ token: erpData.opdTokens.length + 1, uhid, patientName: p.name, doctor: 'Dr. A. Khan (General)', status: 'Waiting', date: new Date().toISOString().split('T')[0] });

    if (pool) {
        try {
            await pool.query('INSERT INTO patients (uhid, name, age, sex, contact, address) VALUES ($1, $2, $3, $4, $5, $6)', [uhid, p.name, p.age, p.sex, p.contact, p.address]);
        } catch (dbErr) {
            console.error('DB insert warning:', dbErr.message);
        }
    }
    res.json({ success: true, message: 'Patient Registered & Universal UHID Generated', patient: newPatient });
});

// 3. Metrics & Live Calculations
app.get('/api/dashboard/metrics', async (req, res) => {
    let totalRevenue = erpData.bills.reduce((acc, b) => acc + Number(b.net_total), 0);
    let billsCount = erpData.bills.length;
    let patientsCount = erpData.patients.length;

    if (pool) {
        try {
            const dbRev = await pool.query('SELECT SUM(net_total) as revenue, COUNT(*) as cnt FROM sales_invoices');
            if (dbRev.rows[0].revenue) {
                totalRevenue = Number(dbRev.rows[0].revenue);
                billsCount = Number(dbRev.rows[0].cnt);
            }
            const dbPat = await pool.query('SELECT COUNT(*) as cnt FROM patients');
            if (dbPat.rows[0].cnt) {
                patientsCount = Number(dbPat.rows[0].cnt);
            }
        } catch (e) {}
    }

    res.json({
        success: true,
        totalRevenue,
        registeredPatients: patientsCount,
        activeIpdBeds: erpData.ipdBeds.filter(b => b.status === 'Occupied').length,
        pharmacySalesCount: billsCount,
        lowStockItems: erpData.medicines.filter(m => m.available_qty < 50).length
    });
});

// 4. Pharmacy POS & Stock Auto-Deduction
app.get('/api/medicines', async (req, res) => {
    res.json(erpData.medicines);
});

app.get('/api/bills', async (req, res) => {
    res.json(erpData.bills);
});

app.post('/api/bills', async (req, res) => {
    const { uhid, cust, mob, medId, qty, price } = req.body;
    const invNo = `PBILL${Date.now().toString().slice(-8)}`;
    const netTotal = Number(price) * Number(qty);
    
    // Auto deduct inventory stock
    const med = erpData.medicines.find(m => m.med_id === medId || m.id === Number(medId));
    if (med) {
        med.available_qty = Math.max(0, med.available_qty - Number(qty));
    }

    const newBill = {
        id: Date.now(),
        inv_no: invNo,
        date: new Date().toISOString().split('T')[0],
        uhid: uhid || 'WALK-IN',
        customer_name: cust || 'Walk-in Patient',
        mobile: mob || '',
        items_count: Number(qty),
        net_total: netTotal
    };
    erpData.bills.unshift(newBill);

    if (pool) {
        try {
            await pool.query('INSERT INTO sales_invoices (inv_no, date, customer_name, mobile, subtotal, net_total) VALUES ($1, $2, $3, $4, $5, $6)', [invNo, newBill.date, newBill.customer_name, newBill.mobile, netTotal, netTotal]);
        } catch (dbErr) {}
    }

    res.json({ success: true, message: 'POS Bill Generated & Stock Updated Successfully', bill: newBill });
});

// 5. OPD Tokens & Attendance
app.get('/api/opd-tokens', (req, res) => res.json(erpData.opdTokens));

app.post('/api/opd-tokens/attend', (req, res) => {
    const { tokenNo } = req.body;
    const item = erpData.opdTokens.find(t => t.token === Number(tokenNo));
    if (item) {
        item.status = 'Completed';
        res.json({ success: true, message: `Token #${tokenNo} Completed` });
    } else {
        res.status(404).json({ success: false });
    }
});

app.get('/api/attendance', (req, res) => res.json(erpData.attendance));

app.post('/api/attendance/checkin', (req, res) => {
    const { empName, role } = req.body;
    const entry = {
        id: Date.now(),
        empName: empName || 'Aarif Rabbani',
        role: role || 'Super Admin',
        date: new Date().toISOString().split('T')[0],
        checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Present'
    };
    erpData.attendance.unshift(entry);
    res.json({ success: true, message: 'Check-In Marked', entry });
});

app.get('/api/ipd', (req, res) => res.json(erpData.ipdBeds));

// --- FRONTEND APP LAYOUT ---
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

/* PREMIUM DUAL-PANEL LOGIN PAGE */
#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:linear-gradient(135deg,#eef2f7 0%,#c9d6ff 100%);position:fixed;z-index:9999}
.login-container{background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(16,36,58,0.15);width:min(850px,92vw);height:520px;display:flex;overflow:hidden}
.login-left{flex:1.2;padding:50px 45px;display:flex;flex-direction:column;justify-content:center}
.login-left h2{font-size:26px;color:var(--navy);font-weight:800;margin-bottom:8px}
.login-left p{font-size:13px;color:var(--muted);margin-bottom:30px}
.login-right{flex:1;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:50px 40px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative}
.login-right::after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle at 80% 20%,rgba(38,116,232,0.3),transparent)}
.login-field{margin-bottom:18px;text-align:left}
.login-field label{display:block;font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px}
.login-input{width:100%;padding:13px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:#f8fafc;outline:none;transition:.2s}
.login-input:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 3px rgba(38,116,232,0.1)}
.login-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--blue),#1d5ec4);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-top:10px;box-shadow:0 8px 20px rgba(38,116,232,0.3)}

/* MAIN DASHBOARD LAYOUT */
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
.view-section.active{display:block;animation:fadeIn .2s ease-in-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:22px}
.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow)}
.stat-top{display:flex;justify-content:space-between;align-items:center}
.stat-label{font-size:11px;color:var(--muted);font-weight:700}
.stat-value{font-size:26px;font-weight:800;margin:12px 0 4px;color:var(--navy)}

.panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:22px;margin-bottom:22px}
.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.panel-head h3{font-size:15px;margin:0;color:var(--navy);font-weight:700}

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
.btn-sm{padding:5px 10px;font-size:11px}
</style>
</head>
<body>

<!-- DUAL PANEL INTERACTIVE LOGIN -->
<div id="login-screen">
  <div class="login-container">
    <div class="login-left">
      <h2>Sign In</h2>
      <p>Enter your credentials to access AR Healthcare ERP</p>
      <form onsubmit="handleLogin(event)">
        <div class="login-field"><label>Username</label><input type="text" id="login-u" class="login-input" value="Aarif" required></div>
        <div class="login-field"><label>Password</label><input type="password" id="login-p" class="login-input" value="7860" required></div>
        <button type="submit" class="login-btn">Sign In ➔</button>
      </form>
    </div>
    <div class="login-right">
      <h2 style="font-size:28px;margin-bottom:12px;">Hello, Friend!</h2>
      <p style="font-size:13px;line-height:1.6;opacity:.85;margin-bottom:25px;">Welcome to the next generation Commercial Enterprise HIMS & Pharmacy ERP Platform.</p>
    </div>
  </div>
</div>

<!-- MAIN DASHBOARD -->
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
        <div><strong id="user-display-name" style="font-size:13px;display:block;">Aarif Rabbani</strong><small id="user-display-role" style="font-size:10px;color:var(--muted);">Super Admin</small></div>
        <button class="btn btn-sm" onclick="handleLogout()" style="margin-left:15px;background:#ef4444;color:#fff;border:none;">Logout</button>
      </div>
    </header>

    <section class="content">
      
      <!-- DASHBOARD -->
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-top"><span class="stat-label">TODAY'S REVENUE</span></div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-top"><span class="stat-label">REGISTERED PATIENTS</span></div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-top"><span class="stat-label">ACTIVE IPD BEDS</span></div><div class="stat-value" id="m-ipd">1 / 20</div></div>
          <div class="stat"><div class="stat-top"><span class="stat-label">LOW STOCK ALERTS</span></div><div class="stat-value" id="m-stock">0</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Recent Sales Invoices & POS Transactions</h3></div>
          <table>
            <thead><tr><th>Invoice No</th><th>Date</th><th>Customer / UHID</th><th>Mobile</th><th>Items</th><th>Net Total (₹)</th></tr></thead>
            <tbody id="dash-bills"></tbody>
          </table>
        </div>
      </div>

      <!-- PATIENTS (UNIVERSAL UHID) -->
      <div id="view-patients" class="view-section">
        <div class="panel">
          <div class="panel-head"><h3>Patient Master Universal Registration (UHID)</h3></div>
          <form onsubmit="handlePatientReg(event)">
            <div class="form-grid">
              <div class="field"><label>Patient Name</label><input type="text" id="p-name" required></div>
              <div class="field"><label>Age</label><input type="number" id="p-age" required></div>
              <div class="field"><label>Gender</label><select id="p-sex"><option>Male</option><option>Female</option></select></div>
              <div class="field"><label>Mobile</label><input type="text" id="p-mob" required></div>
              <div class="field"><label>Address</label><input type="text" id="p-addr"></div>
            </div>
            <button type="submit" class="btn primary">+ Register Patient & Issue Token</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Registered Patients Database</h3></div>
          <table>
            <thead><tr><th>UHID</th><th>Patient Name</th><th>Age/Sex</th><th>Contact</th><th>Address</th><th>Status</th></tr></thead>
            <tbody id="patients-list"></tbody>
          </table>
        </div>
      </div>

      <!-- OPD QUEUE -->
      <div id="view-opd" class="view-section">
        <div class="panel">
          <div class="panel-head"><h3>OPD Doctor Consultation Token Queue</h3></div>
          <table>
            <thead><tr><th>Token No</th><th>UHID</th><th>Patient Name</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="opd-list"></tbody>
          </table>
        </div>
      </div>

      <!-- PHARMACY POS -->
      <div id="view-pharmacy" class="view-section">
        <div class="panel">
          <div class="panel-head"><h3>POS Sales Billing & Live Stock Deduction</h3></div>
          <form onsubmit="handlePosBill(event)">
            <div class="form-grid">
              <div class="field"><label>Patient UHID / Search</label><input type="text" id="pos-uhid" placeholder="UHID..." onchange="autoFetchPatient(this.value)"></div>
              <div class="field"><label>Customer Name</label><input type="text" id="pos-cust" required></div>
              <div class="field"><label>Select Medicine</label><select id="pos-med" onchange="updatePosRate()"></select></div>
              <div class="field"><label>Sale Price (₹)</label><input type="number" id="pos-price" required></div>
              <div class="field"><label>Quantity</label><input type="number" id="pos-qty" value="1" required></div>
            </div>
            <button type="submit" class="btn success">💾 Complete Transaction</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Pharmacy Inventory Master (FEFO)</h3></div>
          <table>
            <thead><tr><th>Med ID</th><th>Brand Name</th><th>Generic</th><th>Batch</th><th>Available Stock</th><th>Rate (₹)</th></tr></thead>
            <tbody id="med-list"></tbody>
          </table>
        </div>
      </div>

      <!-- SUPER ADMIN USER PERMISSIONS -->
      <div id="view-users" class="view-section">
        <div class="panel">
          <div class="panel-head"><h3>Super Admin: User Creation & Granular Permissions Control</h3></div>
          <form onsubmit="handleCreateUser(event)">
            <div class="form-grid">
              <div class="field"><label>Full Name</label><input type="text" id="u-fullname" required></div>
              <div class="field"><label>Username</label><input type="text" id="u-user" required></div>
              <div class="field"><label>Password</label><input type="text" id="u-pass" required></div>
              <div class="field"><label>Role</label><select id="u-role"><option>Receptionist</option><option>Pharmacist</option><option>Doctor</option><option>Accountant</option><option>Administrator</option></select></div>
              <div class="field"><label>Permission Module</label><select id="u-perm"><option value="patients">Patients Only</option><option value="pharmacy">Pharmacy Only</option><option value="opd">OPD Queue Only</option><option value="all">Full Access</option></select></div>
            </div>
            <button type="submit" class="btn primary">+ Create User & Assign Power</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>System Active Users</h3></div>
          <table>
            <thead><tr><th>User ID</th><th>Name</th><th>Username</th><th>Role</th><th>Permissions</th></tr></thead>
            <tbody id="users-list"></tbody>
          </table>
        </div>
      </div>

    </section>
  </main>
</div>

<script>
let currentUser = null;
let globalMedicines = [];
let globalPatients = [];

const navGroups = [
  { label: "OVERVIEW", items: [["Dashboard", "dashboard", "▦"]] },
  { label: "HOSPITAL", items: [["Patient Registration", "patients", "＋"], ["OPD & Appointments", "opd", "◷"]] },
  { label: "PHARMACY", items: [["POS Sales & Inventory", "pharmacy", "₹"]] },
  { label: "ADMINISTRATION", items: [["User Roles & Permissions", "users", "⚿"]] }
];

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
      document.getElementById('user-display-name').innerText = data.user.name;
      document.getElementById('user-display-role').innerText = data.user.role;
      document.getElementById('user-avatar').innerText = data.user.name.slice(0,2).toUpperCase();
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      renderNav();
      loadAllData();
    } else {
      alert(data.message || 'Login Failed');
    }
  } catch (err) {
    alert('Network Error');
  }
}

function handleLogout() {
  location.reload();
}

function renderNav() {
  let html = "";
  navGroups.forEach(g => {
    html += \`<div class="nav-label">\${g.label}</div>\`;
    g.items.forEach(i => {
      // Granular permissions check
      if (currentUser.role === 'Super Admin' || currentUser.permissions.includes('all') || currentUser.permissions.includes(i[1])) {
        html += \`<button class="nav-item \${i[1]==='dashboard'?'active':''}" onclick="switchView('\${i[1]}', this)"><span class="nav-icon">\${i[2]}</span><span>\${i[0]}</span></button>\`;
      }
    });
  });
  document.getElementById('nav-menu').innerHTML = html;
}

function switchView(targetId, btn) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + targetId).classList.add('active');
  document.getElementById('topbar-title').innerText = targetId.toUpperCase();
}

async function loadAllData() {
  // Metrics
  const mRes = await fetch('/api/dashboard/metrics');
  const mData = await mRes.json();
  if (mData.success) {
    document.getElementById('m-rev').innerText = '₹' + mData.totalRevenue.toFixed(2);
    document.getElementById('m-pat').innerText = mData.registeredPatients;
    document.getElementById('m-stock').innerText = mData.lowStockItems;
  }

  // Bills
  const bRes = await fetch('/api/bills');
  const bills = await bRes.json();
  let bHtml = "";
  bills.forEach(b => {
    bHtml += \`<tr><td>\${b.inv_no}</td><td>\${b.date}</td><td>\${b.customer_name} (\${b.uhid})</td><td>\${b.mobile||'-'}</td><td>\${b.items_count}</td><td>₹\${Number(b.net_total).toFixed(2)}</td></tr>\`;
  });
  document.getElementById('dash-bills').innerHTML = bHtml;

  // Patients
  const pRes = await fetch('/api/patients');
  globalPatients = await pRes.json();
  let pHtml = "";
  globalPatients.forEach(p => {
    pHtml += \`<tr><td><strong>\${p.uhid}</strong></td><td>\${p.name}</td><td>\${p.age}/\${p.sex}</td><td>\${p.contact}</td><td>\${p.address}</td><td><span style="color:#10b981;font-weight:700;">\${p.status}</span></td></tr>\`;
  });
  document.getElementById('patients-list').innerHTML = pHtml;

  // Medicines
  const medRes = await fetch('/api/medicines');
  globalMedicines = await medRes.json();
  let mHtml = "";
  let selHtml = "";
  globalMedicines.forEach(m => {
    mHtml += \`<tr><td>\${m.med_id}</td><td>\${m.brand_name}</td><td>\${m.generic_name}</td><td>\${m.batch_no}</td><td><strong>\${m.available_qty}</strong></td><td>₹\${Number(m.sale_rate).toFixed(2)}</td></tr>\`;
    selHtml += \`<option value="\${m.med_id}">\${m.brand_name} (Stock: \${m.available_qty})</option>\`;
  });
  document.getElementById('med-list').innerHTML = mHtml;
  document.getElementById('pos-med').innerHTML = selHtml;
  updatePosRate();

  // OPD
  const opdRes = await fetch('/api/opd-tokens');
  const opdList = await opdRes.json();
  let oHtml = "";
  opdList.forEach(o => {
    const btn = o.status==='Waiting'?\`<button class="btn btn-sm success" onclick="attendOpd(\${o.token})">Attend</button>\`:'✓ Done';
    oHtml += \`<tr><td>#\${o.token}</td><td>\${o.uhid}</td><td>\${o.patientName}</td><td>\${o.doctor}</td><td>\${o.status}</td><td>\${btn}</td></tr>\`;
  });
  document.getElementById('opd-list').innerHTML = oHtml;

  // Users
  const uRes = await fetch('/api/users');
  const uList = await uRes.json();
  let uHtml = "";
  uList.forEach(u => {
    uHtml += \`<tr><td>\${u.id}</td><td>\${u.name}</td><td>\${u.username}</td><td>\${u.role}</td><td>\${JSON.stringify(u.permissions)}</td></tr>\`;
  });
  document.getElementById('users-list').innerHTML = uHtml;
}

function autoFetchPatient(uhid) {
  const p = globalPatients.find(x => x.uhid === uhid.trim());
  if (p) {
    document.getElementById('pos-cust').value = p.name;
  }
}

function updatePosRate() {
  const medId = document.getElementById('pos-med').value;
  const m = globalMedicines.find(x => x.med_id === medId);
  if (m) {
    document.getElementById('pos-price').value = m.sale_rate;
  }
}

async function handlePatientReg(e) {
  e.preventDefault();
  const name = document.getElementById('p-name').value;
  const age = document.getElementById('p-age').value;
  const sex = document.getElementById('p-sex').value;
  const contact = document.getElementById('p-mob').value;
  const address = document.getElementById('p-addr').value;

  const res = await fetch('/api/patients', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, age, sex, contact, address })
  });
  const data = await res.json();
  if (data.success) {
    alert(data.message + ' | UHID: ' + data.patient.uhid);
    loadAllData();
  }
}

async function handlePosBill(e) {
  e.preventDefault();
  const uhid = document.getElementById('pos-uhid').value;
  const cust = document.getElementById('pos-cust').value;
  const medId = document.getElementById('pos-med').value;
  const price = document.getElementById('pos-price').value;
  const qty = document.getElementById('pos-qty').value;

  const res = await fetch('/api/bills', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ uhid, cust, medId, price, qty })
  });
  const data = await res.json();
  if (data.success) {
    alert('Bill Generated Successfully! Invoice: ' + data.bill.inv_no);
    loadAllData();
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  if (currentUser.role !== 'Super Admin') {
    alert('Only Super Admin can create users!');
    return;
  }
  const name = document.getElementById('u-fullname').value;
  const username = document.getElementById('u-user').value;
  const password = document.getElementById('u-pass').value;
  const role = document.getElementById('u-role').value;
  const perm = [document.getElementById('u-perm').value];

  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, username, password, role, permissions: perm })
  });
  const data = await res.json();
  if (data.success) {
    alert('User Created!');
    loadAllData();
  } else {
    alert(data.message);
  }
}

async function attendOpd(tokenNo) {
  await fetch('/api/opd-tokens/attend', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ tokenNo })
  });
  loadAllData();
}
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live on port ${PORT}`);
});