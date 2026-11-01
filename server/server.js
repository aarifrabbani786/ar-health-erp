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
    return 'AR' + todayStr + '-' + dailySequence.count.toString().padStart(2, '0');
}

let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active' },
        { id: 'USR-102', name: 'Staff Reception', username: 'staff', password: '123', role: 'Cashier / Receptionist', permissions: ['patients', 'search', 'billing'], status: 'Active' }
    ],
    patients: [
        { uhid: 'AR011126-01', title: 'Mr.', name: 'Aarif Rabbani', relation: 'S/O', guardian: 'Md Rabbani', age: 27, gender: 'Male', contact: '9876543210', adhaar: '123456789012', abha: 'ABHA12345678', address: 'Maharajganj, UP', doctor: 'Dr. A. Khan', fee: 500, discount: 50, netFee: 450, payType: 'Cash', date: '2026-11-01 14:00', workflowStatus: 'Registered & Visited' }
    ],
    doctors: [
        { id: 'DOC1', name: 'Dr. A. Khan (General Physician)', fee: 500, department: 'General Medicine' },
        { id: 'DOC2', name: 'Dr. Priya Singh (Gynecologist)', fee: 700, department: 'Gynecology' }
    ],
    bills: [
        { billNo: 'BILL-011126-01', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', doctor: 'Dr. A. Khan', totalFee: 500, discount: 50, netFee: 450, payType: 'Cash', createdBy: 'Aarif (Super Admin)', dateTime: '2026-11-01 14:00', edited: false }
    ],
    editRequests: [],
    auditLogs: [
        { time: '2026-11-01 14:00', user: 'Aarif Rabbani', action: 'System Initialized & Default User Loaded' }
    ]
};

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = (username || '').trim().toLowerCase();
        const user = erpData.users.find(u => u.username.toLowerCase() === cleanUser && u.password === password);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid User ID or Password. (Admin: Aarif / 7860)' });
        if (user.status === 'Deactivated') return res.status(403).json({ success: false, message: 'Account is deactivated by Admin.' });
        res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users/create', (req, res) => {
    try {
        const { name, username, password, role, permissions } = req.body;
        if (erpData.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }
        const newUser = {
            id: 'USR-' + Date.now().toString().slice(-4),
            name, username: username.trim(), password, role,
            permissions: permissions || ['patients', 'search'],
            status: 'Active'
        };
        erpData.users.push(newUser);
        erpData.auditLogs.unshift({ time: new Date().toLocaleString('en-GB'), user: 'Admin', action: 'Created user ' + name + ' (' + role + ')' });
        res.json({ success: true, message: 'User created successfully', users: erpData.users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users/status', (req, res) => {
    const { userId, status } = req.body;
    const user = erpData.users.find(u => u.id === userId);
    if (user) {
        user.status = status;
        res.json({ success: true, users: erpData.users });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.post('/api/users/change-password', (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    const user = erpData.users.find(u => u.username.toLowerCase() === (username || '').trim().toLowerCase());
    if (!user || user.password !== oldPassword) {
        return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }
    user.password = newPassword;
    res.json({ success: true, message: 'Password updated successfully!' });
});

app.get('/api/users', (req, res) => res.json(erpData.users));
app.get('/api/doctors', (req, res) => res.json(erpData.doctors));

app.post('/api/doctors/add', (req, res) => {
    const { name, fee, department } = req.body;
    const newDoc = { id: 'DOC' + Date.now().toString().slice(-4), name, fee: Number(fee), department };
    erpData.doctors.push(newDoc);
    res.json({ success: true, doctors: erpData.doctors });
});

app.get('/api/next-uhid', (req, res) => res.json({ uhid: getNextUHID() }));

app.post('/api/patients/register', (req, res) => {
    try {
        const p = req.body;
        if (!/^\d{10}$/.test(p.contact)) return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });

        const uhid = p.existingUhid || getNextUHID();
        const nowStr = new Date().toLocaleString('en-GB');
        const fee = Number(p.fee || 0);
        const discount = Number(p.discount || 0);
        const netFee = Math.max(0, fee - discount);

        const newPatient = {
            uhid, title: p.title || 'Mr.', name: p.name, relation: p.relation || 'C/O', guardian: p.guardian || '',
            age: p.age, gender: p.gender, contact: p.contact, adhaar: p.adhaar || '', abha: p.abha || '',
            address: p.address || '', doctor: p.doctor, fee, discount, netFee, payType: p.payType || 'Cash', date: nowStr, workflowStatus: 'Registered & Visited'
        };
        erpData.patients.unshift(newPatient);

        const billNo = 'BILL-' + Date.now().toString().slice(-6);
        const newBill = {
            billNo, uhid, patientName: p.title + ' ' + p.name, doctor: p.doctor, totalFee: fee, discount, netFee,
            payType: p.payType, createdBy: p.createdBy || 'Staff', dateTime: nowStr, edited: false
        };
        erpData.bills.unshift(newBill);

        erpData.auditLogs.unshift({ time: nowStr, user: p.createdBy || 'Staff', action: 'Registered Patient ' + p.name + ' (' + uhid + ') with Net Fee ₹' + netFee + ' [Mode: ' + p.payType + ']' });

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

app.get('/api/bills', (req, res) => res.json(erpData.bills));

app.post('/api/bills/edit-request', (req, res) => {
    const { billNo, requestedBy, reason } = req.body;
    const reqItem = { id: 'REQ-' + Date.now(), billNo, requestedBy, reason, status: 'Pending', time: new Date().toLocaleString('en-GB') };
    erpData.editRequests.unshift(reqItem);
    res.json({ success: true, message: 'Edit request submitted to Admin for approval.' });
});

app.get('/api/edit-requests', (req, res) => res.json(erpData.editRequests));

app.post('/api/edit-requests/action', (req, res) => {
    const { requestId, status } = req.body;
    const reqItem = erpData.editRequests.find(r => r.id === requestId);
    if (reqItem) {
        reqItem.status = status;
        res.json({ success: true, editRequests: erpData.editRequests });
    } else {
        res.status(404).json({ success: false, message: 'Request not found' });
    }
});

app.post('/api/ai/query', (req, res) => {
    const { prompt } = req.body;
    const q = prompt.toLowerCase();
    let reply = 'AR AI: Main aapka AR ERP assistant hu. Aap mujhse patient records, total collection, ya credit ke baare me pooch sakte hain.';
    if (q.includes('patient') || q.includes('kitne')) {
        reply = 'AR AI: Total registered patients abhi ' + erpData.patients.length + ' hain.';
    } else if (q.includes('revenue') || q.includes('income') || q.includes('collection')) {
        let totalRev = erpData.bills.reduce((acc, b) => acc + Number(b.netFee), 0);
        reply = 'AR AI: Total hospital revenue collection abhi tak ₹' + totalRev.toFixed(2) + ' ki hui hai.';
    } else if (q.includes('credit') || q.includes('udhar')) {
        let credits = erpData.bills.filter(b => b.payType === 'Credit / Udhar');
        reply = 'AR AI: Total Credit / Udhar bills ' + credits.length + ' hain.';
    }
    res.json({ success: true, reply });
});

app.get('/api/module/:key', (req, res) => {
    const key = req.params.key;
    if (['patients', 'patient-search', 'patients-reg'].includes(key)) return res.json({ success: true, data: erpData.patients });
    if (['bills', 'hospital-billing'].includes(key)) return res.json({ success: true, data: erpData.bills });
    if (['doctors'].includes(key)) return res.json({ success: true, data: erpData.doctors });
    if (['users'].includes(key)) return res.json({ success: true, data: erpData.users });
    if (['audit-logs'].includes(key)) return res.json({ success: true, data: erpData.auditLogs });
    res.json({ success: true, data: erpData.patients });
});

app.get('/api/dashboard/metrics', (req, res) => {
    let rev = erpData.bills.reduce((acc, b) => acc + Number(b.netFee), 0);
    let creditTotal = erpData.bills.filter(b => b.payType === 'Credit / Udhar').reduce((acc, b) => acc + Number(b.netFee), 0);
    res.json({ success: true, totalRevenue: rev, creditTotal, registeredPatients: erpData.patients.length, activeIpdBeds: 2, lowStockItems: 1 });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AR ERP Complete Billing Software</title>
<style>
:root{--navy:#10243a;--navy2:#173650;--blue:#2674e8;--cyan:#16b8b0;--bg:#f3f6fb;--card:#fff;--text:#18283d;--muted:#718096;--line:#e4eaf2;--green:#16875d;--red:#c93c48;--shadow:0 8px 28px rgba(23,44,75,.07)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}

#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:url('https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=1920&auto=format&fit=crop') no-repeat center center/cover;position:fixed;z-index:9999}

.login-card-wrapper{background:rgba(15, 23, 42, 0.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,0.3);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,0.6);width:min(880px,94vw);height:500px;display:flex;overflow:hidden;position:relative;z-index:1}
.login-card-wrapper::after{content:'';position:absolute;inset:-3px;border-radius:27px;background:linear-gradient(45deg,#22c55e,#3b82f6,#06b6d4,#10b981);z-index:-1;opacity:0.5;filter:blur(10px)}

.login-left{flex:1.2;padding:40px 45px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:rgba(15,23,42,0.75);color:#fff}
.login-left h2{font-size:26px;font-weight:800;margin-bottom:15px;color:#fff;width:100%}
.login-left form{width:100%;max-width:320px}

.login-right{flex:1;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(59,130,246,0.25));color:#fff;padding:50px 40px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}

.login-field{margin-bottom:16px;text-align:left;position:relative}
.login-field label{display:block;font-size:11px;font-weight:700;color:#e2e8f0;margin-bottom:6px}
.login-input{width:100%;padding:12px 40px 12px 14px;border:1px solid rgba(255,255,255,0.3);border-radius:10px;font-size:14px;background:rgba(15,23,42,0.85);color:#ffffff !important;outline:none}
.login-input::placeholder{color:#94a3b8}

.eye-btn{position:absolute;right:12px;top:32px;background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;padding:4px;z-index:20}
.login-btn{width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-top:10px;box-shadow:0 8px 20px rgba(16,185,129,0.4);text-align:center}

#app{display:none;height:100vh;width:100vw;flex-direction:row}
.sidebar{width:272px;background:linear-gradient(180deg,var(--navy),#0d1c2c);color:#d9e6f5;display:flex;flex-direction:column;flex-shrink:0;transition:all 0.3s ease}
.brand{display:flex;align-items:center;gap:12px;padding:22px 18px;border-bottom:1px solid #ffffff18}
.logo{width:43px;height:43px;border-radius:13px;background:linear-gradient(135deg,#23c6b8,#3478f6);display:grid;place-items:center;color:white;font-weight:900;font-size:16px}
.brand strong{display:block;font-size:14px;color:#fff}
.brand small{display:block;color:#9db3ca;font-size:11px;margin-top:4px}
.nav{padding:12px 10px 30px;overflow-y:auto;flex:1}
.nav-label{font-size:10px;letter-spacing:1.5px;color:#7893ae;padding:16px 11px 7px;font-weight:800}
.nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;margin:2px 0;color:#c6d4e4;font-size:12.5px;border:0;background:transparent;width:100%;text-align:left;cursor:pointer;transition:all 0.2s}
.nav-item:hover,.nav-item.active{background:#ffffff15;color:#fff;transform:translateX(4px)}
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
.stat-value{font-size:24px;font-weight:800;margin:12px 0 4px;color:var(--navy)}
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
#ar-ai-widget{position:fixed;bottom:25px;right:25px;z-index:99999}
#ar-ai-btn{background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;border:none;border-radius:50px;padding:12px 22px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 10px 25px rgba(38,116,232,0.3);display:flex;align-items:center;gap:8px}
#ar-ai-box{position:absolute;bottom:60px;right:0;width:350px;background:#fff;border-radius:16px;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;border:1px solid var(--line)}
.ai-head{background:var(--navy);color:#fff;padding:14px;font-weight:700;font-size:13px;display:flex;justify-content:space-between}
.ai-body{padding:15px;max-height:250px;overflow-y:auto;font-size:12px;display:flex;flex-direction:column;gap:10px}
.ai-foot{padding:10px;border-top:1px solid var(--line);display:flex;gap:8px}
.ai-foot input{flex:1;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;outline:none}
#print-modal{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;justify-content:center;align-items:center;z-index:99999}
.print-card{background:#fff;padding:30px;border-radius:16px;width:min(650px,95vw);box-shadow:0 20px 50px rgba(0,0,0,0.3)}
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
  <div class="login-card-wrapper">
    <div class="login-left">
      <h2>Sign In</h2>
      <form id="login-form-element" onsubmit="handleLogin(event)">
        <div class="login-field">
          <label>User ID / Username</label>
          <input type="text" id="login-u" class="login-input" required autocomplete="username">
        </div>
        <div class="login-field">
          <label>Password</label>
          <input type="password" id="login-p" class="login-input" required autocomplete="current-password">
          <button type="button" class="eye-btn" id="eye-toggle-btn" onclick="togglePasswordVisibility()">👁</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;font-size:11px;">
          <a href="#" onclick="alert('Please contact your Administrator or Super Admin to recover your User ID & Password.');return false;" style="color:#38bdf8;text-decoration:none;">Forgot User ID?</a>
        </div>
        <button type="submit" class="login-btn">Sign In ➔</button>
      </form>
    </div>
    <div class="login-right">
      <h2>AR ERP COMPLETE BILLING SOFTWARE</h2>
      <p style="font-size:13px;line-height:1.6;opacity:.85;margin-top:10px;">Advanced Hospital & Pharmacy Billing System</p>
      <div style="margin-top:20px;font-size:11px;opacity:0.7;">Multi-Mode Billing & Clinical AI</div>
    </div>
  </div>
</div>

<div id="app">
  <aside class="sidebar" id="sidebar-panel">
    <div class="brand"><div class="logo">AR</div><div><strong>AR ERP BILLING</strong><small>Complete Billing & ERP</small></div></div>
    <nav class="nav" id="nav-menu"></nav>
  </aside>

  <main class="main">
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:15px;">
        <button class="btn btn-sm" onclick="toggleSidebarSlide()" style="padding:6px 10px;font-size:14px;">☰</button>
        <h3 id="topbar-title" style="font-size:17px;font-weight:700;color:var(--navy);">Dashboard</h3>
      </div>
      <div class="profile">
        <div class="avatar" id="user-avatar">AR</div>
        <div><strong id="user-display-name" style="font-size:13px;display:block;">-</strong><small id="user-display-role" style="font-size:10px;color:var(--muted);">-</small></div>
        <button class="btn btn-sm danger" onclick="handleLogout()" style="margin-left:15px;">Logout</button>
      </div>
    </header>

    <section class="content">
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-label">TOTAL REVENUE (COLLECTED)</div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-label">CREDIT / UDHAR TOTAL</div><div class="stat-value" id="m-credit" style="color:var(--red);">₹0.00</div></div>
          <div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">2 / 20</div></div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Quick Find & Patient Workflow Hub</h3><small style="color:var(--muted)">Search patient instantly & perform any action</small></div>
          <div style="position:relative;margin-bottom:15px;">
            <input type="text" id="dash-quick-find" placeholder="🔍 Type Patient Name, Mobile or UHID..." oninput="handleDashQuickFind(this.value)" style="width:100%;padding:12px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;outline:none;">
            <div class="suggestions-box" id="dash-quick-suggestions"></div>
          </div>
          <table>
            <thead><tr><th>UHID</th><th>Patient Name</th><th>Mobile</th><th>Doctor</th><th>Net Fee (₹)</th><th>Status / Workflow</th><th>Quick Actions</th></tr></thead>
            <tbody id="dash-patients"></tbody>
          </table>
        </div>
      </div>

      <div id="view-module-container" class="view-section">
        <div class="panel" id="patient-reg-panel" style="display:none;">
          <div class="panel-head"><h3>New Patient Registration & Quick Billing</h3></div>
          <form onsubmit="handlePatientRegistration(event)">
            <div class="form-grid">
              <div class="field"><label>Auto UHID (Date-Wise)</label><input type="text" id="reg-uhid" readonly style="background:#edf2f7;font-weight:700;color:var(--blue);"></div>
              <div class="field"><label>Live Patient Search</label><input type="text" id="live-search-input" placeholder="Type Name, Mobile..." oninput="handleLiveSearch(this.value)" autocomplete="off"><div class="suggestions-box" id="search-suggestions"></div></div>
              <div class="field"><label>Title</label><select id="reg-title"><option>Mr.</option><option>Mrs.</option><option>Miss</option><option>Master</option><option>Baby of</option></select></div>
              <div class="field"><label>Patient Name *</label><input type="text" id="reg-name" required></div>
              <div class="field"><label>Relation</label><select id="reg-relation"><option>S/O</option><option>D/O</option><option>W/O</option><option>C/O</option></select></div>
              <div class="field"><label>Guardian Name</label><input type="text" id="reg-guardian"></div>
              <div class="field"><label>Age *</label><input type="number" id="reg-age" required></div>
              <div class="field"><label>Gender</label><select id="reg-gender"><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div class="field"><label>Mobile No (10-Digit) *</label><input type="text" id="reg-contact" maxlength="10" required placeholder="10 digits"></div>
              <div class="field"><label>Aadhaar No</label><input type="text" id="reg-adhaar" maxlength="12" placeholder="12 digits"></div>
              <div class="field"><label>ABHA ID</label><input type="text" id="reg-abha" placeholder="ABHA Number"></div>
              <div class="field"><label>Address</label><input type="text" id="reg-address" placeholder="Address..."></div>
              <div class="field"><label>Consulting Doctor *</label><select id="reg-doctor" onchange="autoFetchDoctorFee()" required></select></div>
              <div class="field"><label>Doctor Fee (₹) *</label><input type="number" id="reg-fee" oninput="calculateNetFee()" required></div>
              <div class="field"><label>Discount (₹)</label><input type="number" id="reg-discount" value="0" oninput="calculateNetFee()"></div>
              <div class="field"><label>Net Payable Fee (₹)</label><input type="number" id="reg-netfee" readonly style="background:#edf2f7;font-weight:700;color:var(--green);"></div>
              <div class="field"><label>Payment Type *</label><select id="reg-paytype"><option>Cash</option><option>Credit / Udhar</option><option>UPI / Online</option><option>Card</option></select></div>
            </div>
            <button type="submit" class="btn primary" style="padding:12px 25px;font-size:13px;">💾 Register & Generate Bill</button>
          </form>
        </div>

        <div class="panel" id="doctor-panel" style="display:none;">
          <div class="panel-head"><h3>Manage Doctors (Add New Doctor ID/Name)</h3></div>
          <form onsubmit="handleAddNewDoctor(event)" class="form-grid">
            <div class="field"><label>Doctor Name & Qualification *</label><input type="text" id="doc-name" placeholder="Dr. Name (Specialization)" required></div>
            <div class="field"><label>Default Consultation Fee (₹) *</label><input type="number" id="doc-fee" required></div>
            <div class="field"><label>Department</label><input type="text" id="doc-dept" placeholder="General / Ortho / Gynae"></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">+ Save New Doctor</button></div>
          </form>
        </div>

        <div class="panel" id="user-mgmt-panel" style="display:none;">
          <div class="panel-head"><h3>Create User & Set Permissions</h3></div>
          <form onsubmit="handleCreateUser(event)" class="form-grid">
            <div class="field"><label>Full Name *</label><input type="text" id="new-u-name" required></div>
            <div class="field"><label>User ID / Username *</label><input type="text" id="new-u-username" required></div>
            <div class="field"><label>Password *</label><input type="password" id="new-u-password" required></div>
            <div class="field"><label>Role *</label><select id="new-u-role"><option>Cashier / Receptionist</option><option>Pharmacist</option><option>Doctor</option><option>Admin</option></select></div>
            <div class="field" style="grid-column:span 2;"><label>Permissions</label><input type="text" id="new-u-perms" value="patients, search, billing" required></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">👤 Create User Account</button></div>
          </form>
        </div>

        <div class="panel" id="password-panel" style="display:none;">
          <div class="panel-head"><h3>Change Your Account Password</h3></div>
          <form onsubmit="handleChangePassword(event)" style="max-width:400px;display:flex;flex-direction:column;gap:15px;">
            <div class="field"><label>Old Password *</label><input type="password" id="pass-old" required></div>
            <div class="field"><label>New Password *</label><input type="password" id="pass-new" required></div>
            <button type="submit" class="btn primary">Update Password</button>
          </form>
        </div>

        <div class="panel">
          <div class="panel-head"><h3 id="module-title-heading">Module Records</h3></div>
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

<div id="ar-ai-widget">
  <div id="ar-ai-box">
    <div class="ai-head"><span>🤖 AR AI Assistant</span><span style="cursor:pointer;" onclick="toggleAiBox()">✕</span></div>
    <div class="ai-body" id="ai-chat-body">
      <div><b>AR AI:</b> Hello Aarif! Ask me anything about patients, revenue, or credit bills.</div>
    </div>
    <div class="ai-foot">
      <input type="text" id="ai-input" placeholder="Ask AR AI..." onkeypress="if(event.key==='Enter')sendAiQuery()">
      <button class="btn primary" onclick="sendAiQuery()">Send</button>
    </div>
  </div>
  <button id="ar-ai-btn" onclick="toggleAiBox()">✨ AR AI</button>
</div>

<div id="print-modal">
  <div class="print-card" id="print-card-area">
    <div style="text-align:center;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:15px;">
      <h2 style="margin:0;color:var(--navy);">AR ERP COMPLETE BILLING SOFTWARE</h2>
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
      <thead><tr><th>Description</th><th>Mode</th><th>Gross (₹)</th><th>Discount (₹)</th><th>Net (₹)</th></tr></thead>
      <tbody>
        <tr>
          <td>OPD Doctor Consultation Fee</td>
          <td id="pb-paymode">Cash</td>
          <td id="pb-gross">₹0.00</td>
          <td id="pb-disc">₹0.00</td>
          <td id="pb-amount" style="font-weight:700;">₹0.00</td>
        </tr>
      </tbody>
    </table>
    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
      <button class="btn" onclick="document.getElementById('print-modal').style.display='none'">Close</button>
      <button class="btn" onclick="requestBillEdit()">✏️ Request Edit</button>
      <button class="btn primary" onclick="window.print()">🖨 Print Duplicate Bill</button>
    </div>
  </div>
</div>

<div id="prescription-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;justify-content:center;align-items:center;z-index:99999">
  <div class="print-card" style="width:min(750px,95vw);max-height:90vh;overflow-y:auto;">
    <div style="text-align:center;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:15px;">
      <h2 style="margin:0;color:var(--navy);">SKS HOSPITAL MEDICAL COLLEGE & RESEARCH CENTRE</h2>
      <p style="margin:4px 0;font-size:11px;color:var(--muted);">NH2, Village & Post - Chaumuhan, Mathura, Uttar Pradesh - 281406</p>
      <h3 style="margin:8px 0;color:var(--blue);">OPD Prescription Sheet</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:15px;border:1px solid var(--line);padding:10px;border-radius:8px;">
      <div><strong>UHID:</strong> <span id="pr-uhid"></span></div>
      <div><strong>Date:</strong> <span id="pr-date"></span></div>
      <div><strong>Patient Name:</strong> <span id="pr-name"></span></div>
      <div><strong>Age / Sex:</strong> <span id="pr-age"></span></div>
      <div><strong>Guardian:</strong> <span id="pr-guardian"></span></div>
      <div><strong>Contact:</strong> <span id="pr-contact"></span></div>
      <div><strong>Doctor Name:</strong> <span id="pr-doctor"></span></div>
      <div><strong>Address:</strong> <span id="pr-address"></span></div>
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:12px;font-weight:700;color:var(--navy);">Clinical Assessment & Symptoms / Diagnosis:</label>
      <textarea id="pr-assessment" style="width:100%;height:80px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;" placeholder="Write symptoms, clinical findings..."></textarea>
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:12px;font-weight:700;color:var(--navy);">Advice & Plan of Treatment (Rx):</label>
      <textarea id="pr-treatment" style="width:100%;height:120px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;" placeholder="Write medicines, dosage and advice..."></textarea>
    </div>
    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
      <button class="btn" onclick="document.getElementById('prescription-modal').style.display='none'">Close</button>
      <button class="btn primary" onclick="window.print()">🖨 Print Official Prescription</button>
    </div>
  </div>
</div>

<script>
let currentUser = null;
let activeModuleKey = 'dashboard';
let doctorsList = [];
let currentActiveBillNo = '';

const navGroups = [
  { label: "OVERVIEW", items: [["Dashboard", "dashboard", "▦"], ["Notifications", "notifications", "♧"], ["Tasks & Approvals", "approvals", "✓"]] },
  { label: "BILLING & HOSPITAL", items: [["Patient Registration & Billing", "patients", "＋"], ["Patient Search Master", "patient-search", "⌕"], ["Doctors & Departments", "doctors", "✚"], ["Hospital Billing & Edit Req", "hospital-billing", "₹"], ["Medical Records", "medical-records", "▧"]] },
  { label: "PHARMACY & INVENTORY", items: [["Pharmacy Dashboard", "pharmacy", "✚"], ["Medicine Master", "medicines", "▤"], ["Stock & Expiry", "stock-alerts", "⚠"]] },
  { label: "ADMINISTRATION & USERS", items: [["User & Role Management", "users", "♙"], ["Change Password", "password", "⚙"], ["Audit Logs", "audit-logs", "☷"]] }
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

window.togglePasswordVisibility = function() {
  const pInput = document.getElementById('login-p');
  const btn = document.getElementById('eye-toggle-btn');
  if (pInput.type === 'password') {
    pInput.type = 'text';
    btn.innerText = '🙈';
  } else {
    pInput.type = 'password';
    btn.innerText = '👁';
  }
}

window.toggleSidebarSlide = function() {
  const sb = document.getElementById('sidebar-panel');
  if (sb.style.marginLeft === '-272px') {
    sb.style.marginLeft = '0';
  } else {
    sb.style.marginLeft = '-272px';
  }
}

window.handleLogin = async function(e) {
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
    alert('Network Error: ' + err.message);
  }
}

function handleLogout() {
  localStorage.removeItem('ar_erp_active_user');
  localStorage.removeItem('ar_erp_active_page');
  location.reload();
}

function renderNav() {
  let html = '';
  navGroups.forEach(g => {
    let groupItemsHtml = '';
    g.items.forEach(i => {
      if (currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.permissions.includes('all') || currentUser.permissions.includes(i[1])) {
        groupItemsHtml += '<button class="nav-item ' + (i[1] === activeModuleKey ? 'active' : '') + '" id="nav-btn-' + i[1] + '" onclick="switchView(\'' + i[1] + '\')"><span class="nav-icon">' + i[2] + '</span><span>' + i[0] + '</span></button>';
      }
    });
    if (groupItemsHtml !== '') {
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
  const docSelect = document.getElementById('reg-doctor');
  if (docSelect) docSelect.innerHTML = opt;
}

function autoFetchDoctorFee() {
  const docName = document.getElementById('reg-doctor').value;
  const doc = doctorsList.find(d => d.name === docName);
  if (doc) {
    document.getElementById('reg-fee').value = doc.fee;
    calculateNetFee();
  }
}

function calculateNetFee() {
  const fee = Number(document.getElementById('reg-fee').value || 0);
  const disc = Number(document.getElementById('reg-discount').value || 0);
  const net = Math.max(0, fee - disc);
  document.getElementById('reg-netfee').value = net;
}

async function fetchNextUHID() {
  const res = await fetch('/api/next-uhid');
  const data = await res.json();
  const uhidInput = document.getElementById('reg-uhid');
  if (uhidInput) uhidInput.value = data.uhid;
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
    
    document.getElementById('patient-reg-panel').style.display = (targetKey === 'patients' || targetKey === 'patient-search') ? 'block' : 'none';
    document.getElementById('doctor-panel').style.display = (targetKey === 'doctors') ? 'block' : 'none';
    document.getElementById('user-mgmt-panel').style.display = (targetKey === 'users' && (currentUser.role === 'Super Admin' || currentUser.role === 'Admin')) ? 'block' : 'none';
    document.getElementById('password-panel').style.display = (targetKey === 'password') ? 'block' : 'none';

    if (targetKey === 'patients' || targetKey === 'patient-search') {
      fetchNextUHID();
    }
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
    document.getElementById('m-credit').innerText = '₹' + data.creditTotal.toFixed(2);
    document.getElementById('m-pat').innerText = data.registeredPatients;
  }

  const pRes = await fetch('/api/module/patients');
  const pData = await pRes.json();
  let html = '';
  (pData.data || []).forEach(p => {
    html += '<tr>' +
      '<td><b>' + p.uhid + '</b></td>' +
      '<td>' + p.title + ' ' + p.name + '</td>' +
      '<td>' + p.contact + '</td>' +
      '<td>' + p.doctor + '</td>' +
      '<td style="font-weight:700;">₹' + p.netFee + ' (' + p.payType + ')</td>' +
      '<td><span style="background:#eef6ff;color:var(--blue);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">' + (p.workflowStatus || 'Active') + '</span></td>' +
      '<td>' +
        '<button class="btn btn-sm primary" onclick="openPrescriptionSheet(\'' + p.uhid + '\')">📝 Prescription</button> ' +
        '<button class="btn btn-sm success" onclick="openBillingModalByUHID(\'' + p.uhid + '\')">🖨 Bill</button>' +
      '</td>' +
    '</tr>';
  });
  document.getElementById('dash-patients').innerHTML = html;
}

async function handleDashQuickFind(val) {
  const box = document.getElementById('dash-quick-suggestions');
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
  let html = '';
  data.forEach(p => {
    html += '<div class="suggestion-item" onclick="openPrescriptionSheet(\'' + p.uhid + '\')">' +
      '<strong>' + p.title + ' ' + p.name + '</strong> (UHID: ' + p.uhid + ') | Mob: ' + p.contact + ' | Dr: ' + p.doctor +
    '</div>';
  });
  box.innerHTML = html;
  box.style.display = 'block';
}

async function loadUniqueModuleData(key) {
  const heading = document.getElementById('module-title-heading');
  if (heading) heading.innerText = key.toUpperCase().replace('-', ' ') + ' MASTER RECORDS';

  const res = await fetch('/api/module/' + key);
  const json = await res.json();
  const list = json.data || [];

  if (list.length === 0) {
    document.getElementById('module-thead').innerHTML = '<tr><th>Status</th></tr>';
    document.getElementById('module-tbody').innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--muted);">No records available.</td></tr>';
    return;
  }

  const columns = Object.keys(list[0]);
  document.getElementById('module-thead').innerHTML = '<tr>' + columns.map(c => '<th>' + c.toUpperCase() + '</th>').join('') + (key === 'users' ? '<th>ACTION</th>' : '') + '</tr>';

  let rows = '';
  list.forEach(row => {
    rows += '<tr>' + columns.map(c => '<td>' + (row[c] !== undefined ? row[c] : '—') + '</td>').join('');
    if (key === 'users') {
      let isAct = row.status === 'Active';
      rows += '<td><button class="btn btn-sm ' + (isAct ? 'danger' : 'success') + '" onclick="toggleUserStatus(\'' + row.id + '\', \'' + (isAct ? 'Deactivated' : 'Active') + '\')">' + (isAct ? 'Deactivate' : 'Activate') + '</button></td>';
    }
    rows += '</tr>';
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
  let html = '';
  data.forEach(p => {
    html += '<div class="suggestion-item" onclick="autoFillPatient(\'' + p.uhid + '\')">' +
      '<strong>' + p.title + ' ' + p.name + '</strong> (' + p.uhid + ') - Mob: ' + p.contact +
    '</div>';
  });
  box.innerHTML = html;
  box.style.display = 'block';
}

async function autoFillPatient(uhid) {
  const res = await fetch('/api/patients/search?q=' + uhid);
  const data = await res.json();
  if (data.length > 0) {
    const p = data[0];
    document.getElementById('reg-uhid').value = p.uhid;
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
    existingUhid: document.getElementById('reg-uhid').value,
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
    discount: document.getElementById('reg-discount').value,
    netFee: document.getElementById('reg-netfee').value,
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
    currentActiveBillNo = data.bill.billNo;
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
    document.getElementById('pb-gross').innerText = '₹' + Number(data.bill.totalFee).toFixed(2);
    document.getElementById('pb-disc').innerText = '₹' + Number(data.bill.discount).toFixed(2);
    document.getElementById('pb-amount').innerText = '₹' + Number(data.bill.netFee).toFixed(2);

    document.getElementById('print-modal').style.display = 'flex';
    fetchNextUHID();
  } else {
    alert(data.message);
  }
}

async function openBillingModalByUHID(uhid) {
  const res = await fetch('/api/module/bills');
  const json = await res.json();
  const bill = (json.data || []).find(b => b.uhid === uhid);
  if (bill) {
    currentActiveBillNo = bill.billNo;
    document.getElementById('pb-billno').innerText = bill.billNo;
    document.getElementById('pb-datetime').innerText = bill.dateTime;
    document.getElementById('pb-uhid').innerText = bill.uhid;
    document.getElementById('pb-user').innerText = bill.createdBy;
    document.getElementById('pb-name').innerText = bill.patientName;
    document.getElementById('pb-agegender').innerText = '—';
    document.getElementById('pb-contact').innerText = '—';
    document.getElementById('pb-adhaar').innerText = '—';
    document.getElementById('pb-doctor').innerText = bill.doctor;
    document.getElementById('pb-paymode').innerText = bill.payType;
    document.getElementById('pb-gross').innerText = '₹' + Number(bill.totalFee).toFixed(2);
    document.getElementById('pb-disc').innerText = '₹' + Number(bill.discount).toFixed(2);
    document.getElementById('pb-amount').innerText = '₹' + Number(bill.netFee).toFixed(2);
    document.getElementById('print-modal').style.display = 'flex';
  } else {
    alert('Bill not found for this UHID.');
  }
}

async function openPrescriptionSheet(uhid) {
  const res = await fetch('/api/patients/search?q=' + uhid);
  const data = await res.json();
  if (data.length > 0) {
    const p = data[0];
    document.getElementById('pr-uhid').innerText = p.uhid;
    document.getElementById('pr-date').innerText = p.date;
    document.getElementById('pr-name').innerText = p.title + ' ' + p.name;
    document.getElementById('pr-age').innerText = p.age + ' Yrs / ' + p.gender;
    document.getElementById('pr-guardian').innerText = (p.relation || '') + ' ' + (p.guardian || '');
    document.getElementById('pr-contact').innerText = p.contact;
    document.getElementById('pr-doctor').innerText = p.doctor;
    document.getElementById('pr-address').innerText = p.address || 'Mathura, UP';
    document.getElementById('prescription-modal').style.display = 'flex';
  }
}

async function requestBillEdit() {
  const reason = prompt("Enter reason for bill edit request (submitted to Admin):");
  if (!reason) return;
  const res = await fetch('/api/bills/edit-request', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ billNo: currentActiveBillNo, requestedBy: currentUser.name, reason })
  });
  const data = await res.json();
  alert(data.message);
}

async function handleAddNewDoctor(e) {
  e.preventDefault();
  const name = document.getElementById('doc-name').value;
  const fee = document.getElementById('doc-fee').value;
  const department = document.getElementById('doc-dept').value;
  const res = await fetch('/api/doctors/add', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, fee, department })
  });
  const data = await res.json();
  if (data.success) {
    alert('New Doctor added successfully!');
    loadDoctors();
    document.getElementById('doc-name').value = '';
    document.getElementById('doc-fee').value = '';
    document.getElementById('doc-dept').value = '';
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('new-u-name').value,
    username: document.getElementById('new-u-username').value,
    password: document.getElementById('new-u-password').value,
    role: document.getElementById('new-u-role').value,
    permissions: document.getElementById('new-u-perms').value.split(',').map(s => s.trim())
  };
  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.success) {
    alert('User created successfully!');
    loadUniqueModuleData('users');
  } else {
    alert(data.message);
  }
}

async function toggleUserStatus(userId, status) {
  const res = await fetch('/api/users/status', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ userId, status })
  });
  const data = await res.json();
  if (data.success) loadUniqueModuleData('users');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('pass-old').value;
  const newPassword = document.getElementById('pass-new').value;
  const res = await fetch('/api/users/change-password', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: currentUser.username, oldPassword, newPassword })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) {
    document.getElementById('pass-old').value = '';
    document.getElementById('pass-new').value = '';
  }
}

function toggleAiBox() {
  const box = document.getElementById('ar-ai-box');
  box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

async function sendAiQuery() {
  const input = document.getElementById('ai-input');
  const txt = input.value.trim();
  if (!txt) return;
  const body = document.getElementById('ai-chat-body');
  body.innerHTML += '<div style="text-align:right;margin-bottom:6px;"><b>Aarif:</b> ' + txt + '</div>';
  input.value = '';

  const res = await fetch('/api/ai/query', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ prompt: txt })
  });
  const data = await res.json();
  body.innerHTML += '<div style="background:#f0f6ff;padding:8px;border-radius:6px;margin-bottom:6px;"><b>' + data.reply + '</b></div>';
  body.scrollTop = body.scrollHeight;
}
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('AR ERP Server running live on port ' + PORT);
});