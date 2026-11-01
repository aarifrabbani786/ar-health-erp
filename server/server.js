require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection setup via Supabase DATABASE_URL
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

// Enterprise Store
let erpData = {
    users: [
        { username: 'Aarif', password: '7860', name: 'Aarif Rabbani', role: 'Super Admin' }
    ],
    bills: [
        { id: 1, inv_no: 'PBILL311026846', date: '2026-10-31', customer_name: 'Aarif Rabbani', mobile: '9876543210', net_total: 800.00 }
    ],
    medicines: [
        { id: 1, med_id: 'MED001', brand_name: 'Paracetamol 650mg', generic_name: 'Paracetamol', batch_no: 'B2601', available_qty: 150, sale_rate: 20.00 }
    ],
    patients: [
        { id: 1, uhid: 'UHID2026001', name: 'Aarif Rabbani', age: 27, sex: 'Male', contact: '9876543210', status: 'Active OPD' }
    ],
    opdTokens: [
        { token: 1, uhid: 'UHID2026001', patientName: 'Aarif Rabbani', doctor: 'Dr. A. Khan (General)', status: 'Waiting' }
    ],
    attendance: [
        { id: 1, empName: 'Aarif Rabbani', role: 'Super Admin', date: '2026-11-01', checkIn: '09:00 AM', status: 'Present' }
    ],
    ipdBeds: [
        { ward: 'General Ward A', bedNo: 'BED-101', patientName: 'Rahul Verma', status: 'Occupied' },
        { ward: 'General Ward A', bedNo: 'BED-102', patientName: 'Vacant', status: 'Available' }
    ]
};

// --- AUTH & REST API ENDPOINTS ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = erpData.users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, user: { name: user.name, role: user.role } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Username or Password' });
    }
});

app.get('/api/dashboard/metrics', async (req, res) => {
    try {
        let totalRevenue = 800.00;
        let billsCount = erpData.bills.length;
        let patientsCount = erpData.patients.length;

        if (pool) {
            const dbRev = await pool.query('SELECT SUM(net_total) as revenue, COUNT(*) as cnt FROM sales_invoices');
            if (dbRev.rows[0].revenue) {
                totalRevenue = Number(dbRev.rows[0].revenue);
                billsCount = Number(dbRev.rows[0].cnt);
            }
            const dbPat = await pool.query('SELECT COUNT(*) as cnt FROM patients');
            if (dbPat.rows[0].cnt) {
                patientsCount = Number(dbPat.rows[0].cnt);
            }
        }

        res.json({
            success: true,
            totalRevenue,
            registeredPatients: patientsCount,
            activeIpdBeds: erpData.ipdBeds.filter(b => b.status === 'Occupied').length,
            pharmacySalesCount: billsCount,
            lowStockItems: 0
        });
    } catch (err) {
        res.json({
            success: true,
            totalRevenue: 800.00,
            registeredPatients: erpData.patients.length,
            activeIpdBeds: 1,
            pharmacySalesCount: erpData.bills.length,
            lowStockItems: 0
        });
    }
});

app.get('/api/opd-tokens', (req, res) => {
    res.json(erpData.opdTokens);
});

app.post('/api/opd-tokens', (req, res) => {
    const { uhid, patientName, doctor } = req.body;
    const newToken = {
        token: erpData.opdTokens.length + 1,
        uhid: uhid || 'UHID-GEN',
        patientName: patientName || 'Walk-in Patient',
        doctor: doctor || 'Dr. A. Khan (General)',
        status: 'Waiting'
    };
    erpData.opdTokens.unshift(newToken);
    res.json({ success: true, message: 'Token Generated Successfully', token: newToken });
});

app.post('/api/opd-tokens/attend', (req, res) => {
    const { tokenNo } = req.body;
    const tokenItem = erpData.opdTokens.find(t => t.token === Number(tokenNo));
    if (tokenItem) {
        tokenItem.status = 'Completed';
        res.json({ success: true, message: `Token #${tokenNo} Consultation Completed` });
    } else {
        res.status(404).json({ success: false, message: 'Token Not Found' });
    }
});

app.get('/api/attendance', (req, res) => {
    res.json(erpData.attendance);
});

app.post('/api/attendance/checkin', (req, res) => {
    const { empName, role } = req.body;
    const newEntry = {
        id: erpData.attendance.length + 1,
        empName: empName || 'Aarif Rabbani',
        role: role || 'Super Admin',
        date: new Date().toISOString().split('T')[0],
        checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Present'
    };
    erpData.attendance.unshift(newEntry);
    res.json({ success: true, message: 'Attendance Marked Successfully', entry: newEntry });
});

app.get('/api/bills', async (req, res) => {
    try {
        if (pool) {
            const dbRes = await pool.query('SELECT * FROM sales_invoices ORDER BY id DESC');
            if (dbRes.rows.length > 0) return res.json(dbRes.rows);
        }
        res.json(erpData.bills);
    } catch (err) {
        res.json(erpData.bills);
    }
});

app.post('/api/bills', async (req, res) => {
    const b = req.body;
    const invNo = `PBILL${Date.now().toString().slice(-8)}`;
    const newBill = { id: Date.now(), inv_no: invNo, date: new Date().toISOString().split('T')[0], customer_name: b.cust || 'Walk-in', mobile: b.mob || '', net_total: Number(b.netTotal) || 0 };
    erpData.bills.unshift(newBill);

    if (pool) {
        try {
            await pool.query(
                'INSERT INTO sales_invoices (inv_no, date, customer_name, mobile, subtotal, net_total) VALUES ($1, $2, $3, $4, $5, $6)',
                [invNo, newBill.date, newBill.customer_name, newBill.mobile, newBill.net_total, newBill.net_total]
            );
        } catch (dbErr) {
            console.error('DB insert warning:', dbErr.message);
        }
    }
    res.json({ success: true, message: 'Invoice generated successfully', bill: newBill });
});

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
    const uhid = `UHID${Date.now().toString().slice(-6)}`;
    const newPatient = { id: Date.now(), uhid, name: p.name, age: p.age, sex: p.sex, contact: p.contact, status: 'Active OPD' };
    erpData.patients.unshift(newPatient);
    
    // Auto-generate OPD Token
    erpData.opdTokens.unshift({ token: erpData.opdTokens.length + 1, uhid, patientName: p.name, doctor: 'Dr. A. Khan (General)', status: 'Waiting' });

    if (pool) {
        try {
            await pool.query('INSERT INTO patients (uhid, name, age, sex, contact) VALUES ($1, $2, $3, $4, $5)', [uhid, p.name, p.age, p.sex, p.contact]);
        } catch (dbErr) {
            console.error('DB insert warning:', dbErr.message);
        }
    }
    res.json({ success: true, message: 'Patient registered & Token created', patient: newPatient });
});

app.get('/api/medicines', async (req, res) => {
    try {
        if (pool) {
            const dbRes = await pool.query('SELECT * FROM medicine_batches b JOIN medicines m ON b.medicine_id = m.id ORDER BY b.expiry_date ASC');
            if (dbRes.rows.length > 0) return res.json(dbRes.rows);
        }
        res.json(erpData.medicines);
    } catch (err) {
        res.json(erpData.medicines);
    }
});

// --- SINGLE-FILE FULL APPLICATION UI ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>A R Healthcare ERP | Complete System</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: #0f172a; color: #f8fafc; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        
        /* NEON LOGIN STYLING */
        #login-screen { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; background: radial-gradient(circle, #1e293b 0%, #090d16 100%); position: absolute; z-index: 1000; }
        .login-card { background: rgba(15, 23, 42, 0.85); padding: 45px 40px; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 0 25px rgba(56, 189, 248, 0.25); width: 380px; text-align: center; backdrop-filter: blur(10px); }
        .login-card h2 { color: #38bdf8; font-size: 24px; margin-bottom: 25px; text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
        .login-input { width: 100%; padding: 12px 16px; margin-bottom: 18px; border: 1px solid #334155; border-radius: 8px; background: #1e293b; color: #fff; font-size: 14px; outline: none; transition: all 0.3s; }
        .login-input:focus { border-color: #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }
        .login-btn { width: 100%; padding: 12px; border: none; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #38bdf8); color: white; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); transition: all 0.3s; }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 0 22px rgba(56, 189, 248, 0.7); }

        /* ENTERPRISE DASHBOARD STYLING */
        #app-container { display: none; height: 100vh; width: 100vw; flex-direction: row; background: #f1f5f9; color: #0f172a; }
        
        .sidebar { width: 280px; background: #0f172a; color: white; display: flex; flex-direction: column; box-shadow: 4px 0 10px rgba(0,0,0,0.1); }
        .sidebar-brand { padding: 22px; font-size: 16px; font-weight: 700; background: #090d16; border-bottom: 1px solid #1e293b; color: #38bdf8; }
        .sidebar-section-title { font-size: 10px; font-weight: 800; color: #64748b; padding: 14px 24px 6px; text-transform: uppercase; letter-spacing: 1px; }
        .sidebar-menu { list-style: none; padding-bottom: 15px; overflow-y: auto; flex: 1; }
        .sidebar-menu li { padding: 11px 24px; font-size: 13px; cursor: pointer; transition: all 0.2s; color: #94a3b8; border-left: 4px solid transparent; }
        .sidebar-menu li:hover, .sidebar-menu li.active { background: #1e293b; color: white; font-weight: 600; border-left-color: #38bdf8; }

        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { height: 65px; background: white; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .dashboard-body { padding: 25px; overflow-y: auto; flex: 1; background: #f8fafc; }
        
        .view-section { display: none; }
        .view-section.active { display: block; animation: fadeIn 0.2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 20px; margin-bottom: 25px; }
        .metric-card { background: white; padding: 22px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); border-top: 4px solid #0284c7; }
        .metric-card.success { border-top-color: #10b981; }
        .metric-card.warning { border-top-color: #f59e0b; }
        .metric-card.danger { border-top-color: #ef4444; }
        .metric-title { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; }
        .metric-value { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 8px; }

        .card-box { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); margin-bottom: 25px; border: 1px solid #e2e8f0; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card-title { font-size: 16px; font-weight: 700; color: #1e293b; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; background: white; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        th { background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 11px; }
        tr:hover { background: #f8fafc; }

        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        input, select { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: #fff; color: #0f172a; }
        
        .btn { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
        .btn:hover { background: #0369a1; }
        .btn-success { background: #10b981; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
        
        .pos-container { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .bill-summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        .summary-row.total { font-size: 18px; font-weight: 800; color: #0284c7; border-top: 2px solid #cbd5e1; padding-top: 12px; }
    </style>
</head>
<body>

    <!-- 1. NEON LAMP LOGIN SCREEN -->
    <div id="login-screen">
        <div class="login-card">
            <h2>🏥 AR ENTERPRISE ERP</h2>
            <form onsubmit="handleLogin(event)">
                <input type="text" id="login-user" class="login-input" placeholder="Username (Aarif)" required value="Aarif">
                <input type="password" id="login-pass" class="login-input" placeholder="Password (7860)" required value="7860">
                <button type="submit" class="login-btn">Secure Login ➔</button>
            </form>
        </div>
    </div>

    <!-- 2. MAIN APPLICATION INTERFACE -->
    <div id="app-container">
        <div class="sidebar">
            <div class="sidebar-brand">🏥 A R HEALTHCARE ERP</div>
            <ul class="sidebar-menu" id="nav-list">
                <div class="sidebar-section-title">Overview</div>
                <li class="active" data-target="view-dashboard">📊 Dashboard</li>
                
                <div class="sidebar-section-title">Hospital Management</div>
                <li data-target="view-patients">👤 Patient Registration (UHID)</li>
                <li data-target="view-opd">🩺 OPD Token & Queue</li>
                <li data-target="view-ipd">🛏️ IPD Wards & Beds</li>
                <li data-target="view-pharmacy">💊 Pharmacy Inventory & Batches</li>
                <li data-target="view-billing">🧾 POS Billing & Invoicing</li>
                <li data-target="view-assets">⚙️ Biomedical Assets</li>

                <div class="sidebar-section-title">Finance & HRMS</div>
                <li data-target="view-attendance">⏱️ Attendance & Shifts</li>
                <li data-target="view-reports">📈 Financial & Sales Reports</li>
                <li data-target="view-admin">🔒 Admin Security & Logs</li>
            </ul>
        </div>
        
        <div class="main-content">
            <div class="topbar">
                <h3 id="topbar-title" style="font-size: 18px; font-weight: 700; color: #1e293b;">Executive Dashboard</h3>
                <div>
                    <span id="user-display" style="font-size: 13px; font-weight: 600; color: #475569; margin-right: 15px;">👤 Aarif Rabbani (Super Admin)</span>
                    <button class="btn btn-sm" onclick="handleLogout()" style="background:#ef4444;">Logout</button>
                </div>
            </div>

            <div class="dashboard-body">
                
                <!-- VIEW 1: DASHBOARD -->
                <div id="view-dashboard" class="view-section active">
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-title">Total Gross Revenue</div>
                            <div class="metric-value" id="m-revenue">₹0.00</div>
                        </div>
                        <div class="metric-card success">
                            <div class="metric-title">Registered Patients</div>
                            <div class="metric-value" id="m-patients">0</div>
                        </div>
                        <div class="metric-card warning">
                            <div class="metric-title">Active IPD Beds</div>
                            <div class="metric-value" id="m-ipd">1 / 20</div>
                        </div>
                        <div class="metric-card danger">
                            <div class="metric-title">Low Stock Alerts</div>
                            <div class="metric-value">0</div>
                        </div>
                    </div>
                    
                    <div class="card-box">
                        <div class="card-header">
                            <div class="card-title">Recent Sales Invoices & Transactions</div>
                            <button class="btn" onclick="switchView('view-billing')">+ New POS Bill</button>
                        </div>
                        <table>
                            <thead><tr><th>Invoice No</th><th>Date</th><th>Customer Name</th><th>Mobile</th><th>Net Total (₹)</th></tr></thead>
                            <tbody id="dash-bills-tbody">
                                <tr><td colspan="5" style="text-align:center; color:#64748b;">Loading live transactions...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 2: PATIENT REGISTRATION -->
                <div id="view-patients" class="view-section">
                    <div class="card-box">
                        <div class="card-title" style="margin-bottom: 20px;">Patient UHID Master Registration Form</div>
                        <form id="patient-reg-form" onsubmit="handlePatientSubmit(event)">
                            <div class="form-grid">
                                <div class="form-group"><label>Patient Full Name</label><input type="text" id="p-name" required></div>
                                <div class="form-group"><label>Age (Years)</label><input type="number" id="p-age" required></div>
                                <div class="form-group"><label>Gender</label><select id="p-sex"><option>Male</option><option>Female</option></select></div>
                                <div class="form-group"><label>Mobile Number</label><input type="text" id="p-mob" required></div>
                            </div>
                            <button type="submit" class="btn btn-success" style="margin-top: 10px;">💾 Register & Create Token</button>
                        </form>
                    </div>
                    <div class="card-box">
                        <div class="card-title">Registered Patients Database</div>
                        <table>
                            <thead><tr><th>UHID</th><th>Patient Name</th><th>Age/Sex</th><th>Contact</th><th>Status</th></tr></thead>
                            <tbody id="patients-table-body">
                                <tr><td colspan="5" style="text-align:center; color:#64748b;">Loading patients...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 3: OPD TOKEN & QUEUE -->
                <div id="view-opd" class="view-section">
                    <div class="card-box">
                        <div class="card-title" style="margin-bottom: 15px;">Create OPD Consultation Token</div>
                        <form onsubmit="handleCreateToken(event)">
                            <div class="form-grid">
                                <div class="form-group"><label>Patient UHID</label><input type="text" id="token-uhid" placeholder="e.g. UHID2026001" required></div>
                                <div class="form-group"><label>Patient Name</label><input type="text" id="token-pname" placeholder="Patient Full Name" required></div>
                                <div class="form-group"><label>Assigned Doctor</label><select id="token-doc"><option>Dr. A. Khan (General Physician)</option><option>Dr. S. Sharma (Orthopedic)</option><option>Dr. R. Verma (Cardiologist)</option></select></div>
                            </div>
                            <button type="submit" class="btn btn-success">+ Issue Token</button>
                        </form>
                    </div>

                    <div class="card-box">
                        <div class="card-title">OPD Doctor Consultation & Token Queue</div>
                        <table>
                            <thead><tr><th>Token No</th><th>UHID</th><th>Patient Name</th><th>Assigned Doctor</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody id="opd-table-body">
                                <tr><td colspan="6" style="text-align:center; color:#64748b;">Loading OPD queue...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 4: ATTENDANCE & SHIFTS -->
                <div id="view-attendance" class="view-section">
                    <div class="card-box">
                        <div class="card-header">
                            <div class="card-title">Employee Attendance & Shift Clock-In</div>
                            <button class="btn btn-success" onclick="handleCheckIn()">⏱️ Mark My Check-In</button>
                        </div>
                        <table>
                            <thead><tr><th>Employee Name</th><th>Role</th><th>Date</th><th>Check-In Time</th><th>Status</th></tr></thead>
                            <tbody id="attendance-tbody">
                                <tr><td colspan="5" style="text-align:center; color:#64748b;">Loading attendance records...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 5: IPD WARDS & BEDS -->
                <div id="view-ipd" class="view-section">
                    <div class="card-box">
                        <div class="card-title">IPD Ward Management & Bed Occupancy</div>
                        <table>
                            <thead><tr><th>Ward Name</th><th>Bed No</th><th>Patient Name</th><th>Status</th></tr></thead>
                            <tbody id="ipd-table-body">
                                <tr><td colspan="4" style="text-align:center; color:#64748b;">Loading beds...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 6: PHARMACY ERP -->
                <div id="view-pharmacy" class="view-section">
                    <div class="card-box">
                        <div class="card-title">Pharmacy Inventory & Batch Control Master (FEFO)</div>
                        <table>
                            <thead><tr><th>Medicine ID</th><th>Brand Name</th><th>Generic</th><th>Batch No</th><th>Stock</th><th>MRP (₹)</th></tr></thead>
                            <tbody id="medicine-inventory-tbody">
                                <tr><td colspan="6" style="text-align:center; color:#64748b;">Loading inventory...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 7: BILLING POS -->
                <div id="view-billing" class="view-section">
                    <div class="pos-container">
                        <div class="card-box" style="margin-bottom:0;">
                            <div class="card-title" style="margin-bottom:15px;">POS Point of Sale & Invoice Generator</div>
                            <div class="form-grid">
                                <div class="form-group"><label>Customer Name</label><input type="text" id="pos-cust" value="Aarif Rabbani"></div>
                                <div class="form-group"><label>Mobile</label><input type="text" id="pos-mob" value="9876543210"></div>
                            </div>
                            <div class="form-grid" style="margin-top: 15px;">
                                <div class="form-group"><label>Unit Price (₹)</label><input type="number" id="pos-price" value="20.00" oninput="calculatePosTotal()"></div>
                                <div class="form-group"><label>Quantity</label><input type="number" id="pos-qty" value="40" oninput="calculatePosTotal()"></div>
                            </div>
                            <button class="btn btn-success" style="margin-top: 15px;" onclick="commitPosBill()">💾 Generate & Save Invoice</button>
                        </div>
                        <div class="bill-summary-box">
                            <div class="card-title" style="margin-bottom: 20px;">Live Bill Calculation</div>
                            <div class="summary-row"><span>Subtotal:</span> <span id="sum-sub">₹800.00</span></div>
                            <div class="summary-row total"><span>Net Total:</span> <span id="sum-net">₹800.00</span></div>
                        </div>
                    </div>
                </div>

                <!-- VIEW 8: BIOMEDICAL ASSETS -->
                <div id="view-assets" class="view-section">
                    <div class="card-box"><div class="card-title">Biomedical Engineering Assets & PMS Schedule</div></div>
                </div>

                <!-- VIEW 9: REPORTS -->
                <div id="view-reports" class="view-section">
                    <div class="card-box"><div class="card-title">Financial & Pharmacy Turnover Reports</div></div>
                </div>

                <!-- VIEW 10: ADMIN -->
                <div id="view-admin" class="view-section">
                    <div class="card-box"><div class="card-title">System Administration & RBAC Security</div></div>
                </div>

            </div>
        </div>
    </div>

    <script>
        let currentUser = null;

        async function handleLogin(e) {
            e.preventDefault();
            const u = document.getElementById('login-user').value;
            const p = document.getElementById('login-pass').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                if (data.success) {
                    currentUser = data.user;
                    document.getElementById('user-display').innerText = \`👤 \${data.user.name} (\${data.user.role})\`;
                    document.getElementById('login-screen').style.display = 'none';
                    document.getElementById('app-container').style.display = 'flex';
                    loadEnterpriseData();
                } else {
                    alert(data.message || 'Login Failed');
                }
            } catch (err) {
                alert('Network error during login');
            }
        }

        function handleLogout() {
            currentUser = null;
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex';
        }

        const navItems = document.querySelectorAll('#nav-list li');
        const viewSections = document.querySelectorAll('.view-section');
        const topbarTitle = document.getElementById('topbar-title');

        function switchView(targetId) {
            navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-target') === targetId));
            viewSections.forEach(v => v.classList.toggle('active', v.id === targetId));
            const activeLi = document.querySelector(\`#nav-list li[data-target="\${targetId}"]\`);
            if(activeLi) topbarTitle.innerText = activeLi.innerText.replace(/[^a-zA-Z &]/g, '').trim();
        }

        navItems.forEach(item => item.addEventListener('click', () => switchView(item.getAttribute('data-target'))));

        function calculatePosTotal() {
            const price = Number(document.getElementById('pos-price').value) || 0;
            const qty = Number(document.getElementById('pos-qty').value) || 0;
            const total = price * qty;
            document.getElementById('sum-sub').innerText = '₹' + total.toFixed(2);
            document.getElementById('sum-net').innerText = '₹' + total.toFixed(2);
        }

        async function loadEnterpriseData() {
            try {
                // Fetch metrics
                const mRes = await fetch('/api/dashboard/metrics');
                const mData = await mRes.json();
                if(mData.success) {
                    document.getElementById('m-revenue').innerText = '₹' + Number(mData.totalRevenue).toFixed(2);
                    document.getElementById('m-patients').innerText = mData.registeredPatients;
                    document.getElementById('m-ipd').innerText = mData.activeIpdBeds + ' / 20';
                }

                // Fetch Bills
                const bRes = await fetch('/api/bills');
                const bills = await bRes.json();
                let bHtml = '';
                bills.forEach(b => {
                    bHtml += \`<tr><td>\${b.inv_no}</td><td>\${b.date ? b.date.split('T')[0] : '2026-11-01'}</td><td>\${b.customer_name || 'Walk-in'}</td><td>\${b.mobile || '-'}</td><td>₹\${Number(b.net_total).toFixed(2)}</td></tr>\`;
                });
                document.getElementById('dash-bills-tbody').innerHTML = bHtml;

                // Fetch Patients
                const pRes = await fetch('/api/patients');
                const patients = await pRes.json();
                let pHtml = '';
                patients.forEach(p => {
                    pHtml += \`<tr><td>\${p.uhid}</td><td>\${p.name}</td><td>\${p.age} / \${p.sex}</td><td>\${p.contact}</td><td><span style="color: #10b981; font-weight:700;">\${p.status || 'Active OPD'}</span></td></tr>\`;
                });
                document.getElementById('patients-table-body').innerHTML = pHtml;

                // Fetch OPD Tokens
                const opdRes = await fetch('/api/opd-tokens');
                const opdList = await opdRes.json();
                let opdHtml = '';
                opdList.forEach(o => {
                    const actionBtn = o.status === 'Waiting' 
                        ? \`<button class="btn btn-sm btn-success" onclick="attendToken(\${o.token})">Attend Patient</button>\` 
                        : \`<span style="color: #10b981; font-weight:700;">✓ Done</span>\`;
                    opdHtml += \`<tr><td>#\${o.token}</td><td>\${o.uhid}</td><td>\${o.patientName}</td><td>\${o.doctor}</td><td><span style="color: #0284c7; font-weight:700;">\${o.status}</span></td><td>\${actionBtn}</td></tr>\`;
                });
                document.getElementById('opd-table-body').innerHTML = opdHtml;

                // Fetch Attendance
                const attRes = await fetch('/api/attendance');
                const attList = await attRes.json();
                let attHtml = '';
                attList.forEach(a => {
                    attHtml += \`<tr><td>\${a.empName}</td><td>\${a.role}</td><td>\${a.date}</td><td>\${a.checkIn}</td><td><span style="color: #10b981; font-weight:700;">\${a.status}</span></td></tr>\`;
                });
                document.getElementById('attendance-tbody').innerHTML = attHtml;

                // Fetch Medicines
                const medRes = await fetch('/api/medicines');
                const meds = await medRes.json();
                let mHtml = '';
                meds.forEach(m => {
                    mHtml += \`<tr><td>\${m.med_id || 'MED'}</td><td>\${m.brand_name || m.brand}</td><td>\${m.generic_name || m.generic}</td><td>\${m.batch_no || 'B2601'}</td><td>\${m.available_qty !== undefined ? m.available_qty : m.stock}</td><td>₹\${Number(m.sale_rate || m.price).toFixed(2)}</td></tr>\`;
                });
                document.getElementById('medicine-inventory-tbody').innerHTML = mHtml;

            } catch (err) {
                console.error('Error loading enterprise data:', err);
            }
        }

        async function handleCreateToken(e) {
            e.preventDefault();
            const uhid = document.getElementById('token-uhid').value;
            const patientName = document.getElementById('token-pname').value;
            const doctor = document.getElementById('token-doc').value;

            try {
                const res = await fetch('/api/opd-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uhid, patientName, doctor })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Token #${data.token.token} Issued Successfully!`);
                    document.getElementById('token-uhid').value = '';
                    document.getElementById('token-pname').value = '';
                    loadEnterpriseData();
                }
            } catch (err) {
                alert('Error issuing token');
            }
        }

        async function attendToken(tokenNo) {
            try {
                const res = await fetch('/api/opd-tokens/attend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tokenNo })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    loadEnterpriseData();
                }
            } catch (err) {
                alert('Error updating token');
            }
        }

        async function handleCheckIn() {
            try {
                const res = await fetch('/api/attendance/checkin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empName: currentUser ? currentUser.name : 'Aarif Rabbani', role: currentUser ? currentUser.role : 'Super Admin' })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Attendance Check-In marked successfully!');
                    loadEnterpriseData();
                }
            } catch (err) {
                alert('Error marking attendance');
            }
        }

        async function commitPosBill() {
            const cust = document.getElementById('pos-cust').value;
            const mob = document.getElementById('pos-mob').value;
            const netTotal = Number(document.getElementById('pos-price').value) * Number(document.getElementById('pos-qty').value);

            try {
                const res = await fetch('/api/bills', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cust, mob, netTotal })
                });
                const data = await res.json();
                if(data.success) {
                    alert('Invoice generated and saved successfully! Invoice No: ' + data.bill.inv_no);
                    loadEnterpriseData();
                    switchView('view-dashboard');
                }
            } catch (err) {
                alert('Network error while saving bill');
            }
        }

        async function handlePatientSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('p-name').value;
            const age = document.getElementById('p-age').value;
            const sex = document.getElementById('p-sex').value;
            const contact = document.getElementById('p-mob').value;

            try {
                const res = await fetch('/api/patients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, age, sex, contact })
                });
                const data = await res.json();
                if(data.success) {
                    alert('Patient registered and token generated! UHID: ' + data.patient.uhid);
                    document.getElementById('patient-reg-form').reset();
                    loadEnterpriseData();
                    switchView('view-opd');
                }
            } catch (err) {
                alert('Network error during patient registration');
            }
        }

        calculatePosTotal();
    </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live on port ${PORT}`);
});