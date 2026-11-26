require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || 'https://arhealthcare.onrender.com';

app.use(express.json({ limit: '15mb' }));
app.use(cors());

const connectionString = process.env.DATABASE_URL || '';
let pool = null;

if (connectionString) {
    try {
        pool = new Pool({
            connectionString,
            ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
                ? false
                : { rejectUnauthorized: false }
        });
        pool.connect()
            .then(() => { console.log('Connected to PostgreSQL database successfully.'); })
            .catch((err) => { console.error('Database connection warning:', err.message); });
    } catch (e) {
        console.error('DB Init Error:', e.message);
    }
}

const DATA_FILE = path.join(__dirname, 'arhims-store.json');

function r2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function todayISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function nowIST() {
    return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
}

function nowInputDT() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());
    const get = (t) => {
        const found = parts.find((p) => p.type === t);
        return found ? found.value : '00';
    };
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

let instituteInfo = {
    name: 'AR HIMS',
    tagline: 'Hospital • IPD/OPD • Lab & Radiology • Pharmacy • BME Portable • Financials & Audit',
    address: 'Village Badahara Rani, Maharajganj, Uttar Pradesh',
    gstin: '09AABCA1234F1Z5',
    phone: '+91 9005554424',
    placeOfSupply: 'Uttar Pradesh (09)'
};

let dailySeq = { date: '', count: 1 };
function getNextUHID() {
    const d = todayISO().split('-');
    const code = `${d[2]}${d[1]}${d[0].slice(-2)}`;
    if (dailySeq.date !== code) {
        dailySeq.date = code;
        dailySeq.count = 1;
    }
    return `AR${code}-${String(dailySeq.count).padStart(2, '0')}`;
}

function incUHID() {
    getNextUHID();
    dailySeq.count += 1;
}

function recalcBill(raw) {
    const items = (Array.isArray(raw.items) ? raw.items : []).map((it) => {
        const cancelled = Boolean(it.cancelled);
        const qty = Math.max(0, Number(it.qty || 0));
        const rate = r2(it.rate || 0);
        const discPct = r2(it.discPct || 0);
        const gstPct = r2(it.gstPct || 0);
        const gross = cancelled ? 0 : r2(qty * rate);
        const discAmt = cancelled ? 0 : r2((gross * discPct) / 100);
        const taxable = cancelled ? 0 : r2(Math.max(0, gross - discAmt));
        const gstAmt = cancelled ? 0 : r2((taxable * gstPct) / 100);
        const lineTotal = cancelled ? 0 : r2(taxable + gstAmt);
        return {
            id: it.id || `ITM-${Math.random().toString(36).slice(2, 7)}`,
            module: it.module || 'HOSPITAL',
            name: String(it.name || 'Service / Test').trim(),
            qty,
            rate,
            discPct,
            discAmt,
            taxable,
            gstPct,
            gstAmt,
            lineTotal,
            cancelled
        };
    });

    const totalGross = r2(items.reduce((s, x) => s + (x.cancelled ? 0 : x.qty * x.rate), 0));
    const totalDisc = r2(items.reduce((s, x) => s + x.discAmt, 0));
    const totalTaxable = r2(items.reduce((s, x) => s + x.taxable, 0));
    const totalGst = r2(items.reduce((s, x) => s + x.gstAmt, 0));
    const adjustAmount = r2(raw.adjustAmount || 0);
    const refundAmount = r2(raw.refundAmount || 0);
    const netFee = r2(Math.max(0, totalTaxable + totalGst + adjustAmount - refundAmount));
    const paidAmount = r2(Math.max(0, Number(raw.paidAmount !== undefined ? raw.paidAmount : netFee)));
    const dueAmount = r2(Math.max(0, netFee - paidAmount));

    return {
        items,
        totalGross,
        totalDisc,
        totalTaxable,
        totalGst,
        adjustAmount,
        refundAmount,
        netFee,
        paidAmount,
        dueAmount
    };
}

const SEED_USERS = [
    { id: 'USR-1', name: 'Aarif Rabbani', username: 'Aarif', password: '786', role: 'Super Admin', permissions: ['all', 'edit'], status: 'Active' },
    { id: 'USR-2', name: 'Admin User', username: 'admin', password: '123', role: 'Admin', permissions: ['all', 'edit'], status: 'Active' },
    { id: 'USR-3', name: 'Staff User', username: 'staff', password: '123', role: 'Staff', permissions: ['dashboard', 'patients', 'ipd', 'billing', 'lab', 'radiology', 'pharmacy', 'bme', 'financials'], status: 'Active' }
];

let erpData = {
    users: SEED_USERS.slice(),
    patients: [
        {
            uhid: 'AR261126-01',
            name: 'Mr. Aarif Rabbani',
            patientType: 'Normal',
            age: 27,
            gender: 'Male',
            contact: '9876543210',
            doctor: 'Dr. A. Khan (General Physician)',
            diagnosis: 'Seasonal Fever',
            rxText: '1. Tab Paracetamol 500mg SOS\n2. Cap Pantoprazole 40mg OD x 5d',
            date: todayISO(),
            dateTime: nowIST()
        }
    ],
    ipdAdmissions: [
        {
            ipdNo: 'IPD-01',
            uhid: 'AR261126-01',
            patientName: 'Mr. Aarif Rabbani',
            patientType: 'Normal',
            ward: 'General Ward - Bed 01',
            doctor: 'Dr. A. Khan (General Physician)',
            admitDate: todayISO(),
            dischargeDate: '',
            status: 'Admitted',
            services: [
                { id: 'S-1', name: 'General Ward Bed Charge', qty: 1, rate: 500, amount: 500, addedAt: nowIST() }
            ]
        }
    ],
    wards: [
        { wardName: 'General Ward', totalBeds: 10, occupiedBeds: 1, dailyCharge: 500 },
        { wardName: 'Private Room', totalBeds: 5, occupiedBeds: 0, dailyCharge: 1500 },
        { wardName: 'ICU', totalBeds: 5, occupiedBeds: 0, dailyCharge: 3000 }
    ],
    bills: [
        {
            billNo: 'BL-261126-01',
            billType: 'Hospital',
            date: todayISO(),
            dateTime: nowIST(),
            uhid: 'AR261126-01',
            patientName: 'Mr. Aarif Rabbani',
            doctor: 'Dr. A. Khan (General Physician)',
            payType: 'Cash',
            items: [
                { id: 'I-1', module: 'HOSPITAL', name: 'OPD Consultation', qty: 1, rate: 500, discPct: 0, discAmt: 0, taxable: 500, gstPct: 0, gstAmt: 0, lineTotal: 500, cancelled: false }
            ],
            totalGross: 500,
            totalDisc: 0,
            totalTaxable: 500,
            totalGst: 0,
            adjustAmount: 0,
            refundAmount: 0,
            netFee: 500,
            paidAmount: 500,
            dueAmount: 0,
            createdBy: 'Aarif',
            editHistory: []
        }
    ],
    laboratory: [
        {
            testId: 'LAB-101',
            date: todayISO(),
            uhid: 'AR261126-01',
            patientName: 'Mr. Aarif Rabbani',
            testName: 'Complete Blood Count (CBC)',
            sampleCollectedAt: `${todayISO()}T09:00`,
            reportDoneAt: `${todayISO()}T10:30`,
            doctorName: 'Dr. R. K. Sharma (MD Pathology)',
            verifiedBy: 'Dr. R. K. Sharma (MD Pathology)',
            verified: true,
            status: 'Verified',
            parameters: [
                { name: 'Hemoglobin', value: '13.6', unit: 'g/dL', refRange: '13.0 - 17.0' },
                { name: 'Total WBC', value: '7400', unit: '/uL', refRange: '4000 - 11000' }
            ],
            remarks: 'Normal haemogram.'
        }
    ],
    radiology: [
        {
            radId: 'RAD-101',
            date: todayISO(),
            uhid: 'AR261126-01',
            patientName: 'Mr. Aarif Rabbani',
            modality: 'Digital X-Ray',
            testName: 'Chest PA View',
            sampleCollectedAt: `${todayISO()}T09:15`,
            reportDoneAt: `${todayISO()}T10:45`,
            doctorName: 'Dr. Meena Verma (MD Radiology)',
            verifiedBy: 'Dr. Meena Verma (MD Radiology)',
            verified: true,
            status: 'Verified',
            findings: 'Both lung fields clear. Cardiothoracic ratio normal.',
            impression: 'Normal Chest X-Ray.'
        }
    ],
    bmePortable: [
        {
            bmeId: 'BME-P-01',
            name: 'Portable ECG Machine (3-Channel)',
            serialNo: 'ECG-PORT-8821',
            portableMode: 'Portable / Handheld',
            location: 'Emergency & Wards',
            status: 'Operational',
            calDueDate: '2027-03-15',
            batteryOk: 'Yes',
            notes: 'Ready for bedside & ward rounds',
            updatedAt: nowIST(),
            updatedBy: 'Aarif'
        }
    ],
    financialEntries: [
        {
            finId: 'FIN-101',
            date: todayISO(),
            type: 'Income',
            category: 'OPD / IPD Collection',
            head: 'Daily Cash & UPI Settlement',
            mode: 'Cash',
            amount: 500,
            remarks: 'Opening hospital receipt',
            by: 'Aarif'
        }
    ],
    pharmacyStock: [
        { itemCode: 'MED-501', itemName: 'Paracetamol 500 mg Tab', batch: 'A1', qty: 450, mrp: 50, rate: 40, gstPct: 12 },
        { itemCode: 'MED-502', itemName: 'Cough Syrup (200ml)', batch: 'B2', qty: 180, mrp: 90, rate: 80, gstPct: 12 }
    ],
    pharmacyAudits: [
        {
            auditId: 'AUD-101',
            date: todayISO(),
            itemCode: 'MED-501',
            itemName: 'Paracetamol 500 mg Tab',
            batch: 'A1',
            systemQty: 450,
            physicalQty: 450,
            diffQty: 0,
            rate: 40,
            valueDiff: 0,
            status: 'Matched',
            notes: 'Initial audit',
            updatedBy: 'Aarif'
        }
    ],
    auditLogs: [
        { time: nowIST(), date: todayISO(), user: 'Aarif', module: 'HIMS', action: 'AR HIMS initialized' }
    ]
};

async function saveStore() {
    const snap = { instituteInfo, dailySeq, erpData };
    if (pool) {
        await pool.query(
            'INSERT INTO arhims_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = $1::jsonb, updated_at = NOW()',
            [JSON.stringify(snap)]
        );
    } else {
        fs.writeFileSync(DATA_FILE, JSON.stringify(snap, null, 2));
    }
}

async function loadStore() {
    if (pool) {
        await pool.query(
            'CREATE TABLE IF NOT EXISTS arhims_state (id INT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMP DEFAULT NOW())'
        );
        const r = await pool.query('SELECT payload FROM arhims_state WHERE id = 1');
        if (r.rows[0] && r.rows[0].payload) {
            const p = r.rows[0].payload;
            if (p.instituteInfo) instituteInfo = Object.assign(instituteInfo, p.instituteInfo);
            if (p.dailySeq) dailySeq = Object.assign(dailySeq, p.dailySeq);
            if (p.erpData) {
                erpData = Object.assign({}, erpData, p.erpData);
                if (!Array.isArray(erpData.users) || !erpData.users.length) {
                    erpData.users = SEED_USERS.slice();
                }
                if (!Array.isArray(erpData.bmePortable)) erpData.bmePortable = [];
                if (!Array.isArray(erpData.financialEntries)) erpData.financialEntries = [];
            }
        } else {
            await saveStore();
        }
    } else if (fs.existsSync(DATA_FILE)) {
        const p = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (p.instituteInfo) instituteInfo = Object.assign(instituteInfo, p.instituteInfo);
        if (p.dailySeq) dailySeq = Object.assign(dailySeq, p.dailySeq);
        if (p.erpData) erpData = Object.assign({}, erpData, p.erpData);
    } else {
        await saveStore();
    }
}

function getUser(username) {
    const u = String(username || '').trim().toLowerCase();
    return (erpData.users || []).find((x) => String(x.username || '').trim().toLowerCase() === u);
}

function canEdit(username) {
    const u = getUser(username);
    if (!u) return false;
    const role = String(u.role || '').toLowerCase();
    const perms = Array.isArray(u.permissions) ? u.permissions.map((p) => String(p).toLowerCase()) : [];
    return role === 'super admin' || role === 'admin' || perms.includes('all') || perms.includes('edit');
}

function logAction(user, moduleName, action) {
    erpData.auditLogs.unshift({
        time: nowIST(),
        date: todayISO(),
        user: user || 'System',
        module: moduleName || 'HIMS',
        action
    });
}

// ==================== API ROUTES ====================

app.get('/api/bootstrap', (req, res) => {
    const bills = erpData.bills || [];
    const totalSales = r2(bills.reduce((s, b) => s + Number(b.netFee || 0), 0));
    const totalPaid = r2(bills.reduce((s, b) => s + Number(b.paidAmount || 0), 0));
    const totalDue = r2(bills.reduce((s, b) => s + Number(b.dueAmount || 0), 0));
    const totalRefund = r2(bills.reduce((s, b) => s + Number(b.refundAmount || 0), 0));
    const admittedList = (erpData.ipdAdmissions || []).filter((a) => a.status !== 'Discharged');
    const dischargedList = (erpData.ipdAdmissions || []).filter((a) => a.status === 'Discharged');

    res.json({
        success: true,
        appName: 'AR HIMS',
        dbMode: pool ? 'PostgreSQL Connected' : 'Local File Store',
        institute: instituteInfo,
        stats: {
            totalSales,
            totalPaid,
            totalDue,
            totalRefund,
            patientsCount: (erpData.patients || []).length,
            admittedCount: admittedList.length,
            dischargedCount: dischargedList.length,
            labCount: (erpData.laboratory || []).length,
            radCount: (erpData.radiology || []).length,
            bmeCount: (erpData.bmePortable || []).length
        },
        erpData
    });
});

app.post('/api/login', async (req, res) => {
    const u = String((req.body && req.body.username) || '').trim().toLowerCase();
    const p = String((req.body && req.body.password) || '');
    const poolUsers = (Array.isArray(erpData.users) && erpData.users.length) ? erpData.users : SEED_USERS;
    const user = poolUsers.find((x) =>
        String(x.username || '').trim().toLowerCase() === u && String(x.password || '') === p
    );
    if (!user) return res.status(401).json({ success: false, message: 'Invalid User ID or Password.' });
    if (String(user.status || 'Active').toLowerCase() === 'deactivated') {
        return res.status(403).json({ success: false, message: 'Account deactivated by Admin.' });
    }
    logAction(user.username, 'Auth', 'Logged in');
    try { await saveStore(); } catch (e) { console.error('Save warning:', e.message); }
    res.json({ success: true, user });
});

app.post('/api/users/create', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Only Admin / Super Admin / Edit user can manage users.' });
    }
    const body = req.body || {};
    if (!body.name || !body.username || !body.password) {
        return res.status(400).json({ success: false, message: 'Name, username and password required.' });
    }
    const cleanUser = String(body.username).trim();
    if (erpData.users.some((x) => x.username.toLowerCase() === cleanUser.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Username already exists.' });
    }
    const newUser = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: String(body.name).trim(),
        username: cleanUser,
        password: String(body.password),
        role: body.role || 'Staff',
        permissions: Array.isArray(body.permissions) && body.permissions.length
            ? body.permissions
            : ['dashboard', 'patients', 'ipd', 'billing', 'lab', 'radiology', 'pharmacy', 'bme', 'financials'],
        status: 'Active'
    };
    erpData.users.push(newUser);
    logAction(req.body.actor, 'Users', `Created user ${newUser.username}`);
    await saveStore();
    res.json({ success: true, user: newUser });
});

app.post('/api/users/update', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    const target = (erpData.users || []).find((x) => x.id === req.body.userId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.body.name) target.name = String(req.body.name).trim();
    if (req.body.role) target.role = String(req.body.role).trim();
    if (req.body.password) target.password = String(req.body.password);
    if (req.body.status) target.status = String(req.body.status);
    if (req.body.toggleEdit) {
        const set = new Set(target.permissions || []);
        if (set.has('edit')) set.delete('edit');
        else set.add('edit');
        target.permissions = Array.from(set);
    }
    logAction(req.body.actor, 'Users', `Updated user ${target.username}`);
    await saveStore();
    res.json({ success: true, user: target });
});

app.post('/api/users/delete', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
    }
    const idx = (erpData.users || []).findIndex((x) => x.id === req.body.userId);
    if (idx < 0) return res.status(404).json({ success: false, message: 'User not found.' });
    if (String(erpData.users[idx].username).toLowerCase() === 'aarif') {
        return res.status(400).json({ success: false, message: 'Primary Super Admin cannot be deleted.' });
    }
    const removed = erpData.users.splice(idx, 1)[0];
    logAction(req.body.actor, 'Users', `Deleted user ${removed.username}`);
    await saveStore();
    res.json({ success: true, deleted: removed.username });
});

app.post('/api/bme/save', async (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ success: false, message: 'Equipment name required.' });
    const rec = {
        bmeId: b.bmeId || `BME-P-${Date.now().toString().slice(-4)}`,
        name: String(b.name).trim(),
        serialNo: String(b.serialNo || 'PORT-01').trim(),
        portableMode: b.portableMode || 'Portable / Handheld',
        location: String(b.location || 'General / Ward').trim(),
        status: b.status || 'Operational',
        calDueDate: b.calDueDate || '',
        batteryOk: b.batteryOk || 'Yes',
        notes: String(b.notes || '').trim(),
        updatedAt: nowIST(),
        updatedBy: b.actor || 'Staff'
    };
    const idx = (erpData.bmePortable || []).findIndex((x) => x.bmeId === rec.bmeId);
    if (idx >= 0) erpData.bmePortable[idx] = rec;
    else erpData.bmePortable.unshift(rec);
    logAction(b.actor, 'BME Portable', `Saved ${rec.bmeId} (${rec.name})`);
    await saveStore();
    res.json({ success: true, bme: rec });
});

app.post('/api/financials/save', async (req, res) => {
    const b = req.body || {};
    const amt = r2(b.amount || 0);
    if (!b.head || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Account head and positive amount required.' });
    }
    const entry = {
        finId: `FIN-${Date.now().toString().slice(-5)}`,
        date: b.date || todayISO(),
        type: b.type === 'Expense' ? 'Expense' : 'Income',
        category: b.category || 'General Hospital',
        head: String(b.head).trim(),
        mode: b.mode || 'Cash',
        amount: amt,
        remarks: String(b.remarks || '').trim(),
        by: b.actor || 'Staff'
    };
    erpData.financialEntries.unshift(entry);
    logAction(b.actor, 'Financials', `${entry.type} ₹${amt} - ${entry.head}`);
    await saveStore();
    res.json({ success: true, entry });
});

app.post('/api/patients/register', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !/^\d{10}$/.test(String(b.contact || '').trim())) {
        return res.status(400).json({ success: false, message: 'Name and 10-digit mobile number required.' });
    }
    const uhid = getNextUHID();
    incUHID();
    const patient = {
        uhid,
        name: String(b.name).trim(),
        patientType: b.patientType || 'Normal',
        age: Number(b.age || 0),
        gender: b.gender || 'Male',
        contact: String(b.contact).trim(),
        doctor: b.doctor || 'Dr. A. Khan (General Physician)',
        diagnosis: b.diagnosis || '',
        rxText: b.rxText || '',
        date: b.date || todayISO(),
        dateTime: nowIST()
    };
    erpData.patients.unshift(patient);
    logAction(b.actor, 'Patients', `Registered ${patient.name} (${uhid})`);
    await saveStore();
    res.json({ success: true, patient });
});

app.post('/api/ipd/admit', async (req, res) => {
    const b = req.body || {};
    if (!b.patientName || !b.ward) {
        return res.status(400).json({ success: false, message: 'Patient name and ward required.' });
    }
    const adm = {
        ipdNo: `IPD-${Date.now().toString().slice(-4)}`,
        uhid: b.uhid || getNextUHID(),
        patientName: String(b.patientName).trim(),
        patientType: b.patientType || 'Normal',
        ward: String(b.ward).trim(),
        doctor: b.doctor || 'Dr. A. Khan (General Physician)',
        admitDate: b.admitDate || todayISO(),
        dischargeDate: '',
        status: 'Admitted',
        services: Array.isArray(b.services) ? b.services : []
    };
    erpData.ipdAdmissions.unshift(adm);
    const wardBase = adm.ward.split(' - ')[0];
    const w = (erpData.wards || []).find((x) => x.wardName === wardBase);
    if (w) w.occupiedBeds = Math.min(w.totalBeds, Number(w.occupiedBeds || 0) + 1);
    logAction(b.actor, 'IPD', `Admitted ${adm.patientName} (${adm.ipdNo})`);
    await saveStore();
    res.json({ success: true, admission: adm });
});

app.post('/api/ipd/add-service', async (req, res) => {
    const adm = (erpData.ipdAdmissions || []).find((x) => x.ipdNo === req.body.ipdNo && x.status === 'Admitted');
    if (!adm) return res.status(404).json({ success: false, message: 'Admitted patient not found.' });
    const qty = Math.max(1, Number(req.body.qty || 1));
    const rate = r2(req.body.rate || 0);
    const srv = {
        id: `SRV-${Date.now().toString().slice(-5)}`,
        name: String(req.body.name || 'IPD Service').trim(),
        qty,
        rate,
        amount: r2(qty * rate),
        addedAt: nowIST()
    };
    adm.services = adm.services || [];
    adm.services.push(srv);
    logAction(req.body.actor, 'IPD', `Added service ${srv.name} to ${adm.ipdNo}`);
    await saveStore();
    res.json({ success: true, admission: adm, service: srv });
});

app.post('/api/ipd/bill-or-discharge', async (req, res) => {
    const adm = (erpData.ipdAdmissions || []).find((x) => x.ipdNo === req.body.ipdNo);
    if (!adm) return res.status(404).json({ success: false, message: 'IPD record not found.' });
    const mode = req.body.mode;
    const items = (adm.services || []).map((s) => ({
        id: s.id,
        module: 'IPD',
        name: s.name,
        qty: s.qty,
        rate: s.rate,
        discPct: 0,
        gstPct: 0,
        cancelled: false
    }));
    const calc = recalcBill({
        items,
        adjustAmount: req.body.adjustAmount || 0,
        refundAmount: req.body.refundAmount || 0,
        paidAmount: req.body.paidAmount
    });

    if (mode === 'PROVISIONAL') {
        const provBill = Object.assign({
            billNo: `PROV-${Date.now().toString().slice(-5)}`,
            billType: 'IPD Provisional',
            ipdNo: adm.ipdNo,
            date: todayISO(),
            dateTime: nowIST(),
            uhid: adm.uhid,
            patientName: adm.patientName,
            doctor: adm.doctor,
            payType: req.body.payType || 'Pending',
            createdBy: req.body.actor || 'Staff',
            editHistory: []
        }, calc);
        logAction(req.body.actor, 'IPD Provisional', `Generated provisional bill ${provBill.billNo}`);
        await saveStore();
        return res.json({ success: true, mode, bill: provBill, admission: adm });
    }

    const finalBill = Object.assign({
        billNo: `FIN-${Date.now().toString().slice(-5)}`,
        billType: 'IPD Final',
        ipdNo: adm.ipdNo,
        date: todayISO(),
        dateTime: nowIST(),
        uhid: adm.uhid,
        patientName: adm.patientName,
        doctor: adm.doctor,
        payType: req.body.payType || 'Cash',
        createdBy: req.body.actor || 'Staff',
        editHistory: []
    }, calc);
    erpData.bills.unshift(finalBill);

    if (adm.status === 'Admitted') {
        const wardBase = String(adm.ward || '').split(' - ')[0];
        const w = (erpData.wards || []).find((x) => x.wardName === wardBase);
        if (w) w.occupiedBeds = Math.max(0, Number(w.occupiedBeds || 0) - 1);
    }
    adm.status = 'Discharged';
    adm.dischargeDate = todayISO();
    adm.finalBillNo = finalBill.billNo;

    logAction(req.body.actor, 'IPD Discharge', `Discharged ${adm.patientName} (${adm.ipdNo})`);
    await saveStore();
    res.json({ success: true, mode, bill: finalBill, admission: adm });
});

app.post('/api/bills/create', async (req, res) => {
    const b = req.body || {};
    if (!b.patientName) return res.status(400).json({ success: false, message: 'Patient name required.' });
    const calc = recalcBill(b);
    const bill = Object.assign({
        billNo: `BL-${Date.now().toString().slice(-6)}`,
        billType: b.billType || 'Hospital',
        date: b.date || todayISO(),
        dateTime: nowIST(),
        uhid: b.uhid || '-',
        patientName: String(b.patientName).trim(),
        doctor: b.doctor || '',
        payType: b.payType || 'Cash',
        createdBy: b.actor || 'Staff',
        editHistory: []
    }, calc);
    erpData.bills.unshift(bill);

    (bill.items || []).forEach((it, idx) => {
        if (it.cancelled) return;
        if (it.module === 'LAB') {
            erpData.laboratory.unshift({
                testId: `LAB-${Date.now().toString().slice(-4)}-${idx}`,
                billNo: bill.billNo,
                date: bill.date,
                uhid: bill.uhid,
                patientName: bill.patientName,
                testName: it.name,
                sampleCollectedAt: nowInputDT(),
                reportDoneAt: '',
                doctorName: 'Dr. R. K. Sharma (MD Pathology)',
                verifiedBy: '',
                verified: false,
                status: 'Pending',
                parameters: [{ name: it.name, value: '', unit: '', refRange: '' }],
                remarks: ''
            });
        } else if (it.module === 'RADIOLOGY') {
            erpData.radiology.unshift({
                radId: `RAD-${Date.now().toString().slice(-4)}-${idx}`,
                billNo: bill.billNo,
                date: bill.date,
                uhid: bill.uhid,
                patientName: bill.patientName,
                modality: it.modality || 'X-Ray / USG',
                testName: it.name,
                sampleCollectedAt: nowInputDT(),
                reportDoneAt: '',
                doctorName: 'Dr. Meena Verma (MD Radiology)',
                verifiedBy: '',
                verified: false,
                status: 'Pending',
                findings: '',
                impression: ''
            });
        }
    });

    logAction(b.actor, 'Billing', `Created bill ${bill.billNo}`);
    await saveStore();
    res.json({ success: true, bill });
});

app.post('/api/bills/edit', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Edit permission required.' });
    }
    const idx = (erpData.bills || []).findIndex((x) => x.billNo === req.body.billNo);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Bill not found.' });

    const oldBill = erpData.bills[idx];
    const calc = recalcBill({
        items: req.body.items || oldBill.items,
        adjustAmount: req.body.adjustAmount !== undefined ? req.body.adjustAmount : oldBill.adjustAmount,
        refundAmount: req.body.refundAmount !== undefined ? req.body.refundAmount : oldBill.refundAmount,
        paidAmount: req.body.paidAmount !== undefined ? req.body.paidAmount : oldBill.paidAmount
    });

    const historyEntry = {
        editedAt: nowIST(),
        editedBy: req.body.actor,
        reason: req.body.reason || 'Bill updated',
        prevNetFee: oldBill.netFee,
        newNetFee: calc.netFee,
        prevPaid: oldBill.paidAmount,
        newPaid: calc.paidAmount,
        prevRefund: oldBill.refundAmount || 0,
        newRefund: calc.refundAmount
    };

    erpData.bills[idx] = Object.assign({}, oldBill, {
        payType: req.body.payType || oldBill.payType
    }, calc, {
        editHistory: [historyEntry].concat(oldBill.editHistory || [])
    });

    logAction(req.body.actor, 'Billing Edit', `Edited ${oldBill.billNo}`);
    await saveStore();
    res.json({ success: true, bill: erpData.bills[idx] });
});

app.post('/api/bills/delete', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Edit permission required.' });
    }
    const idx = (erpData.bills || []).findIndex((x) => x.billNo === req.body.billNo);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Bill not found.' });
    const removed = erpData.bills.splice(idx, 1)[0];
    logAction(req.body.actor, 'Billing Delete', `Deleted bill ${removed.billNo}`);
    await saveStore();
    res.json({ success: true, deletedBillNo: removed.billNo });
});

app.post('/api/lab/save', async (req, res) => {
    const b = req.body || {};
    const existing = (erpData.laboratory || []).find((x) => x.testId === b.testId);
    if (existing && !canEdit(b.actor)) {
        return res.status(403).json({ success: false, message: 'Edit permission required to modify Lab report.' });
    }
    const row = {
        testId: b.testId || `LAB-${Date.now().toString().slice(-4)}`,
        billNo: b.billNo || (existing ? existing.billNo : ''),
        date: b.date || (existing ? existing.date : todayISO()),
        uhid: b.uhid || (existing ? existing.uhid : '-'),
        patientName: b.patientName || (existing ? existing.patientName : '-'),
        testName: b.testName || (existing ? existing.testName : 'Lab Test'),
        sampleCollectedAt: b.sampleCollectedAt || (existing ? existing.sampleCollectedAt : nowInputDT()),
        reportDoneAt: b.reportDoneAt || (b.verify ? nowInputDT() : (existing ? existing.reportDoneAt : '')),
        doctorName: b.doctorName || (existing ? existing.doctorName : 'Dr. R. K. Sharma (MD Pathology)'),
        verifiedBy: b.verify ? (b.doctorName || b.actor || 'Doctor') : (existing ? existing.verifiedBy : ''),
        verified: b.verify !== undefined ? Boolean(b.verify) : Boolean(existing && existing.verified),
        status: b.verify ? 'Verified' : (b.status || 'Reported'),
        parameters: Array.isArray(b.parameters) ? b.parameters : (existing ? existing.parameters : []),
        remarks: b.remarks !== undefined ? b.remarks : (existing ? existing.remarks : '')
    };
    if (existing) Object.assign(existing, row);
    else erpData.laboratory.unshift(row);
    logAction(b.actor, 'Laboratory', `Saved Lab ${row.testId}`);
    await saveStore();
    res.json({ success: true, report: existing || row });
});

app.post('/api/radiology/save', async (req, res) => {
    const b = req.body || {};
    const existing = (erpData.radiology || []).find((x) => x.radId === b.radId);
    if (existing && !canEdit(b.actor)) {
        return res.status(403).json({ success: false, message: 'Edit permission required to modify Radiology report.' });
    }
    const row = {
        radId: b.radId || `RAD-${Date.now().toString().slice(-4)}`,
        billNo: b.billNo || (existing ? existing.billNo : ''),
        date: b.date || (existing ? existing.date : todayISO()),
        uhid: b.uhid || (existing ? existing.uhid : '-'),
        patientName: b.patientName || (existing ? existing.patientName : '-'),
        modality: b.modality || (existing ? existing.modality : 'X-Ray'),
        testName: b.testName || (existing ? existing.testName : 'Radiology Study'),
        sampleCollectedAt: b.sampleCollectedAt || (existing ? existing.sampleCollectedAt : nowInputDT()),
        reportDoneAt: b.reportDoneAt || (b.verify ? nowInputDT() : (existing ? existing.reportDoneAt : '')),
        doctorName: b.doctorName || (existing ? existing.doctorName : 'Dr. Meena Verma (MD Radiology)'),
        verifiedBy: b.verify ? (b.doctorName || b.actor || 'Doctor') : (existing ? existing.verifiedBy : ''),
        verified: b.verify !== undefined ? Boolean(b.verify) : Boolean(existing && existing.verified),
        status: b.verify ? 'Verified' : (b.status || 'Reported'),
        findings: b.findings !== undefined ? b.findings : (existing ? existing.findings : ''),
        impression: b.impression !== undefined ? b.impression : (existing ? existing.impression : '')
    };
    if (existing) Object.assign(existing, row);
    else erpData.radiology.unshift(row);
    logAction(b.actor, 'Radiology', `Saved Radiology ${row.radId}`);
    await saveStore();
    res.json({ success: true, report: existing || row });
});

app.post('/api/pharmacy/audit/save', async (req, res) => {
    if (!canEdit(req.body.actor)) {
        return res.status(403).json({ success: false, message: 'Edit permission required for Pharmacy Audit.' });
    }
    const b = req.body || {};
    const sysQty = Number(b.systemQty || 0);
    const physQty = Number(b.physicalQty || 0);
    const rate = r2(b.rate || 0);
    const diffQty = b.diffQty !== '' && b.diffQty !== undefined ? Number(b.diffQty) : (physQty - sysQty);
    const valueDiff = b.valueDiff !== '' && b.valueDiff !== undefined ? r2(b.valueDiff) : r2(diffQty * rate);

    const rec = {
        auditId: b.auditId || `AUD-${Date.now().toString().slice(-4)}`,
        date: b.date || todayISO(),
        itemCode: b.itemCode || '-',
        itemName: b.itemName || 'Medicine',
        batch: b.batch || '-',
        systemQty: sysQty,
        physicalQty: physQty,
        diffQty,
        rate,
        valueDiff,
        status: b.status || (diffQty === 0 ? 'Matched' : 'Adjusted'),
        notes: b.notes || '',
        updatedBy: req.body.actor
    };
    const idx = (erpData.pharmacyAudits || []).findIndex((x) => x.auditId === rec.auditId);
    if (idx >= 0) erpData.pharmacyAudits[idx] = rec;
    else erpData.pharmacyAudits.unshift(rec);

    if (b.syncStock) {
        const st = (erpData.pharmacyStock || []).find((s) => s.itemName === rec.itemName && s.batch === rec.batch);
        if (st) {
            st.qty = physQty;
            if (rate > 0) st.rate = rate;
        }
    }
    logAction(req.body.actor, 'Pharmacy Audit', `Saved audit ${rec.auditId}`);
    await saveStore();
    res.json({ success: true, audit: rec });
});

// ==================== FRONTEND: MONEY PLANT + UNIQUE AR HIMS LOGIN + ALL TABLES ====================

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AR HIMS — Hospital & Clinical Suite</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
    :root {
      --glass: rgba(248, 253, 250, 0.90);
      --glass-border: rgba(255, 255, 255, 0.96);
      --ink-dark: #052e16;
      --ink-body: #0f172a;
      --emerald-mid: #15803d;
    }

    .money-plant-bg {
      background-color: #061b12;
      background-image:
        radial-gradient(circle at 12% 18%, rgba(34, 197, 94, 0.34), transparent 42%),
        radial-gradient(circle at 88% 82%, rgba(16, 185, 129, 0.32), transparent 46%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='280' viewBox='0 0 280 280'%3E%3Cg fill='none' stroke='%234ade80' stroke-opacity='0.26' stroke-width='2.6'%3E%3Cpath d='M20 260 Q 90 190 140 140 T 260 20'/%3E%3Cpath d='M140 280 Q 110 180 65 90'/%3E%3C/g%3E%3Cg stroke='%2322c55e' stroke-opacity='0.32' stroke-width='1.8'%3E%3Cpath fill='%2316a34a' fill-opacity='0.28' d='M75 185 C 40 165, 35 125, 75 105 C 115 125, 110 165, 75 185 Z'/%3E%3Cpath fill='%2322c55e' fill-opacity='0.30' d='M140 140 C 105 118, 105 78, 145 62 C 182 82, 178 120, 140 140 Z'/%3E%3Cpath fill='%2315803d' fill-opacity='0.32' d='M205 85 C 175 68, 175 34, 210 20 C 242 38, 238 68, 205 85 Z'/%3E%3Cpath fill='%2322c55e' fill-opacity='0.26' d='M65 90 C 32 76, 30 42, 62 28 C 92 44, 90 74, 65 90 Z'/%3E%3Cpath fill='%2316a34a' fill-opacity='0.26' d='M185 215 C 155 198, 155 166, 188 152 C 218 168, 216 198, 185 215 Z'/%3E%3C/g%3E%3C/svg%3E");
    }

    body { color: var(--ink-body); font-size: 13px; font-weight: 500; min-height: 100vh; }

    #loginWrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .ar-login-stage {
      width: 820px; max-width: 96vw; min-height: 470px; border-radius: 34px; overflow: hidden;
      display: grid; grid-template-columns: 0.92fr 1.08fr; background: rgba(246, 252, 248, 0.94);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.58), 0 0 0 2px rgba(187, 247, 208, 0.45);
      backdrop-filter: blur(18px);
    }
    .ar-brand-panel {
      background: linear-gradient(155deg, #052e16 0%, #14532d 55%, #065f46 100%);
      color: #ffffff; padding: 38px 32px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .ar-monogram-ring {
      width: 78px; height: 78px; border-radius: 24px;
      background: linear-gradient(145deg, rgba(74, 222, 128, 0.25), rgba(22, 163, 74, 0.12));
      border: 2px solid rgba(134, 239, 172, 0.65); display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 900; letter-spacing: 1px; color: #bbf7d0;
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.35); margin-bottom: 18px;
    }
    .ar-brand-panel h1 { font-size: 36px; font-weight: 900; letter-spacing: 1.5px; line-height: 1.05; color: #ffffff; }
    .ar-brand-panel h1 span { display: block; font-size: 16px; font-weight: 800; letter-spacing: 3px; color: #86efac; margin-top: 6px; }
    .ar-brand-panel p { margin-top: 14px; font-size: 13.5px; line-height: 1.55; color: #dcfce7; font-weight: 500; }
    .ar-mod-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
    .ar-mod-pills span {
      background: rgba(255, 255, 255, 0.13); border: 1px solid rgba(187, 247, 208, 0.32);
      color: #ecfdf5; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 999px;
    }
    .ar-form-panel { padding: 40px 38px; display: flex; flex-direction: column; justify-content: center; background: #f8fcf9; }
    .ar-form-tag { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.6px; color: var(--emerald-mid); margin-bottom: 6px; }
    .ar-form-title { font-size: 28px; font-weight: 900; color: var(--ink-dark); margin-bottom: 22px; }
    .ar-input-group { margin-bottom: 16px; }
    .ar-input-group label { display: block; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #1e293b; margin-bottom: 6px; }
    .ar-input {
      width: 100%; padding: 14px 16px; border: 2px solid #cbd5e1; border-radius: 14px;
      background: #ffffff; color: var(--ink-dark); font-size: 15px; font-weight: 700; outline: none;
    }
    .ar-input:focus { border-color: var(--emerald-mid); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.18); }
    .ar-submit-btn {
      width: 100%; margin-top: 6px; padding: 15px 20px; border: none; border-radius: 14px;
      background: linear-gradient(135deg, #16a34a 0%, #065f46 100%); color: #ffffff;
      font-size: 16px; font-weight: 900; letter-spacing: 0.6px; cursor: pointer;
      box-shadow: 0 12px 24px rgba(6, 95, 70, 0.35);
    }
    .ar-err { min-height: 22px; margin-top: 10px; font-size: 13px; font-weight: 800; color: #b91c1c; }
    .ar-welcome-box { display: none; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 20px 0; }
    .ar-check {
      width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(145deg, #22c55e, #15803d);
      color: #ffffff; font-size: 32px; font-weight: 900; display: flex; align-items: center; justify-content: center;
    }
    @media (max-width: 760px) {
      .ar-login-stage { grid-template-columns: 1fr; }
      .ar-brand-panel { padding: 26px 24px; }
      .ar-form-panel { padding: 28px 24px; }
    }

    #appWrap { display: none; min-height: 100vh; }
    .sidebar {
      width: 248px; background: linear-gradient(180deg, rgba(5, 46, 22, 0.96) 0%, rgba(20, 83, 45, 0.96) 60%, rgba(6, 95, 70, 0.96) 100%);
      color: #ffffff; flex-shrink: 0; padding: 12px 10px; display: flex; flex-direction: column; gap: 4px;
      border-right: 1px solid rgba(187, 247, 208, 0.35);
    }
    .sbrand { padding: 12px 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.24); margin-bottom: 6px; }
    .sbrand h2 { font-size: 16px; font-weight: 900; color: #bbf7d0; letter-spacing: 0.6px; }
    .sbrand p { font-size: 11px; font-weight: 600; color: #dcfce7; margin-top: 3px; }
    .mbtn {
      width: 100%; background: transparent; border: none; color: #f0fdf4; text-align: left;
      padding: 9px 12px; border-radius: 12px; cursor: pointer; font-size: 12.5px; font-weight: 700;
      display: flex; justify-content: space-between; align-items: center;
    }
    .mbtn:hover { background: rgba(255, 255, 255, 0.16); }
    .mbtn.active { background: rgba(34, 197, 94, 0.36); color: #ffffff; font-weight: 800; border: 1px solid rgba(187, 247, 208, 0.45); }
    .pill { background: #ef4444; color: #ffffff; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; font-weight: 800; }

    .content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      background: var(--glass); backdrop-filter: blur(14px); border-bottom: 1px solid var(--glass-border);
      padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 700;
    }
    .work { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
    .cards4 { display: grid; grid-template-columns: repeat(4, minmax(145px, 1fr)); gap: 12px; }
    .kcard {
      background: var(--glass); backdrop-filter: blur(14px); border: 1px solid var(--glass-border);
      border-radius: 18px; padding: 14px; box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
    }
    .kcard.g { background: linear-gradient(135deg, rgba(220, 252, 231, 0.95), rgba(255, 255, 255, 0.88)); }
    .kcard.a { background: linear-gradient(135deg, rgba(254, 243, 199, 0.95), rgba(255, 255, 255, 0.88)); }
    .kcard.r { background: linear-gradient(135deg, rgba(255, 228, 230, 0.95), rgba(255, 255, 255, 0.88)); }
    .kcard.b { background: linear-gradient(135deg, rgba(209, 250, 229, 0.96), rgba(255, 255, 255, 0.88)); }
    .kcard small { font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
    .kcard strong { display: block; font-size: 20px; font-weight: 900; color: var(--ink-dark); margin-top: 4px; }

    .box {
      background: var(--glass); backdrop-filter: blur(14px); border: 1px solid var(--glass-border);
      border-radius: 18px; padding: 14px; box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
    }
    .box-hd {
      display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;
      padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid rgba(15, 23, 42, 0.15);
    }
    .box-hd h3 { font-size: 14px; font-weight: 800; color: var(--ink-dark); }

    .g4 { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 9px; }
    .g3 { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)); gap: 9px; }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 9px; }
    @media (max-width: 900px) { .cards4, .g4, .g3 { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) {
      #appWrap { flex-direction: column; }
      .sidebar { width: 100%; }
      .cards4, .g4, .g3, .g2 { grid-template-columns: 1fr; }
    }

    .fld { display: flex; flex-direction: column; gap: 3px; }
    .fld label { font-size: 11px; font-weight: 800; color: var(--ink-body); }
    .fld input, .fld select, .fld textarea {
      width: 100%; padding: 7px 9px; border: 1px solid #94a3b8; border-radius: 10px;
      font-size: 12.5px; font-weight: 600; color: var(--ink-body); background: #ffffff; outline: none;
    }
    .fld textarea { min-height: 66px; }

    .btn { padding: 7px 12px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; font-size: 12px; font-weight: 800; }
    .bp { background: linear-gradient(135deg, #059669, #047857); color: #ffffff; }
    .bs { background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff; }
    .bw { background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; }
    .bd { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; }
    .bo { background: #ffffff; color: var(--ink-body); border-color: #94a3b8; }
    .bsm { padding: 5px 9px; font-size: 11.5px; }

    .tbl-wrap { overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; font-weight: 600; color: var(--ink-body); }
    th { background: #dcfce7; color: var(--ink-dark); font-weight: 800; padding: 7px 8px; text-align: left; border-bottom: 1px solid #86efac; white-space: nowrap; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    td input { width: 100%; padding: 4px 6px; border: 1px solid #94a3b8; border-radius: 6px; font-size: 12px; font-weight: 600; background: #ffffff; }

    .toast { position: fixed; right: 16px; bottom: 16px; background: var(--ink-dark); color: #ffffff; font-weight: 700; padding: 10px 16px; border-radius: 12px; font-size: 12.5px; display: none; z-index: 9999; }
    .print-bg { display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.82); z-index: 5000; overflow-y: auto; padding: 16px; }
    .print-bar { max-width: 210mm; margin: 0 auto 8px; display: flex; justify-content: flex-end; gap: 8px; }
    .a4 { width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; color: #000000; padding: 12mm 14mm; display: flex; flex-direction: column; justify-content: space-between; }

    @media print {
      body * { visibility: hidden; }
      .print-bg, .print-bg * { visibility: visible; }
      .print-bg { position: static; background: none; padding: 0; }
      .print-bar { display: none !important; }
      .a4 { width: 100%; min-height: auto; padding: 0; }
    }
  </style>
</head>
<body class="money-plant-bg">

  <div id="loginWrap">
    <div class="ar-login-stage">
      <div class="ar-brand-panel">
        <div>
          <div class="ar-monogram-ring">AR</div>
          <h1>AR HIMS<span>HOSPITAL & CLINICAL SUITE</span></h1>
          <p>Unified hospital operations, IPD/OPD workflows, diagnostics, portable biomedical tracking, financials, and role-based user access.</p>
          <div class="ar-mod-pills">
            <span>OPD & Rx</span>
            <span>IPD & Discharge</span>
            <span>Lab & Radiology</span>
            <span>BME Portable</span>
            <span>Financials</span>
            <span>Pharmacy Audit</span>
          </div>
        </div>
        <div style="font-size: 11.5px; color: #bbf7d0; font-weight: 700;">
          Secure Clinical Workspace • IST Live Sync
        </div>
      </div>

      <div class="ar-form-panel">
        <div id="formContent">
          <div class="ar-form-tag">AR HIMS Portal</div>
          <div class="ar-form-title">Sign In to Workspace</div>
          <form onsubmit="handleLogin(event)">
            <div class="ar-input-group">
              <label for="lUser">Username</label>
              <input class="ar-input" id="lUser" type="text" placeholder="Enter username" autocomplete="off" required />
            </div>
            <div class="ar-input-group">
              <label for="lPass">Password</label>
              <input class="ar-input" id="lPass" type="password" placeholder="Enter password" autocomplete="new-password" required />
            </div>
            <button class="ar-submit-btn" type="submit">Login to AR HIMS</button>
          </form>
          <div class="ar-err" id="loginErr"></div>
        </div>

        <div class="ar-welcome-box" id="successMsg">
          <div class="ar-check">✓</div>
          <h3 style="font-size: 22px; font-weight: 900; color: #052e16;">Authenticated</h3>
          <p style="font-size: 13.5px; font-weight: 700; color: #1e293b;">Launching AR HIMS Dashboard...</p>
        </div>
      </div>
    </div>
  </div>

  <div id="appWrap">
    <aside class="sidebar">
      <div class="sbrand">
        <h2>AR HIMS</h2>
        <p id="dbBadge">Syncing...</p>
      </div>
      <button class="mbtn active" data-v="dash" onclick="showV('dash')"><span>Dashboard & Sales</span></button>
      <button class="mbtn" data-v="pat" onclick="showV('pat')"><span>Patients & Rx</span></button>
      <button class="mbtn" data-v="ipd" onclick="showV('ipd')"><span>IPD & Discharge</span><span class="pill" id="admPill">0</span></button>
      <button class="mbtn" data-v="bill" onclick="showV('bill')"><span>Billing, Edit & Refund</span></button>
      <button class="mbtn" data-v="lab" onclick="showV('lab')"><span>Laboratory</span></button>
      <button class="mbtn" data-v="rad" onclick="showV('rad')"><span>Radiology</span></button>
      <button class="mbtn" data-v="bme" onclick="showV('bme')"><span>BME Portable</span></button>
      <button class="mbtn" data-v="fin" onclick="showV('fin')"><span>Financials</span></button>
      <button class="mbtn" data-v="audit" onclick="showV('audit')"><span>Pharmacy Audit</span></button>
      <button class="mbtn" data-v="usr" onclick="showV('usr')"><span>User Management</span></button>
    </aside>

    <div class="content">
      <header class="topbar">
        <div><strong id="who">User</strong> • <span id="clock"></span></div>
        <div style="display: flex; gap: 7px;">
          <button class="btn bo bsm" onclick="syncAll()">Refresh</button>
          <button class="btn bd bsm" onclick="logoutNow()">Logout</button>
        </div>
      </header>

      <div class="work">
        <section id="v-dash" class="view">
          <div class="cards4">
            <div class="kcard b"><small>Total Sales</small><strong id="kSales">₹ 0.00</strong></div>
            <div class="kcard g"><small>Total Paid</small><strong id="kPaid">₹ 0.00</strong></div>
            <div class="kcard r"><small>Total Refunded</small><strong id="kRef">₹ 0.00</strong></div>
            <div class="kcard a"><small>Admitted / Discharged</small><strong id="kIpd">0 / 0</strong></div>
          </div>
          <div class="box">
            <div class="box-hd">
              <h3>Day-by-Day Sales Table (Date Filter)</h3>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <label>From:</label><input type="date" id="fFrom" onchange="renderSales()" />
                <label>To:</label><input type="date" id="fTo" onchange="renderSales()" />
                <button class="btn bo bsm" onclick="clearDates()">All Dates</button>
              </div>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Date</th><th>Bill No</th><th>UHID</th><th>Patient</th><th>Mode</th><th>Gross</th><th>Refund</th><th>Net</th><th>Paid</th><th>Due</th></tr></thead>
                <tbody id="salesTb"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="v-pat" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd"><h3>Patient Registration</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Patient Name *</label><input id="pName" /></div>
              <div class="fld"><label>Mobile (10-digit) *</label><input id="pMob" maxlength="10" /></div>
              <div class="fld"><label>Age / Gender</label><div style="display: flex; gap: 4px;"><input id="pAge" value="28" /><select id="pGen"><option>Male</option><option>Female</option></select></div></div>
              <div class="fld"><label>Doctor</label><input id="pDoc" value="Dr. A. Khan (General Physician)" /></div>
            </div>
            <button class="btn bs" onclick="savePatient()">Register Patient</button>
          </div>
          <div class="box">
            <div class="box-hd"><h3>Prescription Entry & Print</h3><button class="btn bp bsm" onclick="printRx()">Print Rx</button></div>
            <div class="g3" style="margin-bottom: 8px;">
              <div class="fld"><label>UHID</label><input id="rxUhid" /></div>
              <div class="fld"><label>Patient Name</label><input id="rxName" /></div>
              <div class="fld"><label>Diagnosis</label><input id="rxDiag" /></div>
            </div>
            <div class="fld"><label>Rx Notes / Medicines</label><textarea id="rxTxt"></textarea></div>
          </div>
        </section>

        <section id="v-ipd" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd"><h3>Admit Patient</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>UHID</label><input id="iUhid" /></div>
              <div class="fld"><label>Patient Name *</label><input id="iName" /></div>
              <div class="fld"><label>Ward</label><select id="iWard"><option>General Ward - Bed 02</option><option>Private Room - Room 01</option><option>ICU - Bed 01</option></select></div>
              <div class="fld"><label>Doctor</label><input id="iDoc" value="Dr. A. Khan (General Physician)" /></div>
            </div>
            <button class="btn bp bsm" onclick="admitNow()">Admit to IPD</button>
          </div>

          <div class="box">
            <div class="box-hd"><h3>Currently Admitted Patients</h3></div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>IPD No</th><th>UHID</th><th>Patient</th><th>Ward</th><th>Services Total</th><th>Action</th></tr></thead>
                <tbody id="admTb"></tbody>
              </table>
            </div>
          </div>

          <div class="box" id="ipdPanel" style="display: none;">
            <div class="box-hd"><h3 id="ipdPanelTitle">IPD Billing & Discharge</h3><button class="btn bo bsm" onclick="document.getElementById('ipdPanel').style.display='none'">Close</button></div>
            <input type="hidden" id="wIpd" />
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Service Name</label><input id="sName" placeholder="Bed / Doctor / Nursing / OT" /></div>
              <div class="fld"><label>Qty</label><input type="number" id="sQty" value="1" min="1" /></div>
              <div class="fld"><label>Rate (₹)</label><input type="number" id="sRate" value="500" min="0" /></div>
              <div class="fld" style="justify-content: flex-end;"><button class="btn bs bsm" onclick="addIpdService()">+ Add Service</button></div>
            </div>
            <div class="tbl-wrap" style="margin-bottom: 9px;">
              <table><thead><tr><th>Service</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody id="sTb"></tbody></table>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
              <button class="btn bw bsm" onclick="ipdBill('PROVISIONAL')">Provisional Bill</button>
              <button class="btn bp bsm" onclick="ipdBill('FINAL')">Final Bill & Discharge</button>
              <button class="btn bd bsm" onclick="ipdBill('DISCHARGE')">Discharge Patient</button>
            </div>
          </div>

          <div class="box">
            <div class="box-hd"><h3>Discharged Patients</h3></div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>IPD No</th><th>UHID</th><th>Patient</th><th>Ward</th><th>Discharge Date</th><th>Final Bill</th></tr></thead>
                <tbody id="disTb"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="v-bill" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd"><h3>New Bill</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>UHID</label><input id="bUhid" /></div>
              <div class="fld"><label>Patient Name *</label><input id="bName" /></div>
              <div class="fld"><label>Payment Mode</label><select id="bPay"><option>Cash</option><option>UPI / QR</option><option>Card</option><option>Credit</option></select></div>
              <div class="fld"><label>Date</label><input type="date" id="bDate" /></div>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
              <button class="btn bo bsm" onclick="addBillRow('HOSPITAL')">+ Service</button>
              <button class="btn bo bsm" onclick="addBillRow('LAB')">+ Lab Test</button>
              <button class="btn bo bsm" onclick="addBillRow('RADIOLOGY')">+ Radiology Test</button>
            </div>
            <div class="tbl-wrap">
              <table><thead><tr><th>Module</th><th>Item / Test</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>GST%</th><th>Total</th><th>Del</th></tr></thead><tbody id="bDraftTb"></tbody></table>
            </div>
            <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
              <strong id="bDraftNet">Net: ₹ 0.00</strong>
              <button class="btn bs" onclick="saveNewBill()">Save Bill</button>
            </div>
          </div>

          <div class="box">
            <div class="box-hd"><h3>Bills — Edit (with History), Refund & Delete</h3></div>
            <div class="tbl-wrap">
              <table><thead><tr><th>Bill No</th><th>Date</th><th>Patient</th><th>Net</th><th>Refund</th><th>Paid</th><th>Edits</th><th>Actions</th></tr></thead><tbody id="bListTb"></tbody></table>
            </div>
          </div>

          <div class="box" id="billEditBox" style="display: none;">
            <div class="box-hd"><h3 id="beTitle">Edit Bill & Refund</h3><button class="btn bo bsm" onclick="document.getElementById('billEditBox').style.display='none'">Close</button></div>
            <input type="hidden" id="beNo" />
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Adjust (+/- ₹)</label><input type="number" id="beAdj" /></div>
              <div class="fld"><label>Refund Amount (₹)</label><input type="number" id="beRef" min="0" /></div>
              <div class="fld"><label>Paid Amount (₹)</label><input type="number" id="bePaid" min="0" /></div>
              <div class="fld"><label>Edit / Refund Reason</label><input id="beReason" placeholder="Test cancelled / rate correction" /></div>
            </div>
            <div class="tbl-wrap" style="margin-bottom: 8px;">
              <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Cancel Item?</th></tr></thead><tbody id="beItemsTb"></tbody></table>
            </div>
            <button class="btn bs bsm" onclick="commitBillEdit()">Save Bill Changes</button>
            <div style="margin-top: 10px;"><strong style="font-size: 12px;">Bill Edit History:</strong><div id="beHist" style="margin-top: 4px; font-size: 11.5px; color: #1e293b;"></div></div>
          </div>
        </section>

        <section id="v-lab" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd">
              <h3>Laboratory — Parameters, Timestamps & Doctor Verification</h3>
              <div style="display: flex; gap: 6px;">
                <button class="btn bs bsm" onclick="saveLab(false)">Save Report</button>
                <button class="btn bw bsm" onclick="saveLab(true)">Verify & Save</button>
                <button class="btn bp bsm" onclick="printLabCurrent()">Print Lab Report</button>
              </div>
            </div>
            <input type="hidden" id="lId" />
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>UHID *</label><input id="lUhid" /></div>
              <div class="fld"><label>Patient Name *</label><input id="lPat" /></div>
              <div class="fld"><label>Test Name *</label><input id="lTest" /></div>
              <div class="fld"><label>Verifying Doctor</label><input id="lDoc" value="Dr. R. K. Sharma (MD Pathology)" /></div>
              <div class="fld"><label>Sample Collection Date & Time</label><input type="datetime-local" id="lCol" /></div>
              <div class="fld"><label>Report Done Date & Time</label><input type="datetime-local" id="lDone" /></div>
              <div class="fld" style="grid-column: span 2;"><label>Remarks</label><input id="lRem" /></div>
            </div>
            <div style="margin-bottom: 6px;"><button class="btn bo bsm" onclick="addLabParam()">+ Add Parameter</button></div>
            <div class="tbl-wrap">
              <table><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference Range</th><th>Del</th></tr></thead><tbody id="lParamTb"></tbody></table>
            </div>
          </div>
          <div class="box">
            <div class="box-hd"><h3>Saved Laboratory Reports</h3></div>
            <div class="tbl-wrap">
              <table><thead><tr><th>ID</th><th>UHID</th><th>Patient</th><th>Test</th><th>Collected</th><th>Done</th><th>Verified</th><th>Actions</th></tr></thead><tbody id="lSavedTb"></tbody></table>
            </div>
          </div>
        </section>

        <section id="v-rad" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd">
              <h3>Radiology — Findings, Impression, Timestamps & Doctor Verification</h3>
              <div style="display: flex; gap: 6px;">
                <button class="btn bs bsm" onclick="saveRad(false)">Save Report</button>
                <button class="btn bw bsm" onclick="saveRad(true)">Verify & Save</button>
                <button class="btn bp bsm" onclick="printRadCurrent()">Print Radiology Report</button>
              </div>
            </div>
            <input type="hidden" id="rId" />
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>UHID *</label><input id="rUhid" /></div>
              <div class="fld"><label>Patient Name *</label><input id="rPat" /></div>
              <div class="fld"><label>Modality</label><select id="rMod"><option>Digital X-Ray</option><option>USG</option><option>CT Scan</option><option>MRI</option></select></div>
              <div class="fld"><label>Study / Test Name *</label><input id="rTest" /></div>
              <div class="fld"><label>Sample / Scan Time</label><input type="datetime-local" id="rCol" /></div>
              <div class="fld"><label>Report Done Date & Time</label><input type="datetime-local" id="rDone" /></div>
              <div class="fld" style="grid-column: span 2;"><label>Verifying Doctor</label><input id="rDoc" value="Dr. Meena Verma (MD Radiology)" /></div>
            </div>
            <div class="g2">
              <div class="fld"><label>Findings</label><textarea id="rFind"></textarea></div>
              <div class="fld"><label>Impression</label><textarea id="rImp"></textarea></div>
            </div>
          </div>
          <div class="box">
            <div class="box-hd"><h3>Saved Radiology Reports</h3></div>
            <div class="tbl-wrap">
              <table><thead><tr><th>ID</th><th>UHID</th><th>Patient</th><th>Modality / Study</th><th>Done</th><th>Verified</th><th>Actions</th></tr></thead><tbody id="rSavedTb"></tbody></table>
            </div>
          </div>
        </section>

        <section id="v-bme" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd">
              <h3>BME Portable — Handheld & Bedside Equipment Tracker</h3>
              <div style="display: flex; gap: 6px;">
                <button class="btn bo bsm" onclick="clearBmeForm()">New Equipment</button>
                <button class="btn bp bsm" onclick="exportBmeJson()">Export Portable JSON</button>
              </div>
            </div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>BME ID (Blank = New)</label><input id="mId" placeholder="BME-P-01" /></div>
              <div class="fld"><label>Equipment Name *</label><input id="mName" placeholder="Portable USG / ECG / Monitor" /></div>
              <div class="fld"><label>Serial / Asset Code</label><input id="mSer" placeholder="PORT-101" /></div>
              <div class="fld"><label>Portable Type</label><select id="mMode"><option>Portable / Handheld</option><option>Mobile Cart</option><option>Bedside / Ward</option></select></div>
              <div class="fld"><label>Current Location / Ward</label><input id="mLoc" placeholder="Emergency / ICU / OT" /></div>
              <div class="fld"><label>Status</label><select id="mStat"><option>Operational</option><option>In Calibration</option><option>Breakdown</option></select></div>
              <div class="fld"><label>Calibration Due Date</label><input type="date" id="mCal" /></div>
              <div class="fld"><label>Battery / Portability OK</label><select id="mBat"><option>Yes</option><option>Charging Needed</option><option>Replace Battery</option></select></div>
            </div>
            <div class="fld" style="margin-bottom: 8px;">
              <label>Portable Check / Maintenance Notes</label>
              <input id="mNote" placeholder="Probe ok, charger packed, ready for bedside" />
            </div>
            <button class="btn bs" onclick="saveBme()">Save BME Portable Record</button>
          </div>
          <div class="box">
            <div class="box-hd"><h3>Portable BME Equipment Register</h3></div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>BME ID</th><th>Equipment</th><th>Serial</th><th>Type</th><th>Location</th><th>Status</th><th>Cal Due</th><th>Battery</th><th>Action</th></tr></thead>
                <tbody id="mTb"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="v-fin" class="view" style="display: none;">
          <div class="cards4">
            <div class="kcard g"><small>Total Income</small><strong id="fInc">₹ 0.00</strong></div>
            <div class="kcard r"><small>Total Expense</small><strong id="fExp">₹ 0.00</strong></div>
            <div class="kcard b"><small>Net Balance</small><strong id="fNet">₹ 0.00</strong></div>
            <div class="kcard a"><small>Total Entries</small><strong id="fCnt">0</strong></div>
          </div>
          <div class="box">
            <div class="box-hd"><h3>Financials — Record Income / Expense</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Type</label><select id="fnType"><option>Income</option><option>Expense</option></select></div>
              <div class="fld"><label>Category</label><select id="fnCat"><option>OPD / IPD Collection</option><option>Pharmacy & Lab</option><option>BME & Maintenance</option><option>Staff & Utility</option><option>Other</option></select></div>
              <div class="fld"><label>Account Head *</label><input id="fnHead" placeholder="Electricity / Equipment / Receipt" /></div>
              <div class="fld"><label>Amount (₹) *</label><input type="number" id="fnAmt" min="0" /></div>
              <div class="fld"><label>Mode</label><select id="fnMode"><option>Cash</option><option>UPI / QR</option><option>Card</option><option>Bank / Credit</option></select></div>
              <div class="fld"><label>Date</label><input type="date" id="fnDate" /></div>
              <div class="fld" style="grid-column: span 2;"><label>Remarks</label><input id="fnRem" /></div>
            </div>
            <button class="btn bs" onclick="saveFin()">Save Financial Entry</button>
          </div>
          <div class="box">
            <div class="box-hd">
              <h3>Financial Ledger</h3>
              <select id="fnFilter" onchange="renderFin()"><option value="ALL">All Types</option><option value="Income">Income Only</option><option value="Expense">Expense Only</option></select>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Category</th><th>Account Head</th><th>Mode</th><th>Amount</th><th>By</th></tr></thead>
                <tbody id="fnTb"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="v-audit" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd"><h3>Pharmacy Audit — Full Edit & Stock Sync</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Audit ID (Blank = New)</label><input id="aId" /></div>
              <div class="fld"><label>Medicine Name *</label><input id="aMed" /></div>
              <div class="fld"><label>Batch</label><input id="aBatch" /></div>
              <div class="fld"><label>Rate (₹)</label><input type="number" id="aRate" /></div>
              <div class="fld"><label>System Qty</label><input type="number" id="aSys" /></div>
              <div class="fld"><label>Physical Qty</label><input type="number" id="aPhys" /></div>
              <div class="fld"><label>Diff Qty</label><input type="number" id="aDiff" placeholder="Auto if blank" /></div>
              <div class="fld"><label>Value Diff ₹</label><input type="number" id="aVal" placeholder="Auto if blank" /></div>
            </div>
            <div class="g2" style="margin-bottom: 8px;">
              <div class="fld"><label>Status</label><input id="aStat" /></div>
              <div class="fld"><label>Audit Notes</label><input id="aNote" /></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <label><input type="checkbox" id="aSync" checked /> Sync Pharmacy Stock with Physical Qty</label>
              <button class="btn bs" onclick="saveAudit()">Save Audit</button>
            </div>
            <div class="tbl-wrap" style="margin-top: 10px;">
              <table><thead><tr><th>Audit ID</th><th>Date</th><th>Medicine</th><th>Batch</th><th>Sys</th><th>Phys</th><th>Diff</th><th>Val Diff</th><th>By</th><th>Edit</th></tr></thead><tbody id="aTb"></tbody></table>
            </div>
          </div>
        </section>

        <section id="v-usr" class="view" style="display: none;">
          <div class="box">
            <div class="box-hd"><h3>User Management — Create, Edit Role/Password & Access</h3></div>
            <div class="g4" style="margin-bottom: 8px;">
              <div class="fld"><label>Full Name *</label><input id="uName" /></div>
              <div class="fld"><label>Username *</label><input id="uUser" /></div>
              <div class="fld"><label>Password *</label><input id="uPass" /></div>
              <div class="fld"><label>Role</label><select id="uRole"><option>Staff</option><option>Admin</option><option>Super Admin</option></select></div>
            </div>
            <label style="display: inline-block; margin-bottom: 8px; font-weight: 700;"><input type="checkbox" id="uEdit" /> Grant Edit Permission</label><br />
            <button class="btn bs bsm" onclick="createUser()">Create User</button>
            <div class="tbl-wrap" style="margin-top: 10px;">
              <table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Permissions</th><th>Manage</th></tr></thead><tbody id="uTb"></tbody></table>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>

  <div class="print-bg" id="printBg">
    <div class="print-bar">
      <button class="btn bp" onclick="window.print()">Print A4</button>
      <button class="btn bo" onclick="document.getElementById('printBg').style.display='none'">Close</button>
    </div>
    <div id="printContent"></div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    let STORE = null;
    let ME = null;
    let draftItems = [];
    let labParams = [];

    const DEFAULT_USERS = [
      { id: "USR-1", name: "Aarif Rabbani", username: "Aarif", password: "786", role: "Super Admin", permissions: ["all", "edit"], status: "Active" },
      { id: "USR-2", name: "Admin User", username: "admin", password: "123", role: "Admin", permissions: ["all", "edit"], status: "Active" },
      { id: "USR-3", name: "Staff User", username: "staff", password: "123", role: "Staff", permissions: ["dashboard", "patients", "ipd", "billing", "lab", "radiology", "pharmacy", "bme", "financials"], status: "Active" }
    ];

    function toast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.style.display = "block";
      clearTimeout(window._tt);
      window._tt = setTimeout(() => { t.style.display = "none"; }, 2800);
    }

    function r2(n) {
      return Math.round((Number(n) || 0) * 100) / 100;
    }

    function esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function todayIST() {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    }

    function hasEditPerm() {
      if (!ME) return false;
      const r = String(ME.role || "").toLowerCase();
      const p = (ME.permissions || []).map(x => String(x).toLowerCase());
      return r === "super admin" || r === "admin" || p.includes("all") || p.includes("edit");
    }

    async function handleLogin(e) {
      e.preventDefault();
      const errEl = document.getElementById("loginErr");
      errEl.textContent = "";
      const uVal = String(document.getElementById("lUser").value || "").trim();
      const pVal = String(document.getElementById("lPass").value || "");
      if (!uVal || !pVal) {
        errEl.textContent = "Please enter Username and Password.";
        return;
      }

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: uVal, password: pVal })
        });
        const out = await res.json();
        if (out && out.success && out.user) {
          completeLoginSuccess(out.user);
          return;
        }
      } catch (_err) {}

      const poolUsers = (STORE && Array.isArray(STORE.users) && STORE.users.length) ? STORE.users : DEFAULT_USERS;
      const found = poolUsers.find(x =>
        String(x.username || "").trim().toLowerCase() === uVal.toLowerCase() &&
        String(x.password || "") === pVal
      );

      if (found) {
        if (String(found.status || "Active").toLowerCase() === "deactivated") {
          errEl.textContent = "Account is deactivated.";
          return;
        }
        completeLoginSuccess(found);
        return;
      }

      errEl.textContent = "Invalid Username or Password.";
    }

    function completeLoginSuccess(userObj) {
      sessionStorage.setItem("arhims_session", JSON.stringify(userObj));
      document.getElementById("formContent").style.display = "none";
      document.getElementById("successMsg").style.display = "flex";
      setTimeout(() => { startSession(userObj); }, 320);
    }

    function logoutNow() {
      sessionStorage.removeItem("arhims_session");
      ME = null;
      document.getElementById("lUser").value = "";
      document.getElementById("lPass").value = "";
      document.getElementById("loginErr").textContent = "";
      document.getElementById("appWrap").style.display = "none";
      document.getElementById("successMsg").style.display = "none";
      document.getElementById("formContent").style.display = "block";
      document.getElementById("loginWrap").style.display = "flex";
    }

    function startSession(u) {
      ME = u;
      document.getElementById("loginWrap").style.display = "none";
      document.getElementById("appWrap").style.display = "flex";
      document.getElementById("who").textContent = `${u.name} (${u.role})${hasEditPerm() ? " • Edit Access" : ""}`;
      const bDateEl = document.getElementById("bDate");
      if (bDateEl && !bDateEl.value) bDateEl.value = todayIST();
      const fnDateEl = document.getElementById("fnDate");
      if (fnDateEl && !fnDateEl.value) fnDateEl.value = todayIST();
      syncAll();
    }

    async function syncAll() {
      try {
        const res = await fetch("/api/bootstrap");
        const out = await res.json();
        if (!out || !out.success) return;
        STORE = out.erpData;
        document.getElementById("dbBadge").textContent = out.dbMode;
        document.getElementById("clock").textContent = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });
        const admCount = (STORE.ipdAdmissions || []).filter(x => x.status === "Admitted").length;
        const disCount = (STORE.ipdAdmissions || []).filter(x => x.status === "Discharged").length;
        document.getElementById("admPill").textContent = admCount;
        document.getElementById("kIpd").textContent = `${admCount} / ${disCount}`;
        renderSales();
        renderIpd();
        renderBills();
        renderLab();
        renderRad();
        renderBme();
        renderFin();
        renderAudit();
        renderUsers();
      } catch (_err) {}
    }

    function showV(v) {
      document.querySelectorAll(".view").forEach(el => { el.style.display = "none"; });
      document.getElementById(`v-${v}`).style.display = "block";
      document.querySelectorAll(".mbtn").forEach(b => { b.classList.toggle("active", b.dataset.v === v); });
    }

    function clearDates() {
      document.getElementById("fFrom").value = "";
      document.getElementById("fTo").value = "";
      renderSales();
    }

    function renderSales() {
      if (!STORE) return;
      const fromD = document.getElementById("fFrom").value;
      const toD = document.getElementById("fTo").value;
      const rows = (STORE.bills || []).filter(b => (!fromD || b.date >= fromD) && (!toD || b.date <= toD));
      const salesSum = r2(rows.reduce((s, b) => s + Number(b.netFee || 0), 0));
      const paidSum = r2(rows.reduce((s, b) => s + Number(b.paidAmount || 0), 0));
      const refSum = r2(rows.reduce((s, b) => s + Number(b.refundAmount || 0), 0));
      document.getElementById("kSales").textContent = `₹ ${salesSum.toFixed(2)}`;
      document.getElementById("kPaid").textContent = `₹ ${paidSum.toFixed(2)}`;
      document.getElementById("kRef").textContent = `₹ ${refSum.toFixed(2)}`;
      document.getElementById("salesTb").innerHTML = rows.map(b =>
        `<tr><td>${esc(b.date)}</td><td><b>${esc(b.billNo)}</b></td><td>${esc(b.uhid)}</td><td>${esc(b.patientName)}</td><td>${esc(b.payType)}</td><td>₹${r2(b.totalGross).toFixed(2)}</td><td>₹${r2(b.refundAmount).toFixed(2)}</td><td><b>₹${r2(b.netFee).toFixed(2)}</b></td><td>₹${r2(b.paidAmount).toFixed(2)}</td><td>₹${r2(b.dueAmount).toFixed(2)}</td></tr>`
      ).join("") || "<tr><td colspan='10'>No sales records for selected date.</td></tr>";
    }

    async function savePatient() {
      const res = await fetch("/api/patients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("pName").value,
          contact: document.getElementById("pMob").value,
          age: document.getElementById("pAge").value,
          gender: document.getElementById("pGen").value,
          doctor: document.getElementById("pDoc").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast(`Patient Registered: ${out.patient.uhid}`);
      syncAll();
    }

    function printRx() {
      const uhid = document.getElementById("rxUhid").value;
      const pat = document.getElementById("rxName").value;
      const diag = document.getElementById("rxDiag").value;
      const rx = document.getElementById("rxTxt").value;
      const doc = document.getElementById("pDoc").value;
      document.getElementById("printContent").innerHTML = `<div class="a4"><div><div style="border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;"><div><h2>AR HIMS</h2><div>PRESCRIPTION</div></div><div><b>Date:</b> ${esc(todayIST())}</div></div><p><b>UHID:</b> ${esc(uhid)} &nbsp; | &nbsp; <b>Patient:</b> ${esc(pat)} &nbsp; | &nbsp; <b>Doctor:</b> ${esc(doc)}</p><p style="margin-top:8px;"><b>Diagnosis:</b> ${esc(diag)}</p><hr style="margin:8px 0;"/><pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;">${esc(rx)}</pre></div><div style="border-top:1px solid #000;padding-top:8px;text-align:right;"><b>${esc(doc)}</b></div></div>`;
      document.getElementById("printBg").style.display = "block";
    }

    async function admitNow() {
      const res = await fetch("/api/ipd/admit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uhid: document.getElementById("iUhid").value,
          patientName: document.getElementById("iName").value,
          ward: document.getElementById("iWard").value,
          doctor: document.getElementById("iDoc").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast(`Admitted ${out.admission.ipdNo}`);
      syncAll();
    }

    function renderIpd() {
      const admitted = (STORE.ipdAdmissions || []).filter(x => x.status === "Admitted");
      const discharged = (STORE.ipdAdmissions || []).filter(x => x.status === "Discharged");
      document.getElementById("admTb").innerHTML = admitted.map(a => {
        const tot = r2((a.services || []).reduce((s, x) => s + Number(x.amount || 0), 0));
        return `<tr><td><b>${esc(a.ipdNo)}</b></td><td>${esc(a.uhid)}</td><td>${esc(a.patientName)}</td><td>${esc(a.ward)}</td><td><b>₹${tot.toFixed(2)}</b></td><td><button class="btn bp bsm" onclick="openIpdPanel('${esc(a.ipdNo)}')">Services / Bill / Discharge</button></td></tr>`;
      }).join("") || "<tr><td colspan='6'>No currently admitted patients.</td></tr>";
      document.getElementById("disTb").innerHTML = discharged.map(d =>
        `<tr><td><b>${esc(d.ipdNo)}</b></td><td>${esc(d.uhid)}</td><td>${esc(d.patientName)}</td><td>${esc(d.ward)}</td><td>${esc(d.dischargeDate || "-")}</td><td>${esc(d.finalBillNo || "-")}</td></tr>`
      ).join("") || "<tr><td colspan='6'>No discharged patients yet.</td></tr>";
    }

    function openIpdPanel(ipdNo) {
      const a = (STORE.ipdAdmissions || []).find(x => x.ipdNo === ipdNo);
      if (!a) return;
      document.getElementById("wIpd").value = a.ipdNo;
      document.getElementById("ipdPanelTitle").textContent = `${a.ipdNo} — ${a.patientName} (${a.ward})`;
      document.getElementById("ipdPanel").style.display = "block";
      document.getElementById("sTb").innerHTML = (a.services || []).map(s =>
        `<tr><td>${esc(s.name)}</td><td>${s.qty}</td><td>₹${r2(s.rate).toFixed(2)}</td><td><b>₹${r2(s.amount).toFixed(2)}</b></td></tr>`
      ).join("");
    }

    async function addIpdService() {
      const ipdNo = document.getElementById("wIpd").value;
      const res = await fetch("/api/ipd/add-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipdNo,
          name: document.getElementById("sName").value,
          qty: document.getElementById("sQty").value,
          rate: document.getElementById("sRate").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast("Service Added");
      await syncAll();
      openIpdPanel(ipdNo);
    }

    async function ipdBill(mode) {
      const ipdNo = document.getElementById("wIpd").value;
      const res = await fetch("/api/ipd/bill-or-discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipdNo, mode, actor: ME.username })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      if (mode === "PROVISIONAL") {
        document.getElementById("printContent").innerHTML = `<div class="a4"><div><h2>AR HIMS — PROVISIONAL BILL</h2><p><b>IPD:</b> ${esc(ipdNo)} | <b>Patient:</b> ${esc(out.bill.patientName)}</p><hr style="margin:8px 0;"/>${(out.bill.items || []).map(i => `<p>${esc(i.name)} × ${i.qty} = ₹${r2(i.lineTotal).toFixed(2)}</p>`).join("")}<h3 style="margin-top:12px;">Provisional Total: ₹ ${r2(out.bill.netFee).toFixed(2)}</h3></div></div>`;
        document.getElementById("printBg").style.display = "block";
      } else {
        toast(`${mode} complete. Patient moved to Discharged.`);
        document.getElementById("ipdPanel").style.display = "none";
        syncAll();
      }
    }

    function addBillRow(module) {
      const defaultName = module === "LAB" ? "CBC" : (module === "RADIOLOGY" ? "Chest X-Ray" : "Consultation");
      draftItems.push({ module, name: defaultName, qty: 1, rate: 300, discPct: 0, gstPct: 0 });
      drawDraft();
    }

    function drawDraft() {
      let net = 0;
      document.getElementById("bDraftTb").innerHTML = draftItems.map((it, i) => {
        const g = r2(Number(it.qty || 1) * Number(it.rate || 0));
        const d = r2(g * Number(it.discPct || 0) / 100);
        const tx = r2(Math.max(0, g - d));
        const tot = r2(tx + (tx * Number(it.gstPct || 0) / 100));
        net = r2(net + tot);
        return `<tr><td>${esc(it.module)}</td><td><input value="${esc(it.name)}" onchange="draftItems[${i}].name=this.value"/></td><td><input type="number" min="1" value="${it.qty}" onchange="draftItems[${i}].qty=Number(this.value||1);drawDraft()"/></td><td><input type="number" min="0" value="${it.rate}" onchange="draftItems[${i}].rate=Number(this.value||0);drawDraft()"/></td><td><input type="number" min="0" value="${it.discPct}" onchange="draftItems[${i}].discPct=Number(this.value||0);drawDraft()"/></td><td><input type="number" min="0" value="${it.gstPct}" onchange="draftItems[${i}].gstPct=Number(this.value||0);drawDraft()"/></td><td><b>₹${tot.toFixed(2)}</b></td><td><button class="btn bd bsm" onclick="draftItems.splice(${i},1);drawDraft()">X</button></td></tr>`;
      }).join("");
      document.getElementById("bDraftNet").textContent = `Net: ₹ ${net.toFixed(2)}`;
    }

    async function saveNewBill() {
      const res = await fetch("/api/bills/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uhid: document.getElementById("bUhid").value,
          patientName: document.getElementById("bName").value,
          payType: document.getElementById("bPay").value,
          date: document.getElementById("bDate").value,
          items: draftItems,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      draftItems = [];
      drawDraft();
      toast(`Saved ${out.bill.billNo}`);
      syncAll();
    }

    function renderBills() {
      drawDraft();
      const canE = hasEditPerm();
      document.getElementById("bListTb").innerHTML = (STORE.bills || []).map(b => {
        const btns = canE
          ? `<button class="btn bw bsm" onclick="openBillEditor('${esc(b.billNo)}')">Edit / Refund</button> <button class="btn bd bsm" onclick="delBill('${esc(b.billNo)}')">Delete</button>`
          : "<small>No Edit Access</small>";
        return `<tr><td><b>${esc(b.billNo)}</b></td><td>${esc(b.date)}</td><td>${esc(b.patientName)}</td><td><b>₹${r2(b.netFee).toFixed(2)}</b></td><td>₹${r2(b.refundAmount).toFixed(2)}</td><td>₹${r2(b.paidAmount).toFixed(2)}</td><td>${(b.editHistory || []).length}</td><td>${btns}</td></tr>`;
      }).join("");
    }

    function openBillEditor(billNo) {
      const b = (STORE.bills || []).find(x => x.billNo === billNo);
      if (!b) return;
      document.getElementById("beNo").value = b.billNo;
      document.getElementById("beTitle").textContent = `Edit / Refund Bill: ${b.billNo}`;
      document.getElementById("beAdj").value = b.adjustAmount || 0;
      document.getElementById("beRef").value = b.refundAmount || 0;
      document.getElementById("bePaid").value = b.paidAmount || 0;
      document.getElementById("beReason").value = "";
      document.getElementById("beItemsTb").innerHTML = (b.items || []).map((it, i) =>
        `<tr><td>${esc(it.name)}</td><td>${it.qty}</td><td>₹${r2(it.rate).toFixed(2)}</td><td><input type="checkbox" class="beCancel" data-idx="${i}" ${it.cancelled ? "checked" : ""}/> Cancel</td></tr>`
      ).join("");
      document.getElementById("beHist").innerHTML = (b.editHistory || []).map(h =>
        `<div>• [${esc(h.editedAt)}] by <b>${esc(h.editedBy)}</b>: ${esc(h.reason)} | Net ₹${h.prevNetFee} → ₹${h.newNetFee} | Refund ₹${h.newRefund}</div>`
      ).join("") || "<div>No previous edits.</div>";
      document.getElementById("billEditBox").style.display = "block";
    }

    async function commitBillEdit() {
      const billNo = document.getElementById("beNo").value;
      const b = (STORE.bills || []).find(x => x.billNo === billNo);
      if (!b) return;
      const items = (b.items || []).map((it, i) => {
        const chk = document.querySelector(`.beCancel[data-idx="${i}"]`);
        return Object.assign({}, it, { cancelled: chk ? chk.checked : Boolean(it.cancelled) });
      });
      const res = await fetch("/api/bills/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billNo,
          items,
          adjustAmount: document.getElementById("beAdj").value,
          refundAmount: document.getElementById("beRef").value,
          paidAmount: document.getElementById("bePaid").value,
          reason: document.getElementById("beReason").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast("Bill Updated & History Saved");
      await syncAll();
      openBillEditor(billNo);
    }

    async function delBill(billNo) {
      if (!confirm(`Delete bill ${billNo}?`)) return;
      const res = await fetch("/api/bills/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billNo, actor: ME.username })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast(`Deleted ${billNo}`);
      syncAll();
    }

    function addLabParam() {
      labParams.push({ name: "", value: "", unit: "", refRange: "" });
      drawLabParams();
    }

    function drawLabParams() {
      document.getElementById("lParamTb").innerHTML = labParams.map((p, i) =>
        `<tr><td><input value="${esc(p.name)}" onchange="labParams[${i}].name=this.value"/></td><td><input value="${esc(p.value)}" onchange="labParams[${i}].value=this.value"/></td><td><input value="${esc(p.unit)}" onchange="labParams[${i}].unit=this.value"/></td><td><input value="${esc(p.refRange)}" onchange="labParams[${i}].refRange=this.value"/></td><td><button class="btn bd bsm" onclick="labParams.splice(${i},1);drawLabParams()">X</button></td></tr>`
      ).join("");
    }

    async function saveLab(verify) {
      const res = await fetch("/api/lab/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: document.getElementById("lId").value || undefined,
          uhid: document.getElementById("lUhid").value,
          patientName: document.getElementById("lPat").value,
          testName: document.getElementById("lTest").value,
          doctorName: document.getElementById("lDoc").value,
          sampleCollectedAt: document.getElementById("lCol").value,
          reportDoneAt: document.getElementById("lDone").value,
          remarks: document.getElementById("lRem").value,
          parameters: labParams,
          verify,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      document.getElementById("lId").value = out.report.testId;
      toast("Lab Report Saved");
      syncAll();
    }

    function renderLab() {
      if (!document.getElementById("lCol").value) document.getElementById("lCol").value = new Date().toISOString().slice(0, 16);
      if (!labParams.length) labParams = [{ name: "Hemoglobin", value: "13.5", unit: "g/dL", refRange: "13.0 - 17.0" }];
      drawLabParams();
      document.getElementById("lSavedTb").innerHTML = (STORE.laboratory || []).map(r =>
        `<tr><td><b>${esc(r.testId)}</b></td><td>${esc(r.uhid)}</td><td>${esc(r.patientName)}</td><td>${esc(r.testName)}</td><td>${esc((r.sampleCollectedAt || "").replace("T", " "))}</td><td>${esc((r.reportDoneAt || "").replace("T", " "))}</td><td>${r.verified ? `✔ ${esc(r.verifiedBy)}` : "Pending"}</td><td><button class="btn bo bsm" onclick="loadLab('${esc(r.testId)}')">Edit</button> <button class="btn bp bsm" onclick="printLabById('${esc(r.testId)}')">Print</button></td></tr>`
      ).join("");
    }

    function loadLab(id) {
      const r = (STORE.laboratory || []).find(x => x.testId === id);
      if (!r) return;
      document.getElementById("lId").value = r.testId;
      document.getElementById("lUhid").value = r.uhid;
      document.getElementById("lPat").value = r.patientName;
      document.getElementById("lTest").value = r.testName;
      document.getElementById("lDoc").value = r.doctorName || "";
      document.getElementById("lCol").value = r.sampleCollectedAt || "";
      document.getElementById("lDone").value = r.reportDoneAt || "";
      document.getElementById("lRem").value = r.remarks || "";
      labParams = Array.isArray(r.parameters) && r.parameters.length ? r.parameters.slice() : [];
      drawLabParams();
    }

    function printLabCurrent() {
      const id = document.getElementById("lId").value;
      if (id) return printLabById(id);
      toast("Save report first or click Print on a saved report.");
    }

    function printLabById(id) {
      const r = (STORE.laboratory || []).find(x => x.testId === id);
      if (!r) return;
      const pRows = (r.parameters || []).map(p => `<tr><td>${esc(p.name)}</td><td><b>${esc(p.value)}</b></td><td>${esc(p.unit)}</td><td>${esc(p.refRange)}</td></tr>`).join("");
      document.getElementById("printContent").innerHTML = `<div class="a4"><div><h2>AR HIMS — LABORATORY REPORT</h2><p><b>ID:</b> ${esc(r.testId)} | <b>UHID:</b> ${esc(r.uhid)} | <b>Patient:</b> ${esc(r.patientName)}</p><p><b>Test:</b> ${esc(r.testName)} | <b>Collected:</b> ${esc((r.sampleCollectedAt || "").replace("T", " "))} | <b>Done:</b> ${esc((r.reportDoneAt || "").replace("T", " "))}</p><table style="margin-top:10px;"><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Ref Range</th></tr></thead><tbody>${pRows}</tbody></table><p style="margin-top:10px;"><b>Remarks:</b> ${esc(r.remarks || "-")}</p></div><div style="border-top:1px solid #000;padding-top:8px;display:flex;justify-content:space-between;"><div>Status: <b>${esc(r.status)}</b></div><div><b>${esc(r.verifiedBy || r.doctorName || "Doctor")}</b></div></div></div>`;
      document.getElementById("printBg").style.display = "block";
    }

    async function saveRad(verify) {
      const res = await fetch("/api/radiology/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radId: document.getElementById("rId").value || undefined,
          uhid: document.getElementById("rUhid").value,
          patientName: document.getElementById("rPat").value,
          modality: document.getElementById("rMod").value,
          testName: document.getElementById("rTest").value,
          doctorName: document.getElementById("rDoc").value,
          sampleCollectedAt: document.getElementById("rCol").value,
          reportDoneAt: document.getElementById("rDone").value,
          findings: document.getElementById("rFind").value,
          impression: document.getElementById("rImp").value,
          verify,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      document.getElementById("rId").value = out.report.radId;
      toast("Radiology Report Saved");
      syncAll();
    }

    function renderRad() {
      if (!document.getElementById("rCol").value) document.getElementById("rCol").value = new Date().toISOString().slice(0, 16);
      document.getElementById("rSavedTb").innerHTML = (STORE.radiology || []).map(r =>
        `<tr><td><b>${esc(r.radId)}</b></td><td>${esc(r.uhid)}</td><td>${esc(r.patientName)}</td><td>${esc(r.modality)} - ${esc(r.testName)}</td><td>${esc((r.reportDoneAt || "").replace("T", " "))}</td><td>${r.verified ? `✔ ${esc(r.verifiedBy)}` : "Pending"}</td><td><button class="btn bo bsm" onclick="loadRad('${esc(r.radId)}')">Edit</button> <button class="btn bp bsm" onclick="printRadById('${esc(r.radId)}')">Print</button></td></tr>`
      ).join("");
    }

    function loadRad(id) {
      const r = (STORE.radiology || []).find(x => x.radId === id);
      if (!r) return;
      document.getElementById("rId").value = r.radId;
      document.getElementById("rUhid").value = r.uhid;
      document.getElementById("rPat").value = r.patientName;
      document.getElementById("rMod").value = r.modality || "X-Ray";
      document.getElementById("rTest").value = r.testName;
      document.getElementById("rDoc").value = r.doctorName || "";
      document.getElementById("rCol").value = r.sampleCollectedAt || "";
      document.getElementById("rDone").value = r.reportDoneAt || "";
      document.getElementById("rFind").value = r.findings || "";
      document.getElementById("rImp").value = r.impression || "";
    }

    function printRadCurrent() {
      const id = document.getElementById("rId").value;
      if (id) return printRadById(id);
      toast("Save report first or click Print on a saved report.");
    }

    function printRadById(id) {
      const r = (STORE.radiology || []).find(x => x.radId === id);
      if (!r) return;
      document.getElementById("printContent").innerHTML = `<div class="a4"><div><h2>AR HIMS — RADIOLOGY REPORT</h2><p><b>ID:</b> ${esc(r.radId)} | <b>UHID:</b> ${esc(r.uhid)} | <b>Patient:</b> ${esc(r.patientName)}</p><p><b>Study:</b> ${esc(r.modality)} - ${esc(r.testName)} | <b>Done:</b> ${esc((r.reportDoneAt || "").replace("T", " "))}</p><p style="margin-top:10px;"><b>Findings:</b></p><pre style="white-space:pre-wrap;border:1px solid #000;padding:8px;min-height:120px;">${esc(r.findings)}</pre><p style="margin-top:10px;"><b>Impression:</b> ${esc(r.impression)}</p></div><div style="border-top:1px solid #000;padding-top:8px;display:flex;justify-content:space-between;"><div>Status: <b>${esc(r.status)}</b></div><div><b>${esc(r.verifiedBy || r.doctorName || "Radiologist")}</b></div></div></div>`;
      document.getElementById("printBg").style.display = "block";
    }

    function clearBmeForm() {
      ["mId", "mName", "mSer", "mLoc", "mCal", "mNote"].forEach(id => { document.getElementById(id).value = ""; });
    }

    function loadBme(id) {
      const m = (STORE.bmePortable || []).find(x => x.bmeId === id);
      if (!m) return;
      document.getElementById("mId").value = m.bmeId;
      document.getElementById("mName").value = m.name;
      document.getElementById("mSer").value = m.serialNo || "";
      document.getElementById("mMode").value = m.portableMode || "Portable / Handheld";
      document.getElementById("mLoc").value = m.location || "";
      document.getElementById("mStat").value = m.status || "Operational";
      document.getElementById("mCal").value = m.calDueDate || "";
      document.getElementById("mBat").value = m.batteryOk || "Yes";
      document.getElementById("mNote").value = m.notes || "";
    }

    async function saveBme() {
      const res = await fetch("/api/bme/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bmeId: document.getElementById("mId").value || undefined,
          name: document.getElementById("mName").value,
          serialNo: document.getElementById("mSer").value,
          portableMode: document.getElementById("mMode").value,
          location: document.getElementById("mLoc").value,
          status: document.getElementById("mStat").value,
          calDueDate: document.getElementById("mCal").value,
          batteryOk: document.getElementById("mBat").value,
          notes: document.getElementById("mNote").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast(`BME Portable Saved: ${out.bme.bmeId}`);
      syncAll();
    }

    function renderBme() {
      document.getElementById("mTb").innerHTML = (STORE.bmePortable || []).map(m =>
        `<tr><td><b>${esc(m.bmeId)}</b></td><td>${esc(m.name)}</td><td>${esc(m.serialNo || "-")}</td><td>${esc(m.portableMode || "Portable")}</td><td>${esc(m.location || "-")}</td><td><b>${esc(m.status)}</b></td><td>${esc(m.calDueDate || "-")}</td><td>${esc(m.batteryOk || "Yes")}</td><td><button class="btn bw bsm" onclick="loadBme('${esc(m.bmeId)}')">Edit</button></td></tr>`
      ).join("") || "<tr><td colspan='9'>No portable BME equipment added.</td></tr>";
    }

    function exportBmeJson() {
      const blob = new Blob([JSON.stringify((STORE && STORE.bmePortable) || [], null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "arhims-bme-portable.json";
      a.click();
    }

    async function saveFin() {
      const res = await fetch("/api/financials/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: document.getElementById("fnType").value,
          category: document.getElementById("fnCat").value,
          head: document.getElementById("fnHead").value,
          amount: document.getElementById("fnAmt").value,
          mode: document.getElementById("fnMode").value,
          date: document.getElementById("fnDate").value,
          remarks: document.getElementById("fnRem").value,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      ["fnHead", "fnAmt", "fnRem"].forEach(id => { document.getElementById(id).value = ""; });
      toast("Financial Entry Saved");
      syncAll();
    }

    function renderFin() {
      const all = STORE.financialEntries || [];
      const flt = document.getElementById("fnFilter").value;
      const rows = all.filter(x => flt === "ALL" || x.type === flt);
      const inc = r2(all.filter(x => x.type === "Income").reduce((s, x) => s + Number(x.amount || 0), 0));
      const exp = r2(all.filter(x => x.type === "Expense").reduce((s, x) => s + Number(x.amount || 0), 0));
      document.getElementById("fInc").textContent = `₹ ${inc.toFixed(2)}`;
      document.getElementById("fExp").textContent = `₹ ${exp.toFixed(2)}`;
      document.getElementById("fNet").textContent = `₹ ${r2(inc - exp).toFixed(2)}`;
      document.getElementById("fCnt").textContent = all.length;
      document.getElementById("fnTb").innerHTML = rows.map(x =>
        `<tr><td><b>${esc(x.finId)}</b></td><td>${esc(x.date)}</td><td><b>${esc(x.type)}</b></td><td>${esc(x.category)}</td><td>${esc(x.head)}</td><td>${esc(x.mode)}</td><td><b>₹${r2(x.amount).toFixed(2)}</b></td><td>${esc(x.by || "-")}</td></tr>`
      ).join("") || "<tr><td colspan='8'>No financial entries.</td></tr>";
    }

    function renderAudit() {
      document.getElementById("aTb").innerHTML = (STORE.pharmacyAudits || []).map(a =>
        `<tr><td><b>${esc(a.auditId)}</b></td><td>${esc(a.date)}</td><td>${esc(a.itemName)}</td><td>${esc(a.batch)}</td><td>${a.systemQty}</td><td>${a.physicalQty}</td><td><b>${a.diffQty}</b></td><td><b>₹${r2(a.valueDiff).toFixed(2)}</b></td><td>${esc(a.updatedBy || "-")}</td><td><button class="btn bw bsm" onclick="loadAudit('${esc(a.auditId)}')">Edit</button></td></tr>`
      ).join("");
    }

    function loadAudit(id) {
      const a = (STORE.pharmacyAudits || []).find(x => x.auditId === id);
      if (!a) return;
      document.getElementById("aId").value = a.auditId;
      document.getElementById("aMed").value = a.itemName;
      document.getElementById("aBatch").value = a.batch;
      document.getElementById("aRate").value = a.rate || 0;
      document.getElementById("aSys").value = a.systemQty;
      document.getElementById("aPhys").value = a.physicalQty;
      document.getElementById("aDiff").value = a.diffQty;
      document.getElementById("aVal").value = a.valueDiff;
      document.getElementById("aStat").value = a.status || "Adjusted";
      document.getElementById("aNote").value = a.notes || "";
    }

    async function saveAudit() {
      const res = await fetch("/api/pharmacy/audit/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: document.getElementById("aId").value || undefined,
          itemName: document.getElementById("aMed").value,
          batch: document.getElementById("aBatch").value,
          rate: document.getElementById("aRate").value,
          systemQty: document.getElementById("aSys").value,
          physicalQty: document.getElementById("aPhys").value,
          diffQty: document.getElementById("aDiff").value,
          valueDiff: document.getElementById("aVal").value,
          status: document.getElementById("aStat").value,
          notes: document.getElementById("aNote").value,
          syncStock: document.getElementById("aSync").checked,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast("Audit Saved");
      syncAll();
    }

    function renderUsers() {
      const canE = hasEditPerm();
      document.getElementById("uTb").innerHTML = (STORE.users || []).map(u => {
        const st = u.status || "Active";
        const nextSt = st === "Active" ? "Deactivated" : "Active";
        const acts = canE
          ? `<button class="btn bo bsm" onclick="updUser('${esc(u.id)}',{toggleEdit:true})">Toggle Edit</button> <button class="btn bw bsm" onclick="updUser('${esc(u.id)}',{status:'${nextSt}'})">${nextSt === "Active" ? "Activate" : "Deactivate"}</button> <button class="btn bd bsm" onclick="delUser('${esc(u.id)}')">Delete</button>`
          : "<small>View Only</small>";
        return `<tr><td>${esc(u.name)}</td><td><b>${esc(u.username)}</b></td><td>${esc(u.role)}</td><td><b>${esc(st)}</b></td><td>${esc((u.permissions || []).join(", "))}</td><td>${acts}</td></tr>`;
      }).join("");
    }

    async function createUser() {
      const perms = ["dashboard", "patients", "ipd", "billing", "lab", "radiology", "pharmacy", "bme", "financials"];
      if (document.getElementById("uEdit").checked) perms.push("edit");
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("uName").value,
          username: document.getElementById("uUser").value,
          password: document.getElementById("uPass").value,
          role: document.getElementById("uRole").value,
          permissions: perms,
          actor: ME.username
        })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      ["uName", "uUser", "uPass"].forEach(id => { document.getElementById(id).value = ""; });
      toast("User Created");
      syncAll();
    }

    async function updUser(userId, patch) {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ userId, actor: ME.username }, patch))
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast("User Updated");
      syncAll();
    }

    async function delUser(userId) {
      if (!confirm("Delete this user?")) return;
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, actor: ME.username })
      });
      const out = await res.json();
      if (!out.success) return toast(out.message);
      toast("User Deleted");
      syncAll();
    }

    (() => {
      const raw = sessionStorage.getItem("arhims_session");
      if (raw) {
        try { startSession(JSON.parse(raw)); } catch (_e) { sessionStorage.removeItem("arhims_session"); }
      }
    })();
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
    res.send(htmlPage);
});

loadStore()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`AR HIMS running on port ${PORT} (${APP_URL})`);
        });
    })
    .catch((err) => {
        console.error('Startup error:', err.message);
        app.listen(PORT, () => {
            console.log(`AR HIMS running on port ${PORT}`);
        });
    });
    app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});