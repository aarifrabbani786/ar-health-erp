require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const connectionString = process.env.DATABASE_URL || '';
let pool = null;

if (connectionString) {
    try {
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });
        pool.connect()
            .then(function () { console.log('Connected to PostgreSQL database successfully.'); })
            .catch(function (err) { console.error('Database connection warning:', err.message); });
    } catch (e) {
        console.error('DB Init Error:', e.message);
    }
}

let instituteInfo = {
    name: 'A.R. MEDICAL COLLEGE & HEALTHCARE',
    tagline: 'Hospital • Pharmacy • Biomedical • Inventory • ABDM M1/M2/M3 & NHCX',
    address: 'Village Badahara Rani, Maharajganj, Uttar Pradesh',
    gstin: '09AABCA1234F1Z5',
    phone: '+91 9005554424',
    placeOfSupply: 'Uttar Pradesh (09)',
    bankName: 'State Bank of India',
    branch: 'Maharajganj Branch',
    accountNo: '301234567890',
    ifsc: 'SBIN0001234',
    upiId: 'arhealthcare@upi',
    emergencyFee: 250,
    logoDataUrl: ''
};

let printConfig = {
    showBatch: true,
    showMfgExp: true,
    showHsn: true,
    showMrp: true,
    showGstBreakup: true,
    showBankUpi: true,
    showTermsSign: true
};

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function nowDisplay() {
    return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
}

let dailySequence = { date: '', count: 1 };
function getNextUHID() {
    const d = new Date();
    const todayStr = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2);
    if (dailySequence.date !== todayStr) {
        dailySequence.date = todayStr;
        dailySequence.count = 1;
    }
    return 'AR' + todayStr + '-' + String(dailySequence.count).padStart(2, '0');
}

function incrementUHID() {
    const d = new Date();
    const todayStr = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2);
    if (dailySequence.date !== todayStr) {
        dailySequence.date = todayStr;
        dailySequence.count = 1;
    } else {
        dailySequence.count += 1;
    }
}

function addAudit(user, moduleName, action) {
    erpData.auditLogs.unshift({
        time: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }),
        date: todayISO(),
        user: user || 'System',
        module: moduleName || 'HIMS',
        action: action
    });
}

function addFinanceEntry(entry) {
    erpData.financeEntries.unshift({
        voucherNo: entry.voucherNo || ('VCH-' + Date.now().toString().slice(-5)),
        date: entry.date || todayISO(),
        sourceModule: entry.sourceModule || 'Hospital',
        type: entry.type || 'Receipt',
        head: entry.head || 'General',
        mode: entry.mode || 'Cash',
        amount: Number(entry.amount || 0),
        refNo: entry.refNo || ''
    });
}

function addStockLedgerEntry(entry) {
    erpData.stockLedger.unshift({
        ledgerId: 'LDG-' + Date.now().toString().slice(-5),
        date: entry.date || todayISO(),
        module: entry.module || 'Inventory',
        itemCode: entry.itemCode || '-',
        itemName: entry.itemName || '-',
        batch: entry.batch || '-',
        txnType: entry.txnType || 'IN',
        qtyChange: Number(entry.qtyChange || 0),
        balanceAfter: Number(entry.balanceAfter || 0),
        refDoc: entry.refDoc || '-'
    });
}

function buildBillObject(b) {
    const cleanItems = (b.items && b.items.length ? b.items : [
        { name: 'OPD Consultation Fee', batch: 'OPD', mfg: '-', exp: '-', hsn: '999311', qty: 1, unit: 'SVC', mrp: 500, rate: 500, discPct: 0, gstPct: 0 }
    ]).map(function (it) {
        const qty = Math.max(1, Number(it.qty || 1));
        const rate = Number(it.rate || 0);
        const mrp = Number(it.mrp !== undefined && it.mrp !== '' ? it.mrp : rate);
        const discPct = Number(it.discPct || 0);
        const gstPct = Number(it.gstPct || 0);
        const gross = qty * rate;
        const discAmt = (gross * discPct) / 100;
        const taxable = Math.max(0, gross - discAmt);
        const gstAmt = (taxable * gstPct) / 100;
        const lineTotal = taxable + gstAmt;
        return {
            name: it.name || 'Service / Item',
            batch: it.batch || '-',
            mfg: it.mfg || '-',
            exp: it.exp || '-',
            hsn: it.hsn || '-',
            qty: qty,
            unit: it.unit || 'PCS',
            mrp: Number(mrp.toFixed(2)),
            rate: Number(rate.toFixed(2)),
            discPct: Number(discPct.toFixed(2)),
            discAmt: Number(discAmt.toFixed(2)),
            taxable: Number(taxable.toFixed(2)),
            gstPct: Number(gstPct.toFixed(2)),
            gstAmt: Number(gstAmt.toFixed(2)),
            lineTotal: Number(lineTotal.toFixed(2))
        };
    });

    const totalGross = cleanItems.reduce(function (s, x) { return s + (x.qty * x.rate); }, 0);
    const totalDisc = cleanItems.reduce(function (s, x) { return s + x.discAmt; }, 0);
    const totalTaxable = cleanItems.reduce(function (s, x) { return s + x.taxable; }, 0);
    const totalGst = cleanItems.reduce(function (s, x) { return s + x.gstAmt; }, 0);
    const netFee = Number((totalTaxable + totalGst).toFixed(2));

    return {
        billNo: b.billNo,
        billType: b.billType || 'Hospital',
        patientType: b.patientType || 'Normal',
        date: b.date || todayISO(),
        dateTime: b.dateTime || nowDisplay(),
        uhid: b.uhid || '-',
        patientName: b.patientName || 'Walk-in Customer',
        contact: b.contact || '',
        address: b.address || '',
        gstin: b.gstin || '',
        placeOfSupply: b.placeOfSupply || instituteInfo.placeOfSupply,
        doctor: b.doctor || '',
        payType: b.payType || 'Cash',
        createdBy: b.createdBy || 'Staff',
        edited: Boolean(b.edited),
        items: cleanItems,
        totalGross: Number(totalGross.toFixed(2)),
        totalDisc: Number(totalDisc.toFixed(2)),
        totalTaxable: Number(totalTaxable.toFixed(2)),
        totalGst: Number(totalGst.toFixed(2)),
        netFee: netFee
    };
}

let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active', isProtected: true },
        { id: 'USR-102', name: 'Admin User', username: 'admin', password: '123', role: 'Admin', permissions: ['all'], status: 'Active', isProtected: false },
        { id: 'USR-103', name: 'Staff Reception', username: 'staff', password: '123', role: 'Cashier / Receptionist', permissions: ['patients', 'patient-search', 'opd', 'hospital-billing', 'abdm-hims'], status: 'Active', isProtected: false },
        { id: 'USR-104', name: 'Demo User', username: 'demo', password: '1234', role: 'Demo Viewer', permissions: ['dashboard', 'reports'], status: 'Active', isProtected: false, isDemo: true }
    ],
    patients: [
        {
            uhid: 'AR231126-01',
            title: 'Mr.',
            name: 'Aarif Rabbani',
            patientType: 'Normal',
            relation: 'S/O',
            guardian: 'Md Rabbani',
            age: 27,
            gender: 'Male',
            contact: '9876543210',
            adhaar: '123456789012',
            abha: 'aarif@abdm',
            abhaNo: '12-3456-7890-1234',
            address: 'Maharajganj, UP',
            doctor: 'Dr. A. Khan (General Physician)',
            fee: 500,
            emergencyCharge: 0,
            discount: 50,
            netFee: 450,
            payType: 'Cash',
            date: todayISO(),
            dateTime: nowDisplay(),
            workflowStatus: 'Registered & Visited'
        }
    ],
    doctors: [
        { id: 'DOC1', name: 'Dr. A. Khan (General Physician)', fee: 500, department: 'General Medicine' },
        { id: 'DOC2', name: 'Dr. Priya Singh (Gynecologist)', fee: 700, department: 'Gynecology' },
        { id: 'DOC3', name: 'Dr. R. K. Verma (Orthopedics)', fee: 600, department: 'Orthopedics' }
    ],
    bills: [
        buildBillObject({
            billNo: 'HSP-231126-01',
            billType: 'Hospital',
            patientType: 'Normal',
            date: todayISO(),
            dateTime: nowDisplay(),
            uhid: 'AR231126-01',
            patientName: 'Mr. Aarif Rabbani',
            contact: '9876543210',
            address: 'Maharajganj, UP',
            doctor: 'Dr. A. Khan (General Physician)',
            payType: 'Cash',
            createdBy: 'Aarif (Super Admin)',
            items: [
                { name: 'OPD Consultation - Dr. A. Khan', batch: 'OPD01', mfg: '-', exp: '-', hsn: '999311', qty: 1, unit: 'VISIT', mrp: 500, rate: 500, discPct: 10, gstPct: 0 }
            ]
        }),
        buildBillObject({
            billNo: 'PHM-231126-01',
            billType: 'Pharmacy',
            date: todayISO(),
            dateTime: nowDisplay(),
            uhid: 'AR231126-01',
            patientName: 'Mr. Aarif Rabbani',
            contact: '9876543210',
            address: 'Maharajganj, UP',
            doctor: 'Dr. A. Khan (General Physician)',
            payType: 'Cash',
            createdBy: 'Aarif (Super Admin)',
            items: [
                { name: 'Paracetamol 500 mg Tab', batch: 'A1', mfg: 'Dec 2024', exp: 'Dec 2026', hsn: '30045031', qty: 10, unit: 'TBS', mrp: 50, rate: 40, discPct: 10, gstPct: 12 },
                { name: 'Cough Syrup (200ml)', batch: '30045031', mfg: 'Jul 2023', exp: 'Dec 2025', hsn: '30045031', qty: 20, unit: 'BTL', mrp: 90, rate: 80, discPct: 10, gstPct: 12 }
            ]
        })
    ],
    opdAppointments: [
        { appId: 'APT-101', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', patientType: 'Normal', doctor: 'Dr. A. Khan (General Physician)', tokenNo: 1, slot: 'Morning Session (10 AM - 1 PM)', status: 'Booked' }
    ],
    ipdAdmissions: [
        { ipdNo: 'IPD-01', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', patientType: 'Normal', ward: 'General Ward - Bed 01', doctor: 'Dr. A. Khan (General Physician)', admitDate: todayISO(), status: 'Admitted' }
    ],
    wards: [
        { wardCode: 'WRD-01', wardName: 'General Ward', totalBeds: 10, occupiedBeds: 1, dailyCharge: 500 },
        { wardCode: 'WRD-02', wardName: 'Private Room', totalBeds: 5, occupiedBeds: 0, dailyCharge: 1500 },
        { wardCode: 'WRD-03', wardName: 'ICU', totalBeds: 5, occupiedBeds: 1, dailyCharge: 3000 }
    ],
    laboratory: [
        { testId: 'LAB-101', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', testName: 'Complete Blood Count (CBC)', status: 'Completed', result: 'Hb: 13.5 g/dL, WBC: 7200 /µL, Platelets: 2.5L' }
    ],
    radiology: [
        { radId: 'RAD-101', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', modality: 'Digital X-Ray Chest PA', status: 'Reported', finding: 'Lung fields clear, CP angles sharp' }
    ],
    pharmacyStock: [
        { itemCode: 'MED-501', itemName: 'Paracetamol 500 mg Tab', manufacturer: 'Apex Pharma', batch: 'A1', mfgDate: 'Dec 2024', expDate: 'Dec 2026', hsn: '30045031', qty: 450, physicalQty: 450, unit: 'TBS', mrp: 50, rate: 40, gstPct: 12, reorderLevel: 50 },
        { itemCode: 'MED-502', itemName: 'Cough Syrup (200ml)', manufacturer: 'MediCare Labs', batch: '30045031', mfgDate: 'Jul 2023', expDate: 'Dec 2025', hsn: '30045031', qty: 180, physicalQty: 180, unit: 'BTL', mrp: 90, rate: 80, gstPct: 12, reorderLevel: 30 },
        { itemCode: 'MED-503', itemName: 'Antibiotic Cream (30g)', manufacturer: 'DermaCare', batch: 'C23456', mfgDate: 'Jan 2022', expDate: 'Dec 2024', hsn: '30042019', qty: 18, physicalQty: 18, unit: 'PKG', mrp: 55, rate: 45, gstPct: 12, reorderLevel: 25 }
    ],
    pharmacyPurchases: [
        {
            purId: 'PUR-201',
            date: todayISO(),
            vendor: 'MediCare Wholesale Pharmacy',
            invoiceNo: 'WH-8891',
            payType: 'Credit / Udhar',
            paymentStatus: 'Credit Due',
            chequeNo: '',
            paidDate: '',
            itemsCount: 1,
            itemsSummary: 'Paracetamol 500 mg Tab (Batch A1 x 500)',
            items: [
                { itemName: 'Paracetamol 500 mg Tab', batch: 'A1', mfgExp: 'Dec 2024 / Dec 2026', hsn: '30045031', qty: 500, mrp: 50, rate: 32, gstPct: 12, totalAmount: 17920 }
            ],
            totalAmount: 17920
        }
    ],
    pharmacyReturns: [
        { retId: 'RET-301', date: todayISO(), refBillNo: 'PHM-231126-01', itemName: 'Paracetamol 500 mg Tab', batch: 'A1', qty: 2, refundAmount: 89.60, reason: 'Excess strip returned' }
    ],
    pharmacyAudits: [
        { auditId: 'AUD-101', date: todayISO(), itemCode: 'MED-501', itemName: 'Paracetamol 500 mg Tab', batch: 'A1', systemQty: 450, physicalQty: 450, diffQty: 0, status: 'Matched', valueDiff: 0 }
    ],
    abdmRecords: [
        { abdmId: 'ABDM-M1-01', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', abhaAddress: 'aarif@abdm', abhaNumber: '12-3456-7890-1234', m1Status: 'ABHA Verified (M1)', m2CareContext: 'OPD-01 & Lab-101 Linked (M2)', m3ClaimId: 'CLM-NHCX-01', nhcxStatus: 'Pre-Auth Approved (M3)' }
    ],
    nhcxClaims: [
        { claimId: 'CLM-NHCX-01', date: todayISO(), uhid: 'AR231126-01', patientName: 'Mr. Aarif Rabbani', payer: 'National Health Claims Exchange (NHCX)', claimType: 'Cashless Pre-Auth', amount: 450, status: 'Approved', updatedAt: todayISO() }
    ],
    inventoryItems: [
        { itemCode: 'INV-201', name: 'Nitrile Examination Gloves', category: 'Consumables', warehouse: 'Central Store', stock: 120, unit: 'Box', rate: 250, reorderLevel: 30 },
        { itemCode: 'INV-202', name: 'Sterile IV Cannula 20G', category: 'Surgical', warehouse: 'OT Store', stock: 15, unit: 'Pack', rate: 600, reorderLevel: 25 }
    ],
    warehouses: [
        { whCode: 'WH-01', name: 'Central Store', location: 'Ground Floor Main Block', capacity: '5000 Sq.Ft', manager: 'Store Incharge' },
        { whCode: 'WH-02', name: 'OT Store', location: 'Operation Theatre Wing', capacity: '1200 Sq.Ft', manager: 'OT Storekeeper' }
    ],
    grnEntries: [
        { grnId: 'GRN-401', date: todayISO(), vendor: 'Apex Surgical Traders', warehouse: 'Central Store', itemName: 'Nitrile Examination Gloves', qty: 120, rate: 250, totalAmount: 30000 }
    ],
    purchaseOrders: [
        { poId: 'PO-501', date: todayISO(), department: 'Central Store', vendor: 'Apex Surgical Traders', itemName: 'Sterile IV Cannula 20G', qty: 50, amount: 30000, status: 'Approved' }
    ],
    biomedicalAssets: [
        { assetId: 'BIO-301', equipment: 'Multipara Patient Monitor', department: 'ICU', serialNo: 'MPM-9921', makeModel: 'Philips IntelliVue', amcStatus: 'Active AMC', pmDate: '2026-12-15', status: 'Operational' },
        { assetId: 'BIO-302', equipment: 'ECG 12-Channel Machine', department: 'OPD', serialNo: 'ECG-4410', makeModel: 'BPL Cardiart', amcStatus: 'CMC Active', pmDate: '2026-11-30', status: 'Under Calibration' }
    ],
    biomedWorkOrders: [
        { woId: 'WO-601', date: todayISO(), assetId: 'BIO-302', equipment: 'ECG 12-Channel Machine', department: 'OPD', issue: 'Lead cable calibration check', assignedTo: 'BME Engineer', status: 'In Progress' }
    ],
    biomedPmAmc: [
        { contractId: 'AMC-701', assetId: 'BIO-301', equipment: 'Multipara Patient Monitor', type: 'Comprehensive AMC', vendor: 'MedTech Services', validTill: '2027-06-30', nextPm: '2026-12-15', cost: 45000 }
    ],
    financeEntries: [
        { voucherNo: 'VCH-801', date: todayISO(), sourceModule: 'Hospital', type: 'Receipt', head: 'OPD Consultation', mode: 'Cash', amount: 450, refNo: 'HSP-231126-01' },
        { voucherNo: 'VCH-802', date: todayISO(), sourceModule: 'Pharmacy', type: 'Receipt', head: 'Pharmacy Counter Sale', mode: 'Cash', amount: 2688, refNo: 'PHM-231126-01' },
        { voucherNo: 'VCH-803', date: todayISO(), sourceModule: 'Pharmacy', type: 'Credit / Purchase', head: 'Wholesale Medicine Purchase (Credit)', mode: 'Credit / Udhar', amount: 17920, refNo: 'PUR-201' },
        { voucherNo: 'VCH-804', date: todayISO(), sourceModule: 'Inventory', type: 'Expense / Purchase', head: 'Central Store GRN', mode: 'Cheque', amount: 30000, refNo: 'GRN-401' },
        { voucherNo: 'VCH-805', date: todayISO(), sourceModule: 'BME', type: 'Expense', head: 'Biomedical AMC / PM', mode: 'Cheque', amount: 45000, refNo: 'AMC-701' }
    ],
    payrollRecords: [
        { payId: 'SAL-901', month: 'Nov 2026', date: todayISO(), empName: 'Dr. A. Khan', role: 'Senior Physician', department: 'Hospital', basic: 85000, allowance: 15000, netPay: 100000, status: 'Processed' },
        { payId: 'SAL-902', month: 'Nov 2026', date: todayISO(), empName: 'Ramesh Kumar', role: 'Chief Pharmacist', department: 'Pharmacy', basic: 28000, allowance: 4000, netPay: 32000, status: 'Processed' }
    ],
    auditLogs: [
        { time: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }), date: todayISO(), user: 'Aarif Rabbani', module: 'HIMS', action: 'Initialized Modular HIMS, Pharmacy, BME, Inventory, Reports & ABDM M1/M2/M3 + NHCX' }
    ]
};

app.post('/api/login', function (req, res) {
    try {
        const cleanUser = (req.body.username || '').trim().toLowerCase();
        const password = req.body.password;
        const user = erpData.users.find(function (u) { return u.username.toLowerCase() === cleanUser && u.password === password; });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid User ID or Password. (Super Admin: Aarif / 7860)' });
        if (user.status === 'Deactivated') return res.status(403).json({ success: false, message: 'Account is deactivated by Admin.' });
        addAudit(user.name, 'Auth', 'User logged in (' + user.role + ')');
        res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status, isProtected: user.isProtected, isDemo: user.isDemo } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/institute', function (req, res) {
    res.json({ success: true, institute: instituteInfo, printConfig: printConfig });
});

app.post('/api/institute', function (req, res) {
    const body = req.body || {};
    ['name', 'tagline', 'address', 'gstin', 'phone', 'placeOfSupply', 'bankName', 'branch', 'accountNo', 'ifsc', 'upiId', 'emergencyFee', 'logoDataUrl'].forEach(function (k) {
        if (body[k] !== undefined) instituteInfo[k] = body[k];
    });
    if (body.emergencyFee !== undefined) instituteInfo.emergencyFee = Number(body.emergencyFee || 0);
    addAudit('Admin', 'Settings', 'Updated Institute, Logo, Emergency Fee & Invoice Settings');
    res.json({ success: true, message: 'Institute & Invoice details updated successfully!', institute: instituteInfo });
});

app.get('/api/backup/export', function (req, res) {
    addAudit('Admin', 'Backup', 'Exported full ERP backup snapshot');
    res.json({
        success: true,
        exportedAt: nowDisplay(),
        institute: instituteInfo,
        erpData: erpData
    });
});

app.get('/api/users', function (req, res) { res.json(erpData.users); });
app.get('/api/doctors', function (req, res) { res.json(erpData.doctors); });
app.get('/api/pharmacy/stock', function (req, res) { res.json(erpData.pharmacyStock); });
app.get('/api/pharmacy/purchases', function (req, res) { res.json(erpData.pharmacyPurchases); });
app.get('/api/bills', function (req, res) { res.json(erpData.bills); });
app.get('/api/next-uhid', function (req, res) { res.json({ uhid: getNextUHID() }); });

app.post('/api/users/create', function (req, res) {
    try {
        const body = req.body || {};
        if (erpData.users.some(function (u) { return u.username.toLowerCase() === (body.username || '').trim().toLowerCase(); })) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }
        const newUser = {
            id: 'USR-' + Date.now().toString().slice(-4),
            name: body.name,
            username: (body.username || '').trim(),
            password: body.password,
            role: body.role,
            permissions: Array.isArray(body.permissions) && body.permissions.length ? body.permissions : ['dashboard'],
            status: 'Active',
            isProtected: false
        };
        erpData.users.push(newUser);
        addAudit('Admin', 'Users', 'Created user ' + newUser.name + ' (' + newUser.role + ') with permissions: ' + newUser.permissions.join(', '));
        res.json({ success: true, message: 'User created successfully', users: erpData.users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users/update', function (req, res) {
    try {
        const body = req.body || {};
        const user = erpData.users.find(function (u) { return u.id === body.userId; });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (body.name) user.name = body.name;
        if (body.username) user.username = body.username.trim();
        if (body.password) user.password = body.password;
        if (body.role) user.role = body.role;
        if (!user.isProtected && Array.isArray(body.permissions)) {
            user.permissions = body.permissions.length ? body.permissions : ['dashboard'];
        }
        addAudit('Admin', 'Users', 'Updated user ' + user.name + ' (' + user.role + ')');
        res.json({ success: true, message: 'User & permissions updated successfully!', users: erpData.users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users/status', function (req, res) {
    const user = erpData.users.find(function (u) { return u.id === req.body.userId; });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.isProtected) return res.status(403).json({ success: false, message: 'Super Admin account cannot be deactivated!' });
    user.status = req.body.status;
    addAudit('Admin', 'Users', 'Set status ' + user.status + ' for ' + user.name);
    res.json({ success: true, users: erpData.users });
});

app.post('/api/users/change-password', function (req, res) {
    const user = erpData.users.find(function (u) { return u.username.toLowerCase() === (req.body.username || '').trim().toLowerCase(); });
    if (!user || user.password !== req.body.oldPassword) {
        return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }
    user.password = req.body.newPassword;
    addAudit(user.username, 'Security', 'Changed account password');
    res.json({ success: true, message: 'Password updated successfully!' });
});

app.post('/api/doctors/add', function (req, res) {
    const newDoc = {
        id: 'DOC' + Date.now().toString().slice(-4),
        name: req.body.name,
        fee: Number(req.body.fee || 0),
        department: req.body.department || 'General'
    };
    erpData.doctors.push(newDoc);
    addAudit('Admin', 'Hospital', 'Added doctor ' + newDoc.name);
    res.json({ success: true, message: 'Doctor added successfully', doctors: erpData.doctors });
});

app.post('/api/patients/register', function (req, res) {
    try {
        const p = req.body;
        if (!/^\d{10}$/.test(p.contact || '')) {
            return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });
        }
        const uhid = p.existingUhid || getNextUHID();
        incrementUHID();

        const patientType = p.patientType || 'Normal';
        const fee = Number(p.fee || 0);
        const emergencyCharge = patientType === 'Emergency' ? Number(p.emergencyCharge !== undefined ? p.emergencyCharge : instituteInfo.emergencyFee) : 0;
        const discount = Number(p.discount || 0);
        const netFee = Math.max(0, fee + emergencyCharge - discount);
        const dStr = todayISO();
        const tStr = nowDisplay();

        const newPatient = {
            uhid: uhid,
            title: p.title || 'Mr.',
            name: p.name,
            patientType: patientType,
            relation: p.relation || 'C/O',
            guardian: p.guardian || '',
            age: Number(p.age || 0),
            gender: p.gender || 'Male',
            contact: p.contact,
            adhaar: p.adhaar || '',
            abha: p.abha || '',
            abhaNo: p.abhaNo || '',
            address: p.address || '',
            doctor: p.doctor,
            fee: fee,
            emergencyCharge: emergencyCharge,
            discount: discount,
            netFee: netFee,
            payType: p.payType || 'Cash',
            date: dStr,
            dateTime: tStr,
            workflowStatus: patientType === 'Emergency' ? 'Emergency Priority' : 'Registered & Visited'
        };
        erpData.patients.unshift(newPatient);

        const billItems = [
            {
                name: 'OPD Consultation (' + patientType + ') - ' + (p.doctor || 'General'),
                batch: patientType === 'Emergency' ? 'EMG' : 'OPD',
                mfg: '-',
                exp: '-',
                hsn: '999311',
                qty: 1,
                unit: 'VISIT',
                mrp: fee,
                rate: fee,
                discPct: 0,
                gstPct: 0
            }
        ];
        if (emergencyCharge > 0) {
            billItems.push({
                name: 'Emergency Care & Casualty Charge',
                batch: 'EMG-CHG',
                mfg: '-',
                exp: '-',
                hsn: '999311',
                qty: 1,
                unit: 'SVC',
                mrp: emergencyCharge,
                rate: emergencyCharge,
                discPct: 0,
                gstPct: 0
            });
        }

        const billNo = 'HSP-' + Date.now().toString().slice(-6);
        const newBill = buildBillObject({
            billNo: billNo,
            billType: 'Hospital',
            patientType: patientType,
            date: dStr,
            dateTime: tStr,
            uhid: uhid,
            patientName: (p.title || '') + ' ' + p.name,
            contact: p.contact,
            address: p.address || '',
            doctor: p.doctor,
            payType: p.payType || 'Cash',
            createdBy: p.createdBy || 'Staff',
            items: billItems
        });
        if (discount > 0) {
            newBill.totalDisc = Number(discount.toFixed(2));
            newBill.netFee = Number(Math.max(0, newBill.totalGross - discount).toFixed(2));
        }
        erpData.bills.unshift(newBill);

        addFinanceEntry({
            date: dStr,
            sourceModule: 'Hospital',
            type: (p.payType || '').includes('Credit') ? 'Credit' : 'Receipt',
            head: patientType + ' OPD / Registration',
            mode: p.payType || 'Cash',
            amount: newBill.netFee,
            refNo: billNo
        });

        addAudit(p.createdBy || 'Staff', 'Hospital', 'Registered ' + patientType + ' patient ' + p.name + ' (' + uhid + ') | Bill ' + billNo + ' | ₹' + newBill.netFee);
        res.json({ success: true, message: patientType + ' Patient Registered & Hospital Bill Generated', patient: newPatient, bill: newBill });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/opd/book', function (req, res) {
    const pType = req.body.patientType || 'Normal';
    const apt = {
        appId: 'APT-' + Date.now().toString().slice(-4),
        date: todayISO(),
        uhid: req.body.uhid,
        patientName: req.body.patientName || req.body.uhid,
        patientType: pType,
        doctor: req.body.doctor,
        tokenNo: erpData.opdAppointments.length + 1,
        slot: pType === 'Emergency' ? 'Immediate Emergency Slot' : (req.body.slot || 'Morning Session (10 AM - 1 PM)'),
        status: pType === 'Emergency' ? 'Emergency Priority' : 'Booked'
    };
    erpData.opdAppointments.unshift(apt);
    addAudit('Staff', 'OPD', 'Booked ' + pType + ' token #' + apt.tokenNo + ' for ' + apt.patientName);
    res.json({ success: true, message: pType + ' OPD Token #' + apt.tokenNo + ' Booked', appointment: apt });
});

app.post('/api/ipd/admit', function (req, res) {
    const pType = req.body.patientType || 'Normal';
    const admit = {
        ipdNo: 'IPD-' + Date.now().toString().slice(-4),
        date: todayISO(),
        uhid: req.body.uhid,
        patientName: req.body.patientName,
        patientType: pType,
        ward: req.body.ward,
        doctor: req.body.doctor,
        admitDate: todayISO(),
        status: pType === 'Emergency' ? 'Admitted (Emergency)' : 'Admitted'
    };
    erpData.ipdAdmissions.unshift(admit);
    const wardNameOnly = (req.body.ward || '').split(' - ')[0];
    const w = erpData.wards.find(function (x) { return x.wardName === wardNameOnly; });
    if (w) w.occupiedBeds = Math.min(w.totalBeds, Number(w.occupiedBeds || 0) + 1);
    addAudit('Staff', 'IPD', 'Admitted ' + pType + ' patient ' + admit.patientName + ' to ' + admit.ward);
    res.json({ success: true, message: pType + ' Patient Admitted (' + admit.ipdNo + ')', admission: admit });
});

app.post('/api/wards/add', function (req, res) {
    const newWard = {
        wardCode: 'WRD-' + Date.now().toString().slice(-3),
        wardName: req.body.wardName,
        totalBeds: Number(req.body.totalBeds || 1),
        occupiedBeds: 0,
        dailyCharge: Number(req.body.dailyCharge || 0)
    };
    erpData.wards.push(newWard);
    addAudit('Admin', 'Hospital', 'Added ward ' + newWard.wardName + ' (' + newWard.totalBeds + ' beds)');
    res.json({ success: true, message: 'Ward added successfully', wards: erpData.wards });
});

app.post('/api/lab/add', function (req, res) {
    const entry = {
        testId: 'LAB-' + Date.now().toString().slice(-4),
        date: todayISO(),
        uhid: req.body.uhid,
        patientName: req.body.patientName,
        testName: req.body.testName,
        status: req.body.status || 'Completed',
        result: req.body.result || 'Pending'
    };
    erpData.laboratory.unshift(entry);
    addAudit('Lab Staff', 'Laboratory', 'Saved lab report ' + entry.testId + ' for ' + entry.patientName);
    res.json({ success: true, message: 'Laboratory report saved', entry: entry });
});

app.post('/api/radiology/add', function (req, res) {
    const entry = {
        radId: 'RAD-' + Date.now().toString().slice(-4),
        date: todayISO(),
        uhid: req.body.uhid,
        patientName: req.body.patientName,
        modality: req.body.modality,
        status: req.body.status || 'Reported',
        finding: req.body.finding || 'Normal study'
    };
    erpData.radiology.unshift(entry);
    addAudit('Radiology Staff', 'Radiology', 'Saved radiology report ' + entry.radId);
    res.json({ success: true, message: 'Radiology report saved', entry: entry });
});

app.post('/api/pharmacy/medicine/add', function (req, res) {
    const b = req.body;
    const qty = Number(b.qty || 0);
    const med = {
        itemCode: 'MED-' + Date.now().toString().slice(-4),
        itemName: b.itemName,
        manufacturer: b.manufacturer || 'Generic Pharma',
        batch: b.batch || 'B01',
        mfgDate: b.mfgDate || '-',
        expDate: b.expDate || '-',
        hsn: b.hsn || '30049099',
        qty: qty,
        physicalQty: qty,
        unit: b.unit || 'TBS',
        mrp: Number(b.mrp || b.rate || 0),
        rate: Number(b.rate || 0),
        gstPct: Number(b.gstPct || 12),
        reorderLevel: Number(b.reorderLevel || 20)
    };
    erpData.pharmacyStock.unshift(med);
    addStockLedgerEntry({ module: 'Pharmacy', itemCode: med.itemCode, itemName: med.itemName, batch: med.batch, txnType: 'OPENING / ADD', qtyChange: qty, balanceAfter: qty, refDoc: med.itemCode });
    addAudit('Pharmacist', 'Pharmacy', 'Added medicine ' + med.itemName + ' (Batch ' + med.batch + ', Qty ' + qty + ')');
    res.json({ success: true, message: 'Medicine added to stock', med: med });
});

// Multi-Item Purchase Invoice Creation
app.post('/api/pharmacy/purchase/invoice', function (req, res) {
    try {
        const b = req.body || {};
        const items = Array.isArray(b.items) ? b.items : [];
        if (!items.length) return res.status(400).json({ success: false, message: 'Add at least 1 medicine item to the purchase invoice.' });

        const purId = 'PUR-' + Date.now().toString().slice(-5);
        const invoiceNo = (b.invoiceNo || ('INV-' + Date.now().toString().slice(-4))).trim();
        const vendor = (b.vendor || 'Wholesale Distributor').trim();
        const payType = b.payType || 'Cash';
        const chequeNo = b.chequeNo || '';
        const isCredit = payType.toLowerCase().includes('credit');

        let invoiceTotal = 0;
        const processedItems = items.map(function (it) {
            const qty = Math.max(1, Number(it.qty || 1));
            const rate = Number(it.rate || 0);
            const mrp = Number(it.mrp !== undefined && it.mrp !== '' ? it.mrp : rate);
            const gstPct = Number(it.gstPct || 12);
            const lineTotal = Number((qty * rate * (1 + gstPct / 100)).toFixed(2));
            invoiceTotal += lineTotal;

            const mfgExpStr = it.mfgExp || '';
            const mfgDate = it.mfgDate || (mfgExpStr.includes('/') ? mfgExpStr.split('/')[0].trim() : '-');
            const expDate = it.expDate || (mfgExpStr.includes('/') ? mfgExpStr.split('/')[1].trim() : '-');

            let stockItem = erpData.pharmacyStock.find(function (m) {
                return m.itemName.toLowerCase() === (it.itemName || '').toLowerCase() && m.batch.toLowerCase() === (it.batch || 'B01').toLowerCase();
            });

            if (stockItem) {
                stockItem.qty = Number(stockItem.qty || 0) + qty;
                stockItem.physicalQty = stockItem.qty;
                stockItem.rate = rate;
                if (mrp) stockItem.mrp = mrp;
                if (mfgDate !== '-') stockItem.mfgDate = mfgDate;
                if (expDate !== '-') stockItem.expDate = expDate;
            } else {
                stockItem = {
                    itemCode: 'MED-' + Date.now().toString().slice(-4) + '-' + Math.floor(Math.random() * 90 + 10),
                    itemName: it.itemName,
                    manufacturer: vendor,
                    batch: it.batch || 'B01',
                    mfgDate: mfgDate,
                    expDate: expDate,
                    hsn: it.hsn || '30045031',
                    qty: qty,
                    physicalQty: qty,
                    unit: it.unit || 'TBS',
                    mrp: mrp,
                    rate: rate,
                    gstPct: gstPct,
                    reorderLevel: 20
                };
                erpData.pharmacyStock.unshift(stockItem);
            }

            addStockLedgerEntry({
                module: 'Pharmacy',
                itemCode: stockItem.itemCode,
                itemName: stockItem.itemName,
                batch: stockItem.batch,
                txnType: 'PURCHASE IN',
                qtyChange: qty,
                balanceAfter: stockItem.qty,
                refDoc: invoiceNo
            });

            return {
                itemName: it.itemName,
                batch: it.batch || 'B01',
                mfgExp: mfgDate + ' / ' + expDate,
                hsn: it.hsn || '30045031',
                qty: qty,
                mrp: mrp,
                rate: rate,
                gstPct: gstPct,
                totalAmount: lineTotal
            };
        });

        const purchaseRecord = {
            purId: purId,
            date: todayISO(),
            vendor: vendor,
            invoiceNo: invoiceNo,
            payType: payType,
            paymentStatus: isCredit ? 'Credit Due' : 'Paid',
            chequeNo: chequeNo,
            paidDate: isCredit ? '' : todayISO(),
            itemsCount: processedItems.length,
            itemsSummary: processedItems.map(function (x) { return x.itemName + ' (' + x.qty + ')'; }).join(', '),
            items: processedItems,
            totalAmount: Number(invoiceTotal.toFixed(2))
        };

        erpData.pharmacyPurchases.unshift(purchaseRecord);

        addFinanceEntry({
            date: todayISO(),
            sourceModule: 'Pharmacy',
            type: isCredit ? 'Credit Purchase' : 'Purchase Payment',
            head: 'Purchase Inv ' + invoiceNo + ' - ' + vendor,
            mode: chequeNo ? (payType + ' #' + chequeNo) : payType,
            amount: purchaseRecord.totalAmount,
            refNo: invoiceNo
        });

        addAudit('Pharmacist', 'Pharmacy', 'Saved Purchase Invoice ' + invoiceNo + ' (' + vendor + ') with ' + processedItems.length + ' items | ' + payType + ' | ₹' + purchaseRecord.totalAmount);
        res.json({ success: true, message: 'Purchase Invoice ' + invoiceNo + ' saved with ' + processedItems.length + ' item(s)!', purchase: purchaseRecord });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Settle / Update Credit Purchase Payment
app.post('/api/pharmacy/purchase/settle', function (req, res) {
    try {
        const b = req.body || {};
        const pur = erpData.pharmacyPurchases.find(function (p) { return p.purId === b.purId || p.invoiceNo === b.invoiceNo; });
        if (!pur) return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });

        const settleMode = b.settleMode || 'Cash';
        const chequeNo = b.chequeNo || '';
        pur.payType = settleMode;
        pur.paymentStatus = 'Paid';
        pur.chequeNo = chequeNo;
        pur.paidDate = todayISO();

        addFinanceEntry({
            date: todayISO(),
            sourceModule: 'Pharmacy',
            type: 'Credit Settlement',
            head: 'Cleared Credit Inv ' + pur.invoiceNo + ' - ' + pur.vendor,
            mode: chequeNo ? (settleMode + ' #' + chequeNo) : settleMode,
            amount: pur.totalAmount,
            refNo: pur.invoiceNo
        });

        addAudit('Pharmacist', 'Pharmacy', 'Settled credit purchase ' + pur.invoiceNo + ' (' + pur.vendor + ') via ' + settleMode + ' | ₹' + pur.totalAmount);
        res.json({ success: true, message: 'Credit payment updated to ' + settleMode + ' for Invoice ' + pur.invoiceNo, purchase: pur });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Save Pharmacy Stock Audit Record
app.post('/api/pharmacy/audit/save', function (req, res) {
    try {
        const b = req.body || {};
        const med = erpData.pharmacyStock.find(function (m) { return m.itemCode === b.itemCode; });
        if (!med) return res.status(404).json({ success: false, message: 'Medicine item not found.' });

        const systemQty = Number(med.qty || 0);
        const physicalQty = Math.max(0, Number(b.physicalQty || 0));
        const diffQty = Number((physicalQty - systemQty).toFixed(2));
        const status = diffQty > 0 ? 'Extra Stock' : (diffQty < 0 ? 'Short Stock' : 'Matched');
        const valueDiff = Number((diffQty * Number(med.rate || 0)).toFixed(2));

        med.physicalQty = physicalQty;
        if (b.syncStock) {
            med.qty = physicalQty;
            addStockLedgerEntry({
                module: 'Pharmacy',
                itemCode: med.itemCode,
                itemName: med.itemName,
                batch: med.batch,
                txnType: 'AUDIT ADJUST (' + status + ')',
                qtyChange: diffQty,
                balanceAfter: physicalQty,
                refDoc: 'AUDIT'
            });
        }

        const auditRec = {
            auditId: 'AUD-' + Date.now().toString().slice(-4),
            date: todayISO(),
            itemCode: med.itemCode,
            itemName: med.itemName,
            batch: med.batch,
            systemQty: systemQty,
            physicalQty: physicalQty,
            diffQty: diffQty,
            status: status,
            rate: Number(med.rate || 0),
            valueDiff: valueDiff
        };
        erpData.pharmacyAudits.unshift(auditRec);
        addAudit('Pharmacist', 'Pharmacy Audit', 'Audited ' + med.itemName + ' (' + med.batch + '): Sys ' + systemQty + ', Phy ' + physicalQty + ' [' + status + ']');
        res.json({ success: true, message: 'Audit saved (' + status + ': ' + diffQty + ')', audit: auditRec });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/pharmacy/sale/create', function (req, res) {
    try {
        const b = req.body;
        const items = Array.isArray(b.items) ? b.items : [];
        if (!items.length) return res.status(400).json({ success: false, message: 'Please add at least one medicine in sale bill.' });

        const enrichedItems = items.map(function (it) {
            const stockMatch = erpData.pharmacyStock.find(function (m) {
                return m.itemCode === it.itemCode || (m.itemName.toLowerCase() === (it.name || '').toLowerCase() && (!it.batch || m.batch.toLowerCase() === (it.batch || '').toLowerCase()));
            });
            const qty = Math.max(1, Number(it.qty || 1));
            if (stockMatch) {
                stockMatch.qty = Math.max(0, Number(stockMatch.qty || 0) - qty);
                stockMatch.physicalQty = stockMatch.qty;
                addStockLedgerEntry({
                    module: 'Pharmacy',
                    itemCode: stockMatch.itemCode,
                    itemName: stockMatch.itemName,
                    batch: stockMatch.batch,
                    txnType: 'SALE OUT',
                    qtyChange: -qty,
                    balanceAfter: stockMatch.qty,
                    refDoc: 'PHM-SALE'
                });
            }
            return {
                name: it.name || (stockMatch ? stockMatch.itemName : 'Medicine'),
                batch: it.batch || (stockMatch ? stockMatch.batch : 'B01'),
                mfg: it.mfg || (stockMatch ? stockMatch.mfgDate : '-'),
                exp: it.exp || (stockMatch ? stockMatch.expDate : '-'),
                hsn: it.hsn || (stockMatch ? stockMatch.hsn : '30049099'),
                qty: qty,
                unit: it.unit || (stockMatch ? stockMatch.unit : 'TBS'),
                mrp: Number(it.mrp !== undefined ? it.mrp : (stockMatch ? stockMatch.mrp : it.rate)),
                rate: Number(it.rate !== undefined ? it.rate : (stockMatch ? stockMatch.rate : 0)),
                discPct: Number(it.discPct || 0),
                gstPct: Number(it.gstPct !== undefined ? it.gstPct : (stockMatch ? stockMatch.gstPct : 12))
            };
        });

        const billNo = 'PHM-' + Date.now().toString().slice(-6);
        const bill = buildBillObject({
            billNo: billNo,
            billType: 'Pharmacy',
            date: todayISO(),
            dateTime: nowDisplay(),
            uhid: b.uhid || 'WALK-IN',
            patientName: b.patientName || 'Counter Customer',
            contact: b.contact || '',
            address: b.address || '',
            gstin: b.gstin || '',
            placeOfSupply: b.placeOfSupply || instituteInfo.placeOfSupply,
            doctor: b.doctor || '',
            payType: b.payType || 'Cash',
            createdBy: b.createdBy || 'Pharmacist',
            items: enrichedItems
        });
        erpData.bills.unshift(bill);

        addFinanceEntry({
            date: todayISO(),
            sourceModule: 'Pharmacy',
            type: (b.payType || '').includes('Credit') ? 'Credit' : 'Receipt',
            head: 'Pharmacy Sale',
            mode: b.payType || 'Cash',
            amount: bill.netFee,
            refNo: billNo
        });
        addAudit(b.createdBy || 'Pharmacist', 'Pharmacy', 'Created Pharmacy Sale Bill ' + billNo + ' for ' + bill.patientName + ' (₹' + bill.netFee + ')');
        res.json({ success: true, message: 'Pharmacy Sale Bill created (' + billNo + ')', bill: bill });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/pharmacy/return/create', function (req, res) {
    const b = req.body;
    const qty = Math.max(1, Number(b.qty || 1));
    const refundAmount = Number(b.refundAmount || 0);
    const retId = 'RET-' + Date.now().toString().slice(-5);

    const ret = {
        retId: retId,
        date: todayISO(),
        refBillNo: b.refBillNo || '-',
        itemName: b.itemName,
        batch: b.batch || '-',
        qty: qty,
        refundAmount: refundAmount,
        reason: b.reason || 'Customer Return'
    };
    erpData.pharmacyReturns.unshift(ret);

    const stockMatch = erpData.pharmacyStock.find(function (m) {
        return m.itemName.toLowerCase() === (b.itemName || '').toLowerCase() && (!b.batch || m.batch.toLowerCase() === (b.batch || '').toLowerCase());
    });
    if (stockMatch) {
        stockMatch.qty = Number(stockMatch.qty || 0) + qty;
        stockMatch.physicalQty = stockMatch.qty;
        addStockLedgerEntry({ module: 'Pharmacy', itemCode: stockMatch.itemCode, itemName: stockMatch.itemName, batch: stockMatch.batch, txnType: 'SALE RETURN IN', qtyChange: qty, balanceAfter: stockMatch.qty, refDoc: retId });
    }

    addFinanceEntry({
        date: todayISO(),
        sourceModule: 'Pharmacy',
        type: 'Refund / Return',
        head: 'Pharmacy Sale Return',
        mode: b.payType || 'Cash',
        amount: -Math.abs(refundAmount),
        refNo: retId
    });
    addAudit('Pharmacist', 'Pharmacy', 'Processed Sale Return ' + retId + ' for ' + ret.itemName + ' (Qty ' + qty + ', ₹' + refundAmount + ')');
    res.json({ success: true, message: 'Pharmacy Sale Return recorded (' + retId + ')', returnEntry: ret });
});

app.post('/api/abdm/create-abha', function (req, res) {
    const b = req.body;
    const cleanHandle = (b.desiredAbha || (b.patientName || 'patient').toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-3)) + '@abdm';
    const abhaNumber = [0, 1, 2, 3].map(function () { return Math.floor(1000 + Math.random() * 9000); }).join('-');
    const record = {
        abdmId: 'ABDM-M1-' + Date.now().toString().slice(-4),
        date: todayISO(),
        uhid: b.uhid || getNextUHID(),
        patientName: b.patientName,
        abhaAddress: cleanHandle,
        abhaNumber: abhaNumber,
        m1Status: 'ABHA Created & Verified (M1)',
        m2CareContext: b.m2CareContext || 'OPD/IPD Health Record Linked (M2)',
        m3ClaimId: 'Pending NHCX',
        nhcxStatus: 'Ready for M3 / NHCX'
    };
    erpData.abdmRecords.unshift(record);
    const pat = erpData.patients.find(function (p) { return p.uhid === b.uhid; });
    if (pat) { pat.abha = cleanHandle; pat.abhaNo = abhaNumber; }
    addAudit('HIMS Staff', 'ABDM', 'Created ABHA ' + cleanHandle + ' (' + abhaNumber + ') for ' + record.patientName);
    res.json({ success: true, message: 'ABHA Created (M1) & M2 Context Linked', record: record });
});

app.post('/api/nhcx/claim', function (req, res) {
    const b = req.body;
    const claimId = 'CLM-NHCX-' + Date.now().toString().slice(-4);
    const claim = {
        claimId: claimId,
        date: todayISO(),
        uhid: b.uhid,
        patientName: b.patientName,
        payer: b.payer || 'National Health Claims Exchange (NHCX)',
        claimType: b.claimType || 'Cashless Pre-Auth',
        amount: Number(b.amount || 0),
        status: 'Submitted to NHCX',
        updatedAt: todayISO()
    };
    erpData.nhcxClaims.unshift(claim);
    const abdm = erpData.abdmRecords.find(function (r) { return r.uhid === b.uhid; });
    if (abdm) { abdm.m3ClaimId = claimId; abdm.nhcxStatus = 'Submitted (' + claim.claimType + ')'; }
    addAudit('TPA Desk', 'NHCX', 'Submitted NHCX ' + claim.claimType + ' ' + claimId + ' for ₹' + claim.amount);
    res.json({ success: true, message: 'NHCX Claim / Pre-Auth Submitted (' + claimId + ')', claim: claim });
});

app.post('/api/inventory/item/add', function (req, res) {
    const b = req.body;
    const qty = Number(b.stock || 0);
    const item = {
        itemCode: 'INV-' + Date.now().toString().slice(-4),
        name: b.name,
        category: b.category || 'General Store',
        warehouse: b.warehouse || 'Central Store',
        stock: qty,
        unit: b.unit || 'Unit',
        rate: Number(b.rate || 0),
        reorderLevel: Number(b.reorderLevel || 10)
    };
    erpData.inventoryItems.unshift(item);
    addStockLedgerEntry({ module: 'Inventory', itemCode: item.itemCode, itemName: item.name, batch: '-', txnType: 'STOCK IN', qtyChange: qty, balanceAfter: qty, refDoc: item.itemCode });
    addAudit('Store Staff', 'Inventory', 'Added store item ' + item.name + ' (Stock ' + qty + ')');
    res.json({ success: true, message: 'Inventory item added', item: item });
});

app.post('/api/inventory/grn/add', function (req, res) {
    const b = req.body;
    const qty = Math.max(1, Number(b.qty || 1));
    const rate = Number(b.rate || 0);
    const totalAmount = Number((qty * rate).toFixed(2));
    const grnId = 'GRN-' + Date.now().toString().slice(-5);
    const grn = {
        grnId: grnId,
        date: todayISO(),
        vendor: b.vendor || 'Store Vendor',
        warehouse: b.warehouse || 'Central Store',
        itemName: b.itemName,
        qty: qty,
        rate: rate,
        totalAmount: totalAmount
    };
    erpData.grnEntries.unshift(grn);

    const match = erpData.inventoryItems.find(function (x) { return x.name.toLowerCase() === (b.itemName || '').toLowerCase(); });
    if (match) {
        match.stock = Number(match.stock || 0) + qty;
        addStockLedgerEntry({ module: 'Inventory', itemCode: match.itemCode, itemName: match.name, batch: '-', txnType: 'GRN IN', qtyChange: qty, balanceAfter: match.stock, refDoc: grnId });
    } else {
        addStockLedgerEntry({ module: 'Inventory', itemCode: '-', itemName: b.itemName, batch: '-', txnType: 'GRN IN', qtyChange: qty, balanceAfter: qty, refDoc: grnId });
    }
    addFinanceEntry({ date: todayISO(), sourceModule: 'Inventory', type: 'Expense / Purchase', head: 'Store GRN', mode: b.payType || 'Cash', amount: totalAmount, refNo: grnId });
    addAudit('Store Staff', 'Inventory', 'Recorded GRN ' + grnId + ' for ' + grn.itemName + ' (₹' + totalAmount + ')');
    res.json({ success: true, message: 'GRN recorded & stock updated (' + grnId + ')', grn: grn });
});

app.post('/api/biomed/equipment/add', function (req, res) {
    const b = req.body;
    const asset = {
        assetId: 'BIO-' + Date.now().toString().slice(-4),
        equipment: b.equipment,
        department: b.department || 'ICU',
        serialNo: b.serialNo || ('SN-' + Date.now().toString().slice(-5)),
        makeModel: b.makeModel || 'Standard',
        amcStatus: b.amcStatus || 'Active AMC',
        pmDate: b.pmDate || todayISO(),
        status: b.status || 'Operational'
    };
    erpData.biomedicalAssets.unshift(asset);
    addAudit('BME Engineer', 'BME', 'Added biomedical equipment ' + asset.equipment + ' (' + asset.assetId + ')');
    res.json({ success: true, message: 'Biomedical equipment added', asset: asset });
});

app.post('/api/biomed/wo/add', function (req, res) {
    const b = req.body;
    const wo = {
        woId: 'WO-' + Date.now().toString().slice(-4),
        date: todayISO(),
        assetId: b.assetId || '-',
        equipment: b.equipment,
        department: b.department || 'ICU',
        issue: b.issue || 'Maintenance / Calibration',
        assignedTo: b.assignedTo || 'BME Engineer',
        status: b.status || 'Open'
    };
    erpData.biomedWorkOrders.unshift(wo);
    addAudit('BME Engineer', 'BME', 'Created work order ' + wo.woId + ' for ' + wo.equipment);
    res.json({ success: true, message: 'Biomedical work order created', workOrder: wo });
});

app.post('/api/finance/entry/add', function (req, res) {
    const b = req.body;
    const amt = Number(b.amount || 0);
    const vch = {
        voucherNo: 'VCH-' + Date.now().toString().slice(-5),
        date: b.date || todayISO(),
        sourceModule: b.sourceModule || 'Hospital',
        type: b.type || 'Receipt',
        head: b.head || 'General Account',
        mode: b.mode || 'Cash',
        amount: amt,
        refNo: b.refNo || 'MANUAL'
    };
    erpData.financeEntries.unshift(vch);
    addAudit('Accountant', 'Finance', 'Recorded ' + vch.type + ' ' + vch.voucherNo + ' (₹' + amt + ')');
    res.json({ success: true, message: 'Finance entry saved (' + vch.voucherNo + ')', entry: vch });
});

app.get('/api/patients/search', function (req, res) {
    const q = (req.query.q || '').toLowerCase();
    if (q.length < 2) return res.json([]);
    const results = erpData.patients.filter(function (p) {
        return p.name.toLowerCase().includes(q) || p.contact.includes(q) || p.uhid.toLowerCase().includes(q) || (p.adhaar && p.adhaar.includes(q)) || (p.abha && p.abha.toLowerCase().includes(q));
    });
    res.json(results);
});

app.post('/api/bills/edit', function (req, res) {
    const b = req.body;
    if (b.userRole !== 'Super Admin' && b.userRole !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Only Super Admin and Admin can directly edit bills!' });
    }
    const bill = erpData.bills.find(function (x) { return x.billNo === b.billNo; });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const updatedNet = Number(b.netFee);
    bill.netFee = updatedNet;
    bill.totalTaxable = updatedNet;
    bill.totalGross = updatedNet;
    bill.totalDisc = 0;
    bill.totalGst = 0;
    bill.payType = b.payType || bill.payType;
    bill.edited = true;
    addAudit(b.userRole, bill.billType, 'Edited bill ' + bill.billNo + ' to ₹' + updatedNet);
    res.json({ success: true, message: 'Bill updated successfully!', bill: bill });
});

app.get('/api/reports/custom', function (req, res) {
    const fromDate = req.query.from || '';
    const toDate = req.query.to || '';
    const scope = (req.query.scope || 'all').toLowerCase();

    function inRange(d) {
        if (!d) return true;
        const cleanDate = String(d).slice(0, 10);
        if (fromDate && cleanDate < fromDate) return false;
        if (toDate && cleanDate > toDate) return false;
        return true;
    }

    const hospitalBills = erpData.bills.filter(function (b) { return b.billType === 'Hospital' && inRange(b.date); });
    const pharmacyBills = erpData.bills.filter(function (b) { return b.billType === 'Pharmacy' && inRange(b.date); });
    const pharmacyPurchases = erpData.pharmacyPurchases.filter(function (p) { return inRange(p.date); });
    const pharmacyReturns = erpData.pharmacyReturns.filter(function (r) { return inRange(r.date); });
    const grnRows = erpData.grnEntries.filter(function (g) { return inRange(g.date); });
    const biomedRows = erpData.biomedWorkOrders.filter(function (w) { return inRange(w.date); });

    const rows = [];
    if (scope === 'all' || scope === 'hospital') {
        hospitalBills.forEach(function (b) {
            rows.push({ date: b.date, module: 'Hospital', docNo: b.billNo, party: b.patientName, category: (b.patientType || 'Normal') + ' Bill', mode: b.payType, amount: b.netFee });
        });
    }
    if (scope === 'all' || scope === 'pharmacy') {
        pharmacyBills.forEach(function (b) {
            rows.push({ date: b.date, module: 'Pharmacy', docNo: b.billNo, party: b.patientName, category: 'Pharmacy Sale', mode: b.payType, amount: b.netFee });
        });
        pharmacyPurchases.forEach(function (p) {
            rows.push({ date: p.date, module: 'Pharmacy', docNo: p.invoiceNo, party: p.vendor, category: 'Purchase (' + p.paymentStatus + ')', mode: p.payType, amount: p.totalAmount });
        });
        pharmacyReturns.forEach(function (r) {
            rows.push({ date: r.date, module: 'Pharmacy', docNo: r.retId, party: r.itemName, category: 'Sale Return', mode: 'Refund', amount: -Math.abs(r.refundAmount) });
        });
    }
    if (scope === 'all' || scope === 'inventory') {
        grnRows.forEach(function (g) {
            rows.push({ date: g.date, module: 'Inventory', docNo: g.grnId, party: g.vendor, category: 'Store GRN (' + g.itemName + ')', mode: 'GRN', amount: g.totalAmount });
        });
    }
    if (scope === 'all' || scope === 'bme') {
        biomedRows.forEach(function (w) {
            rows.push({ date: w.date, module: 'BME', docNo: w.woId, party: w.equipment, category: w.issue, mode: w.status, amount: 0 });
        });
    }

    const totalAmount = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    res.json({
        success: true,
        scope: scope,
        fromDate: fromDate,
        toDate: toDate,
        count: rows.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        rows: rows
    });
});

app.get('/api/module/:key', function (req, res) {
    const key = req.params.key;
    if (['patients', 'patient-search', 'patients-reg', 'medical-records'].includes(key)) return res.json({ success: true, data: erpData.patients });
    if (['opd'].includes(key)) return res.json({ success: true, data: erpData.opdAppointments });
    if (['ipd', 'discharge', 'nursing', 'ot-icu'].includes(key)) return res.json({ success: true, data: erpData.ipdAdmissions });
    if (['wards'].includes(key)) return res.json({ success: true, data: erpData.wards });
    if (['hospital-billing'].includes(key)) {
        return res.json({ success: true, data: erpData.bills.filter(function (b) { return b.billType === 'Hospital'; }) });
    }
    if (['sales-billing', 'pharmacy-reports'].includes(key)) {
        return res.json({ success: true, data: erpData.bills.filter(function (b) { return b.billType === 'Pharmacy'; }) });
    }
    if (['purchase-entry'].includes(key)) {
        return res.json({
            success: true,
            data: erpData.pharmacyPurchases.map(function (p) {
                return {
                    purId: p.purId,
                    date: p.date,
                    invoiceNo: p.invoiceNo,
                    vendor: p.vendor,
                    itemsCount: p.itemsCount,
                    items: p.itemsSummary,
                    payMode: p.payType,
                    chequeNo: p.chequeNo || '-',
                    status: p.paymentStatus,
                    totalAmount: p.totalAmount
                };
            })
        });
    }
    if (['sales-return'].includes(key)) return res.json({ success: true, data: erpData.pharmacyReturns });
    if (['pharmacy', 'medicines', 'batch-stock', 'stock-alerts', 'stock-audit'].includes(key)) return res.json({ success: true, data: erpData.pharmacyStock });
    if (['doctors'].includes(key)) return res.json({ success: true, data: erpData.doctors });
    if (['users'].includes(key)) return res.json({ success: true, data: erpData.users });
    if (['lab', 'laboratory'].includes(key)) return res.json({ success: true, data: erpData.laboratory });
    if (['radiology'].includes(key)) return res.json({ success: true, data: erpData.radiology });
    if (['abdm', 'abdm-hims', 'abha', 'm1', 'm2', 'm3'].includes(key)) return res.json({ success: true, data: erpData.abdmRecords });
    if (['nhcx', 'claims'].includes(key)) return res.json({ success: true, data: erpData.nhcxClaims });
    if (['warehouses'].includes(key)) return res.json({ success: true, data: erpData.warehouses });
    if (['grn'].includes(key)) return res.json({ success: true, data: erpData.grnEntries });
    if (['po'].includes(key)) return res.json({ success: true, data: erpData.purchaseOrders });
    if (['stock-ledger'].includes(key)) return res.json({ success: true, data: erpData.stockLedger });
    if (['inv-dash', 'item-master'].includes(key)) return res.json({ success: true, data: erpData.inventoryItems });
    if (['repairs'].includes(key)) return res.json({ success: true, data: erpData.biomedWorkOrders });
    if (['pm', 'amc'].includes(key)) return res.json({ success: true, data: erpData.biomedPmAmc });
    if (['biomed-dash', 'equipment'].includes(key)) return res.json({ success: true, data: erpData.biomedicalAssets });
    if (['payroll'].includes(key)) return res.json({ success: true, data: erpData.payrollRecords });
    if (['accounts', 'income-expenses', 'cash-bank', 'reports'].includes(key)) return res.json({ success: true, data: erpData.financeEntries });
    if (['audit-logs'].includes(key)) return res.json({ success: true, data: erpData.auditLogs });
    res.json({ success: true, data: erpData.patients });
});

app.get('/api/dashboard/metrics', function (req, res) {
    const hospRev = erpData.bills.filter(function (b) { return b.billType === 'Hospital'; }).reduce(function (a, b) { return a + Number(b.netFee || 0); }, 0);
    const phmSales = erpData.bills.filter(function (b) { return b.billType === 'Pharmacy'; }).reduce(function (a, b) { return a + Number(b.netFee || 0); }, 0);
    const phmPurch = erpData.pharmacyPurchases.reduce(function (a, p) { return a + Number(p.totalAmount || 0); }, 0);
    const phmCreditDue = erpData.pharmacyPurchases.filter(function (p) { return p.paymentStatus === 'Credit Due'; }).reduce(function (a, p) { return a + Number(p.totalAmount || 0); }, 0);
    const invVal = erpData.inventoryItems.reduce(function (a, i) { return a + (Number(i.stock || 0) * Number(i.rate || 0)); }, 0);
    const biomedExp = erpData.biomedPmAmc.reduce(function (a, c) { return a + Number(c.cost || 0); }, 0);
    const creditTotal = erpData.bills.filter(function (b) { return (b.payType || '').includes('Credit'); }).reduce(function (a, b) { return a + Number(b.netFee || 0); }, 0) + phmCreditDue;
    const totalBeds = erpData.wards.reduce(function (a, w) { return a + Number(w.totalBeds || 0); }, 0);
    const occBeds = erpData.wards.reduce(function (a, w) { return a + Number(w.occupiedBeds || 0); }, 0);

    res.json({
        success: true,
        hospitalRevenue: Number(hospRev.toFixed(2)),
        pharmacySales: Number(phmSales.toFixed(2)),
        pharmacyPurchase: Number(phmPurch.toFixed(2)),
        pharmacyCreditDue: Number(phmCreditDue.toFixed(2)),
        pharmacyStockCount: erpData.pharmacyStock.length,
        inventoryValue: Number(invVal.toFixed(2)),
        inventoryItemsCount: erpData.inventoryItems.length,
        biomedAssetsCount: erpData.biomedicalAssets.length,
        biomedWorkOrdersCount: erpData.biomedWorkOrders.length,
        biomedContractCost: Number(biomedExp.toFixed(2)),
        totalRevenue: Number((hospRev + phmSales).toFixed(2)),
        creditTotal: Number(creditTotal.toFixed(2)),
        registeredPatients: erpData.patients.length,
        activeIpdBeds: occBeds,
        totalBeds: totalBeds
    });
});

app.post('/api/ai/query', function (req, res) {
    const q = (req.body.prompt || '').toLowerCase();
    const hospRev = erpData.bills.filter(function (b) { return b.billType === 'Hospital'; }).reduce(function (a, b) { return a + Number(b.netFee || 0); }, 0);
    const phmSales = erpData.bills.filter(function (b) { return b.billType === 'Pharmacy'; }).reduce(function (a, b) { return a + Number(b.netFee || 0); }, 0);
    let reply = 'AR AI: Hospital Billing ₹' + hospRev.toFixed(2) + ', Pharmacy Sale ₹' + phmSales.toFixed(2) + ', ABDM Profiles ' + erpData.abdmRecords.length + ', NHCX Claims ' + erpData.nhcxClaims.length + '.';
    if (q.includes('pharmacy')) reply = 'AR AI: Pharmacy Sale ₹' + phmSales.toFixed(2) + ' across ' + erpData.pharmacyStock.length + ' medicine batches.';
    else if (q.includes('hospital') || q.includes('patient')) reply = 'AR AI: Hospital Revenue ₹' + hospRev.toFixed(2) + ' with ' + erpData.patients.length + ' registered patients.';
    else if (q.includes('bme') || q.includes('biomed')) reply = 'AR AI: Biomedical has ' + erpData.biomedicalAssets.length + ' assets and ' + erpData.biomedWorkOrders.length + ' work orders.';
    else if (q.includes('inventory') || q.includes('store')) reply = 'AR AI: Central Store has ' + erpData.inventoryItems.length + ' items and ' + erpData.grnEntries.length + ' GRNs.';
    res.json({ success: true, reply: reply });
});

const htmlPage = [
'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
'<title>AR Healthcare ERP - Master HIMS, Pharmacy, BME, Inventory & ABDM/NHCX</title>',
'<style>',
':root{--navy:#10243a;--blue:#2674e8;--cyan:#16b8b0;--bg:#f3f6fb;--card:#fff;--text:#18283d;--muted:#718096;--line:#e4eaf2;--green:#16875d;--red:#c93c48;--shadow:0 8px 28px rgba(23,44,75,.07)}',
'*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-weight:600;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}',
'#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:linear-gradient(135deg,#0f172a,#1e3a8a);position:fixed;z-index:9999}',
'.login-card-wrapper{background:rgba(15,23,42,0.88);border:1px solid rgba(255,255,255,0.2);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,0.5);width:min(860px,94vw);height:480px;display:flex;overflow:hidden}',
'.login-left{flex:1.15;padding:36px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#fff}',
'.login-left form{width:100%;max-width:320px}',
'.login-right{flex:1;background:linear-gradient(135deg,#0d9488,#2563eb);color:#fff;padding:36px;display:flex;flex-direction:column;justify-content:center;text-align:left}',
'.login-field{margin-bottom:14px;text-align:left}.login-field label{display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin-bottom:6px}',
'.login-input{width:100%;padding:11px 13px;border:1px solid #475569;border-radius:10px;font-size:14px;font-weight:700;background:#0f172a;color:#fff;outline:none}',
'.login-btn{width:100%;padding:12px;background:#10b981;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;margin-top:8px}',
'#app{display:none;height:100vh;width:100vw;flex-direction:row}',
'.sidebar{width:274px;background:linear-gradient(180deg,var(--navy),#0b1927);color:#d9e6f5;display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto}',
'.brand{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid #ffffff18;position:sticky;top:0;background:var(--navy);z-index:10}',
'.logo{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#23c6b8,#3478f6);display:grid;place-items:center;color:#fff;font-weight:900;font-size:15px;overflow:hidden}',
'.brand strong{display:block;font-size:13px;font-weight:900;color:#fff}.brand small{display:block;color:#9db3ca;font-size:10px;margin-top:2px}',
'.nav{padding:10px 10px 28px;flex:1}',
'.nav-group-btn{width:100%;display:flex;justify-content:space-between;align-items:center;background:#ffffff0d;color:#93c5fd;border:1px solid #ffffff14;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:10px;font-weight:900;letter-spacing:0.8px;cursor:pointer;text-align:left}',
'.nav-group-btn:hover{background:#ffffff19;color:#fff}',
'.nav-group-items{display:none;padding:3px 0 4px 4px}.nav-group-items.open{display:block}',
'.nav-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;margin:2px 0;color:#c6d4e4;font-size:12px;font-weight:700;border:0;background:transparent;width:100%;text-align:left;cursor:pointer}',
'.nav-item:hover,.nav-item.active{background:#ffffff1a;color:#fff}.nav-item.active{box-shadow:inset 3px 0 #29c7be;font-weight:900}',
'.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}',
'.topbar{height:68px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 22px;gap:10px}',
'.live-clock-box{background:#f0f6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:900;white-space:nowrap}',
'.profile{display:flex;align-items:center;gap:10px}.avatar{width:36px;height:36px;border-radius:10px;background:#e4efff;color:#2464c4;display:grid;place-items:center;font-weight:900;font-size:12px}',
'.content{padding:18px 22px;overflow-y:auto;flex:1}.view-section{display:none}.view-section.active{display:block}',
'.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}',
'.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px;box-shadow:var(--shadow)}',
'.stat-label{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase}.stat-value{font-size:20px;font-weight:900;margin:7px 0 2px;color:var(--navy)}',
'.panel{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:16px;margin-bottom:16px}',
'.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px}',
'.panel-head h3{font-size:15px;font-weight:900;margin:0;color:var(--navy)}',
'.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}',
'.field{display:flex;flex-direction:column;gap:5px;position:relative}.field label{font-size:11px;font-weight:800;color:var(--navy)}',
'.field input,.field select{padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-weight:700;outline:none;background:#fff}',
'table{width:100%;border-collapse:collapse}th{text-align:left;background:#f8fafd;color:#5a6a8e;font-size:11px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;padding:9px 10px;border-bottom:1px solid var(--line)}',
'td{padding:9px 10px;border-top:1px solid #edf1f6;font-size:12px;font-weight:700}',
'.btn{border:1px solid var(--line);background:#fff;color:var(--text);border-radius:8px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}',
'.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}.btn.success{background:var(--cyan);border-color:var(--cyan);color:#fff}.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}.btn.warn{background:#d97706;border-color:#d97706;color:#fff}',
'.suggestions-box{position:absolute;top:62px;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.12);max-height:190px;overflow-y:auto;z-index:100;display:none}',
'.suggestion-item{padding:8px 11px;border-bottom:1px solid #f0f4f9;cursor:pointer;font-size:12px}.suggestion-item:hover{background:#f0f6ff}',
'.perm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f8fafc;border:1px solid var(--line);padding:10px;border-radius:8px;margin-bottom:10px}',
'.perm-grid label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;cursor:pointer}',
'.hide-col{display:none}',
'#ar-ai-widget{position:fixed;bottom:20px;right:20px;z-index:9999}',
'#ar-ai-btn{background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;border:none;border-radius:50px;padding:11px 18px;font-weight:800;font-size:12px;cursor:pointer}',
'#ar-ai-box{position:absolute;bottom:52px;right:0;width:330px;background:#fff;border-radius:14px;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;border:1px solid var(--line)}',
'.ai-head{background:var(--navy);color:#fff;padding:12px;font-weight:800;font-size:12px;display:flex;justify-content:space-between}',
'.ai-body{padding:12px;max-height:220px;overflow-y:auto;font-size:12px;display:flex;flex-direction:column;gap:8px}',
'.ai-foot{padding:8px;border-top:1px solid var(--line);display:flex;gap:6px}.ai-foot input{flex:1;padding:7px;border:1px solid var(--line);border-radius:6px;font-size:12px}',
'#print-modal,#prescription-modal{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;justify-content:center;align-items:center;z-index:99999;padding:12px}',
'.print-card{background:#fff;padding:20px;border-radius:12px;width:min(920px,97vw);max-height:93vh;overflow-y:auto}',
'.inv-box{border:1px solid #94a3b8;border-radius:8px;padding:10px 12px;font-size:11px;margin-bottom:10px}',
'.print-opts{display:flex;flex-wrap:wrap;gap:10px;background:#f8fafc;border:1px solid var(--line);padding:8px 12px;border-radius:8px;margin-bottom:12px;font-size:11px;font-weight:800}',
'.print-opts label{display:flex;align-items:center;gap:4px;cursor:pointer}',
'@media print{body *{visibility:hidden}#print-card-area,#print-card-area *,#prescription-card-area,#prescription-card-area *,.audit-print-area,.audit-print-area *{visibility:visible}#print-modal,#prescription-modal{position:absolute;left:0;top:0;width:100%;background:#fff;display:flex;align-items:flex-start;justify-content:center;padding:0}.print-card{box-shadow:none;width:100%;padding:0;margin:0;max-width:100%;max-height:none;overflow:visible}.no-print{display:none}@page{size:A4;margin:8mm}}',
'</style></head><body>',

'<div id="login-screen"><div class="login-card-wrapper"><div class="login-left"><h2 style="margin:0 0 14px 0;">AR ERP Sign In</h2><form id="login-form-element">',
'<div class="login-field"><label>User ID / Username</label><input type="text" id="login-u" class="login-input" required autocomplete="username"></div>',
'<div class="login-field"><label>Password</label><input type="password" id="login-p" class="login-input" required autocomplete="current-password"></div>',
'<div style="text-align:right;margin-bottom:10px;font-size:11px;"><a href="#" id="forgot-link" style="color:#38bdf8;text-decoration:none;">Forgot Password?</a></div>',
'<button type="submit" class="login-btn">Sign In</button></form></div>',
'<div class="login-right"><h2 style="margin:0 0 8px 0;font-size:22px;">AR HEALTHCARE MASTER ERP</h2><p style="margin:0 0 12px 0;font-size:12px;line-height:1.5;opacity:0.95;">Multi-Item Purchase Invoice & Credit Ledger, Normal/Emergency Patient Billing, Stock Audit, Backup/Export & ABDM/NHCX.</p><div style="font-size:11px;background:rgba(255,255,255,0.18);padding:6px 10px;border-radius:8px;">Live IST Clock • Custom Permissions • A4 GST Bill</div></div></div></div>',

'<div id="app"><aside class="sidebar" id="sidebar-panel"><div class="brand"><div class="logo" id="sidebar-logo-box">AR</div><div><strong>AR HEALTHCARE ERP</strong><small>HIMS • Pharmacy • BME • NHCX</small></div></div><nav class="nav" id="nav-menu"></nav></aside>',
'<main class="main"><header class="topbar"><div style="display:flex;align-items:center;gap:12px;"><button class="btn" id="sidebar-toggle-btn">Menu</button><h3 id="topbar-title" style="font-size:15px;font-weight:900;margin:0;color:var(--navy);">HOSPITAL DASHBOARD</h3></div>',
'<div class="profile"><div class="live-clock-box" id="live-datetime-badge">Loading Time...</div><div class="avatar" id="user-avatar">AR</div><div><strong id="user-display-name" style="font-size:12px;display:block;">-</strong><small id="user-display-role" style="font-size:10px;color:var(--muted);">-</small></div><button class="btn danger" id="logout-btn">Logout</button></div></header>',

'<section class="content">',

'<div id="view-dashboard" class="view-section active">',
'<div class="stats">',
'<div class="stat"><div class="stat-label">HOSPITAL BILLING</div><div class="stat-value" id="m-hosp-rev">₹0.00</div></div>',
'<div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>',
'<div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">0 / 0</div></div>',
'<div class="stat"><div class="stat-label">TOTAL CREDIT DUE</div><div class="stat-value" id="m-credit" style="color:var(--red);">₹0.00</div></div></div>',
'<div class="panel"><div class="panel-head"><h3>Hospital Patient & Quick Workflow Hub</h3><small style="color:var(--muted)">Search by Name, UHID, Mobile or ABHA</small></div>',
'<div style="position:relative;margin-bottom:12px;"><input type="text" id="dash-quick-find" placeholder="Search Patient Name, UHID, Mobile or ABHA..." style="width:100%;padding:10px 14px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-weight:700;"><div class="suggestions-box" id="dash-quick-suggestions"></div></div>',
'<div style="overflow-x:auto;"><table><thead><tr><th>UHID</th><th>Patient Name</th><th>Type</th><th>Mobile</th><th>ABHA</th><th>Doctor</th><th>Net Fee</th><th>Action</th></tr></thead><tbody id="dash-patients"></tbody></table></div></div></div>',

'<div id="view-module-container" class="view-section">',
'<div class="stats" id="sub-dashboard-stats" style="display:none;"></div>',

'<div class="panel" id="patient-reg-panel" style="display:none;"><div class="panel-head"><h3>Patient Registration & Hospital Bill (Normal / Emergency)</h3></div><form id="patient-reg-form"><div class="form-grid">',
'<div class="field"><label>Auto UHID</label><input type="text" id="reg-uhid" readonly style="background:#f1f5f9;font-weight:900;color:var(--blue);"></div>',
'<div class="field"><label>Live Patient Search</label><input type="text" id="live-search-input" placeholder="Search existing patient..." autocomplete="off"><div class="suggestions-box" id="search-suggestions"></div></div>',
'<div class="field"><label>Patient Type *</label><select id="reg-ptype"><option value="Normal">Normal</option><option value="Emergency">Emergency</option></select></div>',
'<div class="field"><label>Title</label><select id="reg-title"><option>Mr.</option><option>Mrs.</option><option>Miss</option><option>Master</option><option>Baby of</option></select></div>',
'<div class="field"><label>Patient Name *</label><input type="text" id="reg-name" required></div>',
'<div class="field"><label>Relation</label><select id="reg-relation"><option>S/O</option><option>D/O</option><option>W/O</option><option>C/O</option></select></div>',
'<div class="field"><label>Guardian Name</label><input type="text" id="reg-guardian"></div>',
'<div class="field"><label>Age *</label><input type="number" id="reg-age" required></div>',
'<div class="field"><label>Gender</label><select id="reg-gender"><option>Male</option><option>Female</option><option>Other</option></select></div>',
'<div class="field"><label>Mobile (10 Digits) *</label><input type="text" id="reg-contact" maxlength="10" required></div>',
'<div class="field"><label>Aadhaar No</label><input type="text" id="reg-adhaar" maxlength="12"></div>',
'<div class="field"><label>ABHA Address</label><input type="text" id="reg-abha" placeholder="name@abdm"></div>',
'<div class="field"><label>Address</label><input type="text" id="reg-address"></div>',
'<div class="field"><label>Consulting Doctor *</label><select id="reg-doctor" required></select></div>',
'<div class="field"><label>Doctor Fee (₹) *</label><input type="number" id="reg-fee" required></div>',
'<div class="field"><label>Emergency Charge (₹)</label><input type="number" id="reg-emg-fee" value="0"></div>',
'<div class="field"><label>Discount (₹)</label><input type="number" id="reg-discount" value="0"></div>',
'<div class="field"><label>Net Fee (₹)</label><input type="number" id="reg-netfee" readonly style="background:#f1f5f9;font-weight:900;color:var(--green);"></div>',
'<div class="field"><label>Payment Mode</label><select id="reg-paytype"><option>Cash</option><option>Cheque</option><option>Credit / Udhar</option><option>UPI / Online</option><option>Card</option></select></div>',
'</div><button type="submit" class="btn primary">Register & Print Hospital Bill</button></form></div>',

'<div class="panel" id="pharmacy-sale-panel" style="display:none;"><div class="panel-head"><h3>Pharmacy Multi-Item Sale Billing (GST Invoice)</h3></div>',
'<div class="form-grid">',
'<div class="field"><label>Customer / Patient Name *</label><input type="text" id="ps-name" placeholder="Customer Name"></div>',
'<div class="field"><label>Phone</label><input type="text" id="ps-phone" placeholder="Mobile"></div>',
'<div class="field"><label>Payment Mode</label><select id="ps-paytype"><option>Cash</option><option>Cheque</option><option>UPI / Online</option><option>Card</option><option>Credit / Udhar</option></select></div>',
'<div class="field"><label>Select Medicine from Stock</label><select id="ps-med-select"></select></div>',
'<div class="field"><label>Qty *</label><input type="number" id="ps-qty" value="1" min="1"></div>',
'<div class="field"><label>Discount (%)</label><input type="number" id="ps-disc" value="0" min="0" max="100"></div>',
'</div>',
'<div style="margin-bottom:10px;"><button type="button" class="btn success" id="ps-add-item-btn">+ Add Item to Bill</button> <button type="button" class="btn primary" id="ps-submit-bill-btn">Generate & Print Pharmacy Bill</button></div>',
'<table><thead><tr><th>Medicine</th><th>Batch</th><th>MFG/EXP</th><th>HSN</th><th>Qty</th><th>MRP</th><th>Rate</th><th>Disc%</th><th>GST%</th><th>Total</th><th>Remove</th></tr></thead><tbody id="ps-cart-tbody"></tbody></table></div>',

'<div class="panel" id="pharmacy-purchase-panel" style="display:none;"><div class="panel-head"><h3>Multi-Item Pharmacy Purchase Invoice & Party / Invoice Ledger</h3></div>',
'<form id="pharmacy-purchase-form"><div class="form-grid">',
'<div class="field"><label>Supplier / Party Name *</label><input type="text" id="pp-vendor" required placeholder="Wholesale Pharmacy"></div>',
'<div class="field"><label>Supplier Invoice No *</label><input type="text" id="pp-inv" required placeholder="INV-101"></div>',
'<div class="field"><label>Payment Mode *</label><select id="pp-paytype"><option value="Cash">Cash</option><option value="Credit / Udhar">Credit / Udhar</option><option value="Cheque">Cheque</option></select></div>',
'<div class="field"><label>Cheque No (If Cheque)</label><input type="text" id="pp-cheque" placeholder="Cheque No"></div>',
'<div class="field"><label>Medicine Name *</label><input type="text" id="pp-name" placeholder="Paracetamol 500 mg Tab"></div>',
'<div class="field"><label>Batch No *</label><input type="text" id="pp-batch" placeholder="B2611"></div>',
'<div class="field"><label>MFG / EXP</label><input type="text" id="pp-mfgexp" placeholder="Nov 2026 / Nov 2028"></div>',
'<div class="field"><label>HSN Code</label><input type="text" id="pp-hsn" value="30045031"></div>',
'<div class="field"><label>Purchase Qty *</label><input type="number" id="pp-qty" min="1" value="50"></div>',
'<div class="field"><label>MRP (₹)</label><input type="number" id="pp-mrp" step="0.01" placeholder="50"></div>',
'<div class="field"><label>Purchase Rate (₹) *</label><input type="number" id="pp-rate" step="0.01" placeholder="35"></div>',
'<div class="field"><label>GST (%)</label><input type="number" id="pp-gst" value="12"></div>',
'</div>',
'<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">',
'<button type="button" class="btn success" id="pp-add-item-btn">+ Add Item to Invoice</button>',
'<button type="submit" class="btn primary">Save Full Purchase Invoice</button></div>',
'<table style="margin-bottom:14px;"><thead><tr><th>Medicine</th><th>Batch</th><th>MFG/EXP</th><th>HSN</th><th>Qty</th><th>MRP</th><th>Rate</th><th>GST%</th><th>Line Total</th><th>Remove</th></tr></thead><tbody id="pp-items-tbody"></tbody></table></form>',
'<hr style="border:0;border-top:1px solid var(--line);margin:12px 0;">',
'<div class="panel-head"><h3>Search Purchase Ledger (By Invoice No or Party Name)</h3><input type="text" id="pp-ledger-search" placeholder="Search Invoice No or Party Name..." style="padding:7px 11px;border:1px solid var(--line);border-radius:8px;font-size:12px;width:260px;"></div>',
'<div style="overflow-x:auto;"><table><thead><tr><th>Pur ID</th><th>Date</th><th>Invoice No</th><th>Party / Vendor</th><th>Items</th><th>Pay Mode</th><th>Cheque</th><th>Status</th><th>Amount (₹)</th><th>Action</th></tr></thead><tbody id="pp-ledger-tbody"></tbody></table></div></div>',

'<div class="panel" id="pharmacy-audit-panel" style="display:none;"><div class="panel-head"><h3>Pharmacy Stock Audit (Item Search • System vs Physical • Extra/Short • Excel & Print)</h3>',
'<div style="display:flex;gap:8px;flex-wrap:wrap;"><input type="text" id="audit-search-input" placeholder="Search Medicine Name or Batch..." style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px;width:230px;">',
'<button type="button" class="btn success" id="audit-export-csv-btn">Export Excel / CSV</button>',
'<button type="button" class="btn primary" id="audit-print-btn">Print Audit Report</button></div></div>',
'<div class="audit-print-area" style="overflow-x:auto;"><table><thead><tr><th>Code</th><th>Medicine Name</th><th>Batch</th><th>System Stock</th><th>Physical Stock</th><th>Diff Qty</th><th>Status</th><th>Rate (₹)</th><th>Value Diff (₹)</th><th>Save Audit</th></tr></thead><tbody id="audit-stock-tbody"></tbody></table></div></div>',

'<div class="panel" id="pharmacy-return-panel" style="display:none;"><div class="panel-head"><h3>Pharmacy Sale Return (Restores Stock & Logs Refund)</h3></div>',
'<form id="pharmacy-return-form" class="form-grid">',
'<div class="field"><label>Reference Bill No</label><input type="text" id="pr-billno" placeholder="PHM-..."></div>',
'<div class="field"><label>Medicine Name *</label><input type="text" id="pr-medname" required placeholder="Medicine Name"></div>',
'<div class="field"><label>Batch No</label><input type="text" id="pr-batch" placeholder="Batch"></div>',
'<div class="field"><label>Return Qty *</label><input type="number" id="pr-qty" required min="1" value="1"></div>',
'<div class="field"><label>Refund Amount (₹) *</label><input type="number" id="pr-refund" step="0.01" required value="0"></div>',
'<div class="field"><label>Return Reason</label><input type="text" id="pr-reason" placeholder="Return reason"></div>',
'<div style="grid-column:span 3;"><button type="submit" class="btn danger">Process Sale Return</button></div>',
'</form></div>',

'<div class="panel" id="pharmacy-med-panel" style="display:none;"><div class="panel-head"><h3>Add / Update Medicine Stock</h3></div>',
'<form id="pharmacy-med-form" class="form-grid">',
'<div class="field"><label>Medicine Name *</label><input type="text" id="pm-name" required></div>',
'<div class="field"><label>Batch No *</label><input type="text" id="pm-batch" required></div>',
'<div class="field"><label>MFG Date</label><input type="text" id="pm-mfg" placeholder="Jan 2026"></div>',
'<div class="field"><label>Expiry Date</label><input type="text" id="pm-exp" placeholder="Dec 2027"></div>',
'<div class="field"><label>HSN Code</label><input type="text" id="pm-hsn" value="30045031"></div>',
'<div class="field"><label>Qty *</label><input type="number" id="pm-qty" required value="50"></div>',
'<div class="field"><label>MRP (₹)</label><input type="number" id="pm-mrp" step="0.01" value="50"></div>',
'<div class="field"><label>Rate (₹) *</label><input type="number" id="pm-rate" step="0.01" required value="40"></div>',
'<div class="field"><label>GST (%)</label><input type="number" id="pm-gst" value="12"></div>',
'<div style="grid-column:span 3;"><button type="submit" class="btn primary">+ Add Medicine Stock</button></div>',
'</form></div>',

'<div class="panel" id="abdm-panel" style="display:none;"><div class="panel-head"><h3>ABDM HIMS (M1 ABHA • M2 Health Records • M3 & NHCX)</h3></div>',
'<form id="abdm-create-form" class="form-grid">',
'<div class="field"><label>Patient UHID</label><input type="text" id="abdm-uhid" placeholder="AR231126-01"></div>',
'<div class="field"><label>Patient Full Name *</label><input type="text" id="abdm-name" required></div>',
'<div class="field"><label>Mobile / Aadhaar Ref *</label><input type="text" id="abdm-ref" required></div>',
'<div class="field"><label>Desired ABHA Address</label><input type="text" id="abdm-handle" placeholder="name (adds @abdm)"></div>',
'<div class="field"><label>M2 Care Context / Health Record</label><input type="text" id="abdm-m2" placeholder="OPD Prescription / Lab / Discharge"></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Create ABHA (M1) & Link M2</button></div>',
'</form><hr style="border:0;border-top:1px solid var(--line);margin:14px 0;">',
'<form id="nhcx-claim-form" class="form-grid">',
'<div class="field"><label>UHID *</label><input type="text" id="nhcx-uhid" required></div>',
'<div class="field"><label>Patient Name *</label><input type="text" id="nhcx-name" required></div>',
'<div class="field"><label>NHCX Payer / TPA</label><input type="text" id="nhcx-payer" value="National Health Claims Exchange (NHCX)"></div>',
'<div class="field"><label>M3 / NHCX Action</label><select id="nhcx-type"><option>Cashless Pre-Auth</option><option>Claim Submission</option><option>Enhancement Request</option></select></div>',
'<div class="field"><label>Amount (₹) *</label><input type="number" id="nhcx-amount" required value="0"></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn success" style="width:100%;">Submit to NHCX (M3)</button></div>',
'</form></div>',

'<div class="panel" id="opd-panel" style="display:none;"><div class="panel-head"><h3>Book OPD Appointment / Token (Normal / Emergency)</h3></div><form id="opd-book-form" class="form-grid">',
'<div class="field"><label>Patient UHID / Name *</label><input type="text" id="opd-uhid" required></div>',
'<div class="field"><label>Patient Type</label><select id="opd-ptype"><option>Normal</option><option>Emergency</option></select></div>',
'<div class="field"><label>Doctor *</label><select id="opd-doctor" required></select></div>',
'<div class="field"><label>Time Slot</label><select id="opd-slot"><option>Morning Session (10 AM - 1 PM)</option><option>Evening Session (5 PM - 8 PM)</option></select></div>',
'<div style="grid-column:span 2;display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Book OPD Token</button></div></form></div>',

'<div class="panel" id="ipd-panel" style="display:none;"><div class="panel-head"><h3>IPD Patient Admission (Normal / Emergency)</h3></div><form id="ipd-admit-form" class="form-grid">',
'<div class="field"><label>UHID *</label><input type="text" id="ipd-uhid" required></div>',
'<div class="field"><label>Patient Name *</label><input type="text" id="ipd-name" required></div>',
'<div class="field"><label>Patient Type</label><select id="ipd-ptype"><option>Normal</option><option>Emergency</option></select></div>',
'<div class="field"><label>Ward / Bed *</label><select id="ipd-ward"><option>General Ward - Bed 02</option><option>Private Room - Bed 01</option><option>ICU - Bed 02</option></select></div>',
'<div class="field"><label>Doctor *</label><select id="ipd-doctor" required></select></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Admit Patient</button></div></form></div>',

'<div class="panel" id="wards-panel" style="display:none;"><div class="panel-head"><h3>Add Ward / Bed Setup</h3></div><form id="ward-add-form" class="form-grid">',
'<div class="field"><label>Ward Name *</label><input type="text" id="w-name" required></div>',
'<div class="field"><label>Total Beds *</label><input type="number" id="w-beds" required value="10"></div>',
'<div class="field"><label>Daily Charge (₹) *</label><input type="number" id="w-charge" required value="1000"></div>',
'<div style="grid-column:span 3;"><button type="submit" class="btn primary">+ Add Ward</button></div></form></div>',

'<div class="panel" id="lab-panel" style="display:none;"><div class="panel-head"><h3>Add Laboratory Report</h3></div><form id="lab-add-form" class="form-grid">',
'<div class="field"><label>UHID *</label><input type="text" id="lab-uhid" required></div>',
'<div class="field"><label>Patient Name *</label><input type="text" id="lab-name" required></div>',
'<div class="field"><label>Test Name *</label><input type="text" id="lab-test" required placeholder="CBC / LFT / KFT"></div>',
'<div class="field" style="grid-column:span 2;"><label>Result / Findings *</label><input type="text" id="lab-result" required></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Save Lab Report</button></div></form></div>',

'<div class="panel" id="radiology-panel" style="display:none;"><div class="panel-head"><h3>Add Radiology Report</h3></div><form id="rad-add-form" class="form-grid">',
'<div class="field"><label>UHID *</label><input type="text" id="rad-uhid" required></div>',
'<div class="field"><label>Patient Name *</label><input type="text" id="rad-name" required></div>',
'<div class="field"><label>Modality / Scan *</label><input type="text" id="rad-mod" required placeholder="X-Ray / Ultrasound / CT"></div>',
'<div class="field" style="grid-column:span 2;"><label>Finding *</label><input type="text" id="rad-finding" required></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Save Radiology Report</button></div></form></div>',

'<div class="panel" id="inventory-panel" style="display:none;"><div class="panel-head"><h3>Central Store Item & GRN Entry</h3></div>',
'<form id="inv-item-form" class="form-grid">',
'<div class="field"><label>Item Name *</label><input type="text" id="inv-name" required placeholder="Surgical Item / Consumable"></div>',
'<div class="field"><label>Category</label><input type="text" id="inv-cat" value="Consumables"></div>',
'<div class="field"><label>Warehouse</label><select id="inv-wh"><option>Central Store</option><option>OT Store</option></select></div>',
'<div class="field"><label>Opening Stock *</label><input type="number" id="inv-stock" required value="50"></div>',
'<div class="field"><label>Unit</label><input type="text" id="inv-unit" value="Box"></div>',
'<div class="field"><label>Unit Rate (₹) *</label><input type="number" id="inv-rate" step="0.01" required value="100"></div>',
'<div style="grid-column:span 3;"><button type="submit" class="btn primary">+ Add Store Item</button></div></form>',
'<hr style="border:0;border-top:1px solid var(--line);margin:12px 0;">',
'<form id="inv-grn-form" class="form-grid">',
'<div class="field"><label>GRN Vendor *</label><input type="text" id="grn-vendor" required placeholder="Vendor Name"></div>',
'<div class="field"><label>Item Name *</label><input type="text" id="grn-item" required placeholder="Item Name"></div>',
'<div class="field"><label>GRN Qty *</label><input type="number" id="grn-qty" required value="20"></div>',
'<div class="field"><label>Rate (₹) *</label><input type="number" id="grn-rate" step="0.01" required value="100"></div>',
'<div class="field"><label>Warehouse</label><select id="grn-wh"><option>Central Store</option><option>OT Store</option></select></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn success" style="width:100%;">Record GRN</button></div></form></div>',

'<div class="panel" id="biomed-panel" style="display:none;"><div class="panel-head"><h3>Biomedical Equipment & Work Order</h3></div>',
'<form id="bio-eq-form" class="form-grid">',
'<div class="field"><label>Equipment Name *</label><input type="text" id="bio-name" required placeholder="Ventilator / Monitor / ECG"></div>',
'<div class="field"><label>Department</label><input type="text" id="bio-dept" value="ICU"></div>',
'<div class="field"><label>Serial No</label><input type="text" id="bio-serial" placeholder="SN-1001"></div>',
'<div class="field"><label>Make / Model</label><input type="text" id="bio-model" placeholder="Model"></div>',
'<div class="field"><label>AMC / CMC Status</label><select id="bio-amc"><option>Active AMC</option><option>CMC Active</option><option>Warranty</option></select></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">+ Add Equipment</button></div></form>',
'<hr style="border:0;border-top:1px solid var(--line);margin:12px 0;">',
'<form id="bio-wo-form" class="form-grid">',
'<div class="field"><label>Equipment *</label><input type="text" id="wo-eq" required placeholder="Equipment Name"></div>',
'<div class="field"><label>Department</label><input type="text" id="wo-dept" value="ICU"></div>',
'<div class="field"><label>Issue / PM Task *</label><input type="text" id="wo-issue" required placeholder="Calibration / Repair"></div>',
'<div class="field"><label>Status</label><select id="wo-status"><option>Open</option><option>In Progress</option><option>Completed</option></select></div>',
'<div style="grid-column:span 2;display:flex;align-items:flex-end;"><button type="submit" class="btn success" style="width:100%;">Create Work Order</button></div></form></div>',

'<div class="panel" id="finance-panel" style="display:none;"><div class="panel-head"><h3>Accounts Voucher Entry</h3></div>',
'<form id="fin-add-form" class="form-grid">',
'<div class="field"><label>Module</label><select id="fin-mod"><option>Hospital</option><option>Pharmacy</option><option>BME</option><option>Inventory</option></select></div>',
'<div class="field"><label>Entry Type</label><select id="fin-type"><option>Receipt</option><option>Expense</option><option>Payment</option></select></div>',
'<div class="field"><label>Account Head *</label><input type="text" id="fin-head" required placeholder="Head / Description"></div>',
'<div class="field"><label>Mode</label><select id="fin-mode"><option>Cash</option><option>Cheque</option><option>Bank / UPI</option></select></div>',
'<div class="field"><label>Amount (₹) *</label><input type="number" id="fin-amt" step="0.01" required value="0"></div>',
'<div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">Save Voucher</button></div></form></div>',

'<div class="panel" id="custom-report-panel" style="display:none;"><div class="panel-head"><h3>Date-Wise & Module-Wise Custom Report</h3></div>',
'<div class="form-grid">',
'<div class="field"><label>From Date</label><input type="date" id="rep-from"></div>',
'<div class="field"><label>To Date</label><input type="date" id="rep-to"></div>',
'<div class="field"><label>Select Scope</label><select id="rep-scope"><option value="all">All Modules (Hospital + Pharmacy + BME + Inventory)</option><option value="hospital">Hospital Only</option><option value="pharmacy">Pharmacy Only</option><option value="bme">BME Only</option><option value="inventory">Inventory Only</option></select></div>',
'</div>',
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;">',
'<button type="button" class="btn primary" id="rep-run-btn">Run Date-Wise Report</button>',
'<div id="rep-summary-badge" style="font-size:13px;font-weight:900;color:var(--navy);">Records: 0 | Total: ₹0.00</div></div>',
'<div style="overflow-x:auto;"><table><thead><tr><th>Date</th><th>Module</th><th>Doc No</th><th>Party / Item</th><th>Particulars</th><th>Mode</th><th>Amount (₹)</th></tr></thead><tbody id="rep-custom-tbody"></tbody></table></div></div>',

'<div class="panel" id="doctor-panel" style="display:none;"><div class="panel-head"><h3>Add Doctor</h3></div><form id="doctor-form" class="form-grid">',
'<div class="field"><label>Doctor Name & Qualification *</label><input type="text" id="doc-name" required></div>',
'<div class="field"><label>Consultation Fee (₹) *</label><input type="number" id="doc-fee" required value="500"></div>',
'<div class="field"><label>Department</label><input type="text" id="doc-dept" value="General Medicine"></div>',
'<div style="grid-column:span 3;"><button type="submit" class="btn primary">+ Add Doctor</button></div></form></div>',

'<div class="panel" id="user-mgmt-panel" style="display:none;"><div class="panel-head"><h3 id="user-form-title">Create / Edit User & Custom Permissions</h3><button type="button" class="btn" id="user-reset-form-btn">Reset Form</button></div>',
'<form id="user-form"><div class="form-grid">',
'<div class="field"><label>Full Name *</label><input type="text" id="new-u-name" required></div>',
'<div class="field"><label>Username *</label><input type="text" id="new-u-username" required></div>',
'<div class="field"><label>Password *</label><input type="text" id="new-u-password" required></div>',
'<div class="field"><label>Role</label><select id="new-u-role"><option>Admin</option><option>Cashier / Receptionist</option><option>Pharmacist</option><option>Doctor</option><option>Accountant</option><option>Demo Viewer</option></select></div>',
'</div>',
'<div style="margin-bottom:8px;font-size:11px;font-weight:900;color:var(--navy);">Select Allowed Modules for This User (Only Checked Modules Will Appear):</div>',
'<div class="perm-grid" id="perm-checkboxes-box"></div>',
'<button type="submit" class="btn primary" id="user-save-btn">Create User</button></form></div>',

'<div class="panel" id="backup-panel" style="display:none;"><div class="panel-head"><h3>Institute Logo, GST, Bank, Emergency Fee & Backup/Export</h3>',
'<div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn success" id="download-backup-json-btn">Save / Download Backup (JSON)</button><button type="button" class="btn primary" id="export-backup-csv-btn">Export Data (CSV)</button></div></div>',
'<form id="institute-form" class="form-grid">',
'<div class="field"><label>Institute / Pharmacy Name *</label><input type="text" id="inst-name" required></div>',
'<div class="field"><label>Tagline</label><input type="text" id="inst-tagline"></div>',
'<div class="field"><label>Address *</label><input type="text" id="inst-address" required></div>',
'<div class="field"><label>GSTIN</label><input type="text" id="inst-gstin"></div>',
'<div class="field"><label>Phone</label><input type="text" id="inst-phone"></div>',
'<div class="field"><label>Place of Supply</label><input type="text" id="inst-pos"></div>',
'<div class="field"><label>Default Emergency Fee (₹)</label><input type="number" id="inst-emg-fee" value="250"></div>',
'<div class="field"><label>Bank Name</label><input type="text" id="inst-bank"></div>',
'<div class="field"><label>Account No</label><input type="text" id="inst-acc"></div>',
'<div class="field"><label>IFSC</label><input type="text" id="inst-ifsc"></div>',
'<div class="field"><label>UPI ID</label><input type="text" id="inst-upi"></div>',
'<div class="field"><label>Institute Logo Image</label><input type="file" id="inst-logo-file" accept="image/*"></div>',
'<div style="grid-column:span 3;display:flex;align-items:center;gap:14px;"><img id="inst-logo-preview" src="" alt="Logo Preview" style="height:44px;border-radius:6px;display:none;border:1px solid var(--line);"><button type="submit" class="btn primary">Save Institute Settings & Logo</button></div></form></div>',

'<div class="panel" id="password-panel" style="display:none;"><div class="panel-head"><h3>Change Password</h3></div><form id="password-change-form" style="max-width:380px;display:flex;flex-direction:column;gap:12px;">',
'<div class="field"><label>Old Password *</label><input type="password" id="pass-old" required></div>',
'<div class="field"><label>New Password *</label><input type="password" id="pass-new" required></div>',
'<button type="submit" class="btn primary">Update Password</button></form></div>',

'<div class="panel" id="generic-table-panel"><div class="panel-head"><h3 id="module-title-heading">RECORDS</h3></div><div style="overflow-x:auto;"><table><thead id="module-thead"></thead><tbody id="module-tbody"></tbody></table></div></div>',
'</div></section></main></div>',

'<div id="ar-ai-widget"><div id="ar-ai-box"><div class="ai-head"><span>AR AI Assistant</span><span style="cursor:pointer;" id="ai-close-btn">X</span></div><div class="ai-body" id="ai-chat-body"><div><b>AR AI:</b> Ask about Hospital, Pharmacy, BME, Inventory, ABHA or NHCX.</div></div><div class="ai-foot"><input type="text" id="ai-input" placeholder="Ask AR AI..."><button class="btn primary" id="ai-send-btn">Send</button></div></div><button id="ar-ai-btn">AR AI</button></div>',

'<div id="print-modal"><div class="print-card" id="print-card-area">',
'<div class="print-opts no-print"><span>CUSTOMIZE PRINT:</span>',
'<label><input type="checkbox" id="opt-batch" checked> Batch No</label>',
'<label><input type="checkbox" id="opt-mfgexp" checked> MFG / Expiry</label>',
'<label><input type="checkbox" id="opt-hsn" checked> HSN / SAC</label>',
'<label><input type="checkbox" id="opt-mrp" checked> MRP</label>',
'<label><input type="checkbox" id="opt-gst" checked> GST Breakup</label>',
'<label><input type="checkbox" id="opt-bank" checked> Bank & UPI</label>',
'<label><input type="checkbox" id="opt-terms" checked> Terms & Sign</label></div>',

'<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--navy);padding-bottom:8px;margin-bottom:10px;"><div style="display:flex;gap:12px;align-items:center;"><img id="print-inst-logo" src="" style="height:48px;display:none;border-radius:6px;"><div>',
'<h2 style="margin:0;color:var(--navy);font-weight:900;font-size:19px;" id="print-inst-name">A.R. MEDICAL COLLEGE & HEALTHCARE</h2>',
'<div style="font-size:11px;color:var(--muted);" id="print-inst-address"></div>',
'<div style="font-size:11px;font-weight:800;margin-top:2px;">GSTIN: <span id="print-inst-gstin"></span> | Ph: <span id="print-inst-phone"></span></div></div></div>',
'<div style="text-align:right;"><div style="font-size:14px;font-weight:900;color:var(--blue);" id="pb-doc-title">TAX INVOICE</div><div style="font-size:10px;font-weight:800;">ORIGINAL FOR RECIPIENT</div></div></div>',

'<div class="inv-box" style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;"><div>',
'<div><strong>Patient / Customer:</strong> <span id="pb-name"></span> (<span id="pb-ptype">Normal</span>)</div>',
'<div><strong>UHID:</strong> <span id="pb-uhid"></span> | <strong>Phone:</strong> <span id="pb-contact"></span></div>',
'<div><strong>Address:</strong> <span id="pb-address"></span></div>',
'<div><strong>Doctor / Ref:</strong> <span id="pb-doctor"></span></div></div><div>',
'<div><strong>Invoice No:</strong> <span id="pb-billno"></span></div>',
'<div><strong>Date & Time:</strong> <span id="pb-datetime"></span></div>',
'<div><strong>Place of Supply:</strong> <span id="pb-pos"></span></div>',
'<div><strong>Payment Mode:</strong> <span id="pb-paymode" style="color:var(--blue);font-weight:900;"></span> | <strong>By:</strong> <span id="pb-user"></span></div></div></div>',

'<table style="width:100%;margin:8px 0;border:1px solid #cbd5e1;"><thead><tr>',
'<th>Sr. No.</th><th>Name of Product / Service</th><th class="col-batch">Batch No</th><th class="col-mfgexp">MFG Date</th><th class="col-mfgexp">Expiry Date</th><th class="col-hsn">HSN / SAC</th><th>Qty</th><th class="col-mrp">MRP</th><th>Rate</th><th>Disc (%)</th><th>Taxable Value</th><th>GST</th><th>Total</th>',
'</tr></thead><tbody id="pb-items-tbody"></tbody></table>',

'<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:12px;margin-top:10px;font-size:11px;"><div>',
'<div class="sec-gst inv-box" style="margin-bottom:8px;"><div><strong>HSN / Tax Summary:</strong> Taxable: ₹<span id="pb-taxable">0.00</span> | Disc: ₹<span id="pb-disc">0.00</span> | GST: ₹<span id="pb-gst">0.00</span></div></div>',
'<div class="sec-bank inv-box"><div><strong>Bank Details:</strong> <span id="pb-bank"></span> (<span id="pb-branch"></span>)</div><div><strong>A/C No:</strong> <span id="pb-acc"></span> | <strong>IFSC:</strong> <span id="pb-ifsc"></span></div><div><strong>UPI ID:</strong> <span id="pb-upi"></span></div></div></div>',
'<div class="inv-box" style="background:#f8fafc;">',
'<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Gross Amount:</span><span id="pb-gross">₹0.00</span></div>',
'<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Discount:</span><span id="pb-disc-val">₹0.00</span></div>',
'<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>GST Amount:</span><span id="pb-gst-val">₹0.00</span></div>',
'<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;color:var(--green);border-top:1px solid #cbd5e1;padding-top:6px;"><span>Net Payable (<span id="pb-pay-status">Paid</span>):</span><span id="pb-amount">₹0.00</span></div></div></div>',

'<div class="sec-terms" style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:10px;">',
'<div style="max-width:60%;color:var(--muted);"><strong>Terms & Conditions:</strong> Goods once sold are subject to pharmacy/hospital policy & local jurisdiction. E. & O.E.</div>',
'<div style="text-align:right;font-weight:800;"><div style="margin-bottom:20px;">_________________________</div><div>Authorised Signatory</div></div></div>',

'<div class="no-print" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">',
'<button class="btn" id="print-modal-close-btn">Close</button>',
'<button class="btn success" id="print-modal-presc-btn">Prescription</button>',
'<button class="btn" id="print-modal-edit-btn">Edit Bill</button>',
'<button class="btn primary" id="print-modal-print-btn">Print A4 Bill</button></div></div></div>',

'<div id="prescription-modal"><div class="print-card" id="prescription-card-area" style="width:min(780px,96vw);">',
'<div style="text-align:center;border-bottom:2px solid var(--navy);padding-bottom:8px;margin-bottom:12px;"><img id="presc-inst-logo" src="" style="height:44px;display:none;margin:0 auto 4px auto;"><h2 style="margin:0;color:var(--navy);" id="presc-inst-name"></h2><div style="font-size:11px;color:var(--muted);" id="presc-inst-address"></div><h3 style="margin:6px 0 0 0;color:var(--blue);">OPD Prescription</h3></div>',
'<div class="inv-box" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><strong>UHID:</strong> <span id="pr-uhid"></span></div><div><strong>Date:</strong> <span id="pr-date"></span></div><div><strong>Patient:</strong> <span id="pr-name"></span></div><div><strong>Age/Sex:</strong> <span id="pr-age"></span></div><div><strong>Guardian:</strong> <span id="pr-guardian"></span></div><div><strong>Phone:</strong> <span id="pr-contact"></span></div><div><strong>Doctor:</strong> <span id="pr-doctor"></span></div><div><strong>Address:</strong> <span id="pr-address"></span></div></div>',
'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;background:#f8fafd;padding:8px;border-radius:8px;font-size:11px;"><div><label>BP:</label><input type="text" id="vital-bp" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div><div><label>Pulse:</label><input type="text" id="vital-pulse" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div><div><label>Temp:</label><input type="text" id="vital-temp" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div><div><label>Weight:</label><input type="text" id="vital-wt" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div></div>',
'<div style="display:grid;grid-template-columns:210px 1fr;gap:12px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:900;display:block;margin-bottom:4px;">Investigation / Advice:</label><textarea id="pr-investigation" style="width:100%;height:190px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;"></textarea></div><div><div style="font-size:16px;font-weight:900;color:var(--blue);margin-bottom:4px;">Rx</div><textarea id="pr-treatment" style="width:100%;height:190px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;"></textarea></div></div>',
'<div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;border-top:1px solid var(--line);padding-top:8px;"><div>Next Visit: <input type="text" id="pr-nextvisit" style="padding:4px;border:1px solid var(--line);border-radius:4px;width:130px;"></div><div style="text-align:right;"><div style="margin-bottom:20px;">_________________________</div><div>Doctor Signature</div></div></div>',
'<div class="no-print" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;"><button class="btn" id="presc-close-btn">Close</button><button class="btn primary" id="presc-print-btn">Print Prescription</button></div></div></div>',

'<script>',
'let currentUser = null; let activeModuleKey = "dashboard"; let openGroupIdx = 0;',
'let doctorsList = []; let pharmacyStockList = []; let pharmacyPurchasesList = []; let usersList = [];',
'let saleCart = []; let purchaseInvoiceItems = []; let currentActiveBillNo = ""; let editingUserId = "";',
'let instituteDetails = { emergencyFee: 250 };',

'const navGroups = [',
'{ label: "HOSPITAL (HIMS)", items: [["Hospital Dashboard", "dashboard", "HD"], ["Patient Registration", "patients", "PR"], ["Patient Search", "patient-search", "PS"], ["OPD & Appointments", "opd", "OP"], ["IPD Admissions", "ipd", "IP"], ["Wards & Beds", "wards", "WR"], ["Doctors", "doctors", "DR"], ["Laboratory", "lab", "LB"], ["Radiology", "radiology", "RD"], ["Hospital Billing", "hospital-billing", "HB"]] },',
'{ label: "PHARMACY", items: [["Pharmacy Dashboard", "pharmacy", "PD"], ["Medicine Master", "medicines", "MM"], ["Purchase Entry & Ledger", "purchase-entry", "PE"], ["Sales Billing", "sales-billing", "SB"], ["Sales Return", "sales-return", "SR"], ["Stock Audit (Phy/Sys)", "stock-audit", "SA"], ["Expiry & Low Stock", "stock-alerts", "AL"]] },',
'{ label: "ABDM M1/M2/M3 & NHCX", items: [["ABHA & M2 Hub", "abdm-hims", "M1"], ["NHCX Claims (M3)", "nhcx", "M3"]] },',
'{ label: "CENTRAL STORE INVENTORY", items: [["Inventory Dashboard", "inv-dash", "ID"], ["Item Master", "item-master", "IM"], ["Warehouses", "warehouses", "WH"], ["Goods Receipt (GRN)", "grn", "GN"], ["Stock Ledger", "stock-ledger", "SL"], ["Purchase Orders", "po", "PO"]] },',
'{ label: "BIOMEDICAL (BME)", items: [["BME Dashboard", "biomed-dash", "BD"], ["Equipment Assets", "equipment", "EQ"], ["Work Orders & Repairs", "repairs", "WO"], ["PM & AMC Contracts", "amc", "AM"]] },',
'{ label: "ACCOUNTS, REPORTS & ADMIN", items: [["Accounts Dashboard", "accounts", "AC"], ["Payroll", "payroll", "PY"], ["Date-Wise Reports", "reports", "RP"], ["User Management", "users", "US"], ["Change Password", "password", "PW"], ["Audit Logs", "audit-logs", "LG"], ["Institute, Logo & Backup", "backup", "ST"]] }',
'];',

'function startLiveClock() {',
'  function tick() {',
'    const now = new Date();',
'    document.getElementById("live-datetime-badge").innerText = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }) + " | " + now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" }) + " IST";',
'  }',
'  tick(); setInterval(tick, 1000);',
'}',

'window.addEventListener("DOMContentLoaded", function () {',
'  startLiveClock(); renderPermissionCheckboxes();',
'  const savedUser = localStorage.getItem("ar_erp_active_user");',
'  const savedPage = localStorage.getItem("ar_erp_active_page");',
'  if (savedUser) { currentUser = JSON.parse(savedUser); initSession(savedPage || "dashboard"); }',
'  document.getElementById("login-form-element").addEventListener("submit", handleLogin);',
'  document.getElementById("logout-btn").addEventListener("click", handleLogout);',
'  document.getElementById("sidebar-toggle-btn").addEventListener("click", function () { const sb = document.getElementById("sidebar-panel"); sb.style.marginLeft = sb.style.marginLeft === "-274px" ? "0" : "-274px"; });',
'  document.getElementById("dash-quick-find").addEventListener("input", function (e) { handleQuickSearch(e.target.value, "dash-quick-suggestions", true); });',
'  document.getElementById("live-search-input").addEventListener("input", function (e) { handleQuickSearch(e.target.value, "search-suggestions", false); });',
'  document.getElementById("reg-ptype").addEventListener("change", applyPatientTypeFee);',
'  document.getElementById("reg-doctor").addEventListener("change", function () { const d = doctorsList.find(function (x) { return x.name === document.getElementById("reg-doctor").value; }); if (d) { document.getElementById("reg-fee").value = d.fee; applyPatientTypeFee(); } });',
'  document.getElementById("reg-fee").addEventListener("input", calcRegNet);',
'  document.getElementById("reg-emg-fee").addEventListener("input", calcRegNet);',
'  document.getElementById("reg-discount").addEventListener("input", calcRegNet);',
'  document.getElementById("patient-reg-form").addEventListener("submit", handlePatientReg);',
'  document.getElementById("ps-add-item-btn").addEventListener("click", addItemToSaleCart);',
'  document.getElementById("ps-submit-bill-btn").addEventListener("click", submitPharmacySaleBill);',
'  document.getElementById("pp-add-item-btn").addEventListener("click", addPurchaseInvoiceItem);',
'  document.getElementById("pharmacy-purchase-form").addEventListener("submit", submitPurchaseInvoice);',
'  document.getElementById("pp-ledger-search").addEventListener("input", renderPurchaseLedgerTable);',
'  document.getElementById("audit-search-input").addEventListener("input", renderStockAuditTable);',
'  document.getElementById("audit-export-csv-btn").addEventListener("click", exportStockAuditCsv);',
'  document.getElementById("audit-print-btn").addEventListener("click", function () { window.print(); });',
'  document.getElementById("pharmacy-return-form").addEventListener("submit", handlePharmacyReturn);',
'  document.getElementById("pharmacy-med-form").addEventListener("submit", handleAddMedicine);',
'  document.getElementById("abdm-create-form").addEventListener("submit", handleCreateAbha);',
'  document.getElementById("nhcx-claim-form").addEventListener("submit", handleNhcxClaim);',
'  document.getElementById("opd-book-form").addEventListener("submit", handleOpdBook);',
'  document.getElementById("ipd-admit-form").addEventListener("submit", handleIpdAdmit);',
'  document.getElementById("ward-add-form").addEventListener("submit", handleAddWard);',
'  document.getElementById("lab-add-form").addEventListener("submit", handleAddLab);',
'  document.getElementById("rad-add-form").addEventListener("submit", handleAddRad);',
'  document.getElementById("inv-item-form").addEventListener("submit", handleAddInvItem);',
'  document.getElementById("inv-grn-form").addEventListener("submit", handleAddGrn);',
'  document.getElementById("bio-eq-form").addEventListener("submit", handleAddBioEq);',
'  document.getElementById("bio-wo-form").addEventListener("submit", handleAddBioWo);',
'  document.getElementById("fin-add-form").addEventListener("submit", handleAddFinance);',
'  document.getElementById("rep-run-btn").addEventListener("click", runCustomReport);',
'  document.getElementById("doctor-form").addEventListener("submit", handleAddDoctor);',
'  document.getElementById("user-form").addEventListener("submit", handleSaveUser);',
'  document.getElementById("user-reset-form-btn").addEventListener("click", resetUserForm);',
'  document.getElementById("inst-logo-file").addEventListener("change", handleLogoFileSelect);',
'  document.getElementById("institute-form").addEventListener("submit", handleSaveInstitute);',
'  document.getElementById("download-backup-json-btn").addEventListener("click", downloadBackupJson);',
'  document.getElementById("export-backup-csv-btn").addEventListener("click", exportBackupCsv);',
'  document.getElementById("password-change-form").addEventListener("submit", handleChangePassword);',
'  document.getElementById("ar-ai-btn").addEventListener("click", function () { const box = document.getElementById("ar-ai-box"); box.style.display = box.style.display === "flex" ? "none" : "flex"; });',
'  document.getElementById("ai-close-btn").addEventListener("click", function () { document.getElementById("ar-ai-box").style.display = "none"; });',
'  document.getElementById("ai-send-btn").addEventListener("click", sendAiQuery);',
'  document.getElementById("ai-input").addEventListener("keypress", function (e) { if (e.key === "Enter") sendAiQuery(); });',
'  ["opt-batch","opt-mfgexp","opt-hsn","opt-mrp","opt-gst","opt-bank","opt-terms"].forEach(function (id) { document.getElementById(id).addEventListener("change", applyPrintOptions); });',
'  document.getElementById("print-modal-close-btn").addEventListener("click", function () { document.getElementById("print-modal").style.display = "none"; });',
'  document.getElementById("print-modal-presc-btn").addEventListener("click", function () { openPrescriptionSheet(document.getElementById("pb-uhid").innerText); });',
'  document.getElementById("print-modal-edit-btn").addEventListener("click", requestBillEdit);',
'  document.getElementById("print-modal-print-btn").addEventListener("click", function () { applyPrintOptions(); window.print(); });',
'  document.getElementById("presc-close-btn").addEventListener("click", function () { document.getElementById("prescription-modal").style.display = "none"; });',
'  document.getElementById("presc-print-btn").addEventListener("click", function () { window.print(); });',
'  document.getElementById("forgot-link").addEventListener("click", function (e) { e.preventDefault(); alert("Contact Super Admin (Aarif) to reset credentials."); });',
'});',

'function renderPermissionCheckboxes() {',
'  const box = document.getElementById("perm-checkboxes-box");',
'  const allItems = navGroups.flatMap(function (g) { return g.items; });',
'  box.innerHTML = allItems.map(function (it) {',
'    return "<label><input type=\\"checkbox\\" class=\\"u-perm-cb\\" value=\\"" + it[1] + "\\"> " + it[0] + "</label>";',
'  }).join("");',
'}',

'function getCheckedPermissions() {',
'  return Array.from(document.querySelectorAll(".u-perm-cb:checked")).map(function (cb) { return cb.value; });',
'}',

'function resetUserForm() {',
'  editingUserId = "";',
'  document.getElementById("user-form-title").innerText = "Create New User & Custom Permissions";',
'  document.getElementById("user-save-btn").innerText = "Create User";',
'  document.getElementById("user-form").reset();',
'  document.querySelectorAll(".u-perm-cb").forEach(function (cb) { cb.checked = false; });',
'}',

'function initSession(pageKey) {',
'  document.getElementById("user-display-name").innerText = currentUser.name;',
'  document.getElementById("user-display-role").innerText = currentUser.role;',
'  document.getElementById("user-avatar").innerText = currentUser.name.slice(0, 2).toUpperCase();',
'  document.getElementById("login-screen").style.display = "none";',
'  document.getElementById("app").style.display = "flex";',
'  renderNav(); loadDoctors(); loadPharmacyStock(); loadInstituteDetails(); switchView(pageKey);',
'}',

'async function handleLogin(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: document.getElementById("login-u").value, password: document.getElementById("login-p").value }) });',
'  const data = await res.json();',
'  if (data.success) { currentUser = data.user; localStorage.setItem("ar_erp_active_user", JSON.stringify(currentUser)); localStorage.setItem("ar_erp_active_page", "dashboard"); initSession("dashboard"); }',
'  else alert(data.message || "Login Failed");',
'}',

'function handleLogout() { localStorage.removeItem("ar_erp_active_user"); localStorage.removeItem("ar_erp_active_page"); location.reload(); }',

'function renderNav() {',
'  let html = "";',
'  navGroups.forEach(function (g, gIdx) {',
'    let itemsHtml = "";',
'    g.items.forEach(function (i) {',
'      const allowed = currentUser.role === "Super Admin" || (Array.isArray(currentUser.permissions) && (currentUser.permissions.includes("all") || currentUser.permissions.includes(i[1])));',
'      if (allowed) {',
'        itemsHtml += "<button class=\\"nav-item " + (i[1] === activeModuleKey ? "active" : "") + "\\" id=\\"nav-btn-" + i[1] + "\\" data-key=\\"" + i[1] + "\\" data-gidx=\\"" + gIdx + "\\"><span>[" + i[2] + "]</span><span>" + i[0] + "</span></button>";',
'      }',
'    });',
'    if (itemsHtml) {',
'      const isOpen = (gIdx === openGroupIdx) || g.items.some(function (x) { return x[1] === activeModuleKey; });',
'      html += "<button type=\\"button\\" class=\\"nav-group-btn\\" data-gidx=\\"" + gIdx + "\\"><span>" + g.label + "</span><span>" + (isOpen ? "[-]" : "[+]") + "</span></button>";',
'      html += "<div class=\\"nav-group-items " + (isOpen ? "open" : "") + "\\" id=\\"nav-grp-" + gIdx + "\\">" + itemsHtml + "</div>";',
'    }',
'  });',
'  const nav = document.getElementById("nav-menu"); nav.innerHTML = html;',
'  nav.querySelectorAll(".nav-group-btn").forEach(function (gb) {',
'    gb.addEventListener("click", function () {',
'      const idx = Number(gb.getAttribute("data-gidx"));',
'      openGroupIdx = openGroupIdx === idx ? -1 : idx;',
'      renderNav();',
'    });',
'  });',
'  nav.querySelectorAll(".nav-item").forEach(function (btn) {',
'    btn.addEventListener("click", function () {',
'      openGroupIdx = Number(btn.getAttribute("data-gidx"));',
'      switchView(btn.getAttribute("data-key"));',
'    });',
'  });',
'}',

'async function loadDoctors() {',
'  const res = await fetch("/api/doctors"); doctorsList = await res.json();',
'  let opt = "<option value=\\"\\">-- Select Doctor --</option>";',
'  doctorsList.forEach(function (d) { opt += "<option value=\\"" + d.name + "\\">" + d.name + " (₹" + d.fee + ")</option>"; });',
'  ["reg-doctor", "opd-doctor", "ipd-doctor"].forEach(function (id) { const el = document.getElementById(id); if (el) el.innerHTML = opt; });',
'}',

'async function loadPharmacyStock() {',
'  const res = await fetch("/api/pharmacy/stock"); pharmacyStockList = await res.json();',
'  const sel = document.getElementById("ps-med-select");',
'  if (sel) {',
'    sel.innerHTML = pharmacyStockList.map(function (m, idx) {',
'      return "<option value=\\"" + idx + "\\">" + m.itemName + " | Batch: " + m.batch + " | Stock: " + m.qty + " | Rate: ₹" + m.rate + " | GST: " + m.gstPct + "%</option>";',
'    }).join("");',
'  }',
'  renderStockAuditTable();',
'}',

'function applyPatientTypeFee() {',
'  const pType = document.getElementById("reg-ptype").value;',
'  document.getElementById("reg-emg-fee").value = pType === "Emergency" ? (instituteDetails.emergencyFee || 250) : 0;',
'  calcRegNet();',
'}',

'function calcRegNet() {',
'  const fee = Number(document.getElementById("reg-fee").value || 0);',
'  const emg = Number(document.getElementById("reg-emg-fee").value || 0);',
'  const disc = Number(document.getElementById("reg-discount").value || 0);',
'  document.getElementById("reg-netfee").value = Math.max(0, fee + emg - disc);',
'}',

'function hideAllPanels() {',
'  ["sub-dashboard-stats","patient-reg-panel","pharmacy-sale-panel","pharmacy-purchase-panel","pharmacy-audit-panel","pharmacy-return-panel","pharmacy-med-panel","abdm-panel","opd-panel","ipd-panel","wards-panel","lab-panel","radiology-panel","inventory-panel","biomed-panel","finance-panel","custom-report-panel","doctor-panel","user-mgmt-panel","backup-panel","password-panel","generic-table-panel"].forEach(function (id) {',
'    const el = document.getElementById(id); if (el) el.style.display = "none";',
'  });',
'}',

'async function switchView(key) {',
'  activeModuleKey = key; localStorage.setItem("ar_erp_active_page", key);',
'  renderNav();',
'  document.querySelectorAll(".view-section").forEach(function (v) { v.classList.remove("active"); });',
'  const found = navGroups.flatMap(function (g) { return g.items; }).find(function (i) { return i[1] === key; });',
'  document.getElementById("topbar-title").innerText = (found ? found[0] : key).toUpperCase();',

'  if (key === "dashboard") { document.getElementById("view-dashboard").classList.add("active"); loadHospitalDashboard(); return; }',

'  document.getElementById("view-module-container").classList.add("active");',
'  hideAllPanels();',

'  if (key === "patients" || key === "patient-search") { document.getElementById("patient-reg-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; const r = await fetch("/api/next-uhid"); const d = await r.json(); document.getElementById("reg-uhid").value = d.uhid; applyPatientTypeFee(); }',
'  if (key === "sales-billing") { document.getElementById("pharmacy-sale-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; loadPharmacyStock(); renderSaleCart(); }',
'  if (key === "purchase-entry") { document.getElementById("pharmacy-purchase-panel").style.display = "block"; renderPurchaseInvoiceItems(); await loadPurchaseLedger(); }',
'  if (key === "stock-audit") { document.getElementById("pharmacy-audit-panel").style.display = "block"; await loadPharmacyStock(); }',
'  if (key === "sales-return") { document.getElementById("pharmacy-return-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "pharmacy" || key === "medicines" || key === "stock-alerts") { document.getElementById("pharmacy-med-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "abdm-hims" || key === "nhcx") { document.getElementById("abdm-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "opd") { document.getElementById("opd-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "ipd") { document.getElementById("ipd-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "wards") { document.getElementById("wards-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "lab") { document.getElementById("lab-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "radiology") { document.getElementById("radiology-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (["inv-dash","item-master","warehouses","grn","stock-ledger","po"].includes(key)) { document.getElementById("inventory-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (["biomed-dash","equipment","repairs","amc"].includes(key)) { document.getElementById("biomed-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (["accounts","payroll"].includes(key)) { document.getElementById("finance-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "reports") { document.getElementById("custom-report-panel").style.display = "block"; const today = new Date().toISOString().slice(0,10); if (!document.getElementById("rep-from").value) document.getElementById("rep-from").value = today; if (!document.getElementById("rep-to").value) document.getElementById("rep-to").value = today; runCustomReport(); }',
'  if (key === "doctors") { document.getElementById("doctor-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "users") { document.getElementById("user-mgmt-panel").style.display = "block"; document.getElementById("generic-table-panel").style.display = "block"; }',
'  if (key === "backup") { document.getElementById("backup-panel").style.display = "block"; loadInstituteDetails(); }',
'  if (key === "password") { document.getElementById("password-panel").style.display = "block"; }',
'  if (["audit-logs","hospital-billing"].includes(key)) { document.getElementById("generic-table-panel").style.display = "block"; }',

'  await renderSubDashboardStats(key);',
'  if (document.getElementById("generic-table-panel").style.display !== "none") await loadModuleTable(key);',
'}',

'async function renderSubDashboardStats(key) {',
'  const box = document.getElementById("sub-dashboard-stats");',
'  const res = await fetch("/api/dashboard/metrics"); const m = await res.json();',
'  if (!m.success) return;',
'  if (["pharmacy","medicines","purchase-entry","sales-billing","sales-return","stock-audit","stock-alerts"].includes(key)) {',
'    box.style.display = "grid";',
'    box.innerHTML = "<div class=\\"stat\\"><div class=\\"stat-label\\">PHARMACY SALES</div><div class=\\"stat-value\\" style=\\"color:var(--green);\\">₹" + m.pharmacySales.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">PHARMACY PURCHASE</div><div class=\\"stat-value\\" style=\\"color:var(--navy);\\">₹" + m.pharmacyPurchase.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">CREDIT PURCHASE DUE</div><div class=\\"stat-value\\" style=\\"color:var(--red);\\">₹" + m.pharmacyCreditDue.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">MEDICINE BATCHES</div><div class=\\"stat-value\\">" + m.pharmacyStockCount + "</div></div>";',
'  } else if (["biomed-dash","equipment","repairs","amc"].includes(key)) {',
'    box.style.display = "grid";',
'    box.innerHTML = "<div class=\\"stat\\"><div class=\\"stat-label\\">BME ASSETS</div><div class=\\"stat-value\\">" + m.biomedAssetsCount + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">WORK ORDERS</div><div class=\\"stat-value\\">" + m.biomedWorkOrdersCount + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">AMC / CMC COST</div><div class=\\"stat-value\\">₹" + m.biomedContractCost.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">DEPT SCOPE</div><div class=\\"stat-value\\">BME ONLY</div></div>";',
'  } else if (["inv-dash","item-master","warehouses","grn","stock-ledger","po"].includes(key)) {',
'    box.style.display = "grid";',
'    box.innerHTML = "<div class=\\"stat\\"><div class=\\"stat-label\\">STORE ITEMS</div><div class=\\"stat-value\\">" + m.inventoryItemsCount + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">INVENTORY STOCK VALUE</div><div class=\\"stat-value\\">₹" + m.inventoryValue.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">STORE SCOPE</div><div class=\\"stat-value\\">CENTRAL STORE</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">LEDGER TRACKED</div><div class=\\"stat-value\\">LIVE</div></div>";',
'  } else if (["accounts","payroll"].includes(key)) {',
'    box.style.display = "grid";',
'    box.innerHTML = "<div class=\\"stat\\"><div class=\\"stat-label\\">HOSPITAL BILLING</div><div class=\\"stat-value\\">₹" + m.hospitalRevenue.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">PHARMACY SALES</div><div class=\\"stat-value\\">₹" + m.pharmacySales.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">PHARMACY PURCHASE</div><div class=\\"stat-value\\" style=\\"color:var(--red);\\">₹" + m.pharmacyPurchase.toFixed(2) + "</div></div>" +',
'      "<div class=\\"stat\\"><div class=\\"stat-label\\">CREDIT / UDHAR</div><div class=\\"stat-value\\" style=\\"color:var(--red);\\">₹" + m.creditTotal.toFixed(2) + "</div></div>";',
'  }',
'}',

'async function loadHospitalDashboard() {',
'  const res = await fetch("/api/dashboard/metrics"); const m = await res.json();',
'  if (m.success) {',
'    document.getElementById("m-hosp-rev").innerText = "₹" + m.hospitalRevenue.toFixed(2);',
'    document.getElementById("m-pat").innerText = m.registeredPatients;',
'    document.getElementById("m-ipd").innerText = m.activeIpdBeds + " / " + m.totalBeds;',
'    document.getElementById("m-credit").innerText = "₹" + m.creditTotal.toFixed(2);',
'  }',
'  const pRes = await fetch("/api/module/patients"); const pJson = await pRes.json();',
'  const tbody = document.getElementById("dash-patients");',
'  tbody.innerHTML = (pJson.data || []).map(function (p) {',
'    const badgeColor = (p.patientType === "Emergency") ? "color:var(--red);font-weight:900;" : "color:var(--green);font-weight:800;";',
'    return "<tr><td><b>" + p.uhid + "</b></td><td>" + p.title + " " + p.name + "</td><td style=\\"" + badgeColor + "\\">" + (p.patientType || "Normal") + "</td><td>" + p.contact + "</td><td>" + (p.abha || "-") + "</td><td>" + p.doctor + "</td><td>₹" + Number(p.netFee || 0).toFixed(2) + " (" + p.payType + ")</td>" +',
'      "<td><button class=\\"btn primary dash-rx\\" data-uhid=\\"" + p.uhid + "\\">Rx</button> <button class=\\"btn success dash-bill\\" data-uhid=\\"" + p.uhid + "\\">Bill</button></td></tr>";',
'  }).join("");',
'  tbody.querySelectorAll(".dash-rx").forEach(function (b) { b.addEventListener("click", function () { openPrescriptionSheet(b.getAttribute("data-uhid")); }); });',
'  tbody.querySelectorAll(".dash-bill").forEach(function (b) { b.addEventListener("click", function () { openBillingModalByUHID(b.getAttribute("data-uhid"), "Hospital"); }); });',
'}',

'async function loadModuleTable(key) {',
'  document.getElementById("module-title-heading").innerText = key.toUpperCase().replace(/-/g, " ") + " TABLE";',
'  const res = await fetch("/api/module/" + key); const json = await res.json();',
'  let list = json.data || [];',
'  if (key === "users") usersList = list;',
'  if (key === "stock-alerts") {',
'    list = list.filter(function (m) { return Number(m.qty || 0) <= Number(m.reorderLevel || 20); });',
'  }',
'  if (list.length && list[0].items && !list[0].invoiceNo) {',
'    list = list.map(function (b) { return { billNo: b.billNo, type: b.billType, patientType: b.patientType || "-", date: b.date, uhid: b.uhid, patient: b.patientName, payMode: b.payType, gross: b.totalGross, disc: b.totalDisc, gst: b.totalGst, netTotal: b.netFee }; });',
'  }',
'  if (!list.length) {',
'    document.getElementById("module-thead").innerHTML = "<tr><th>Info</th></tr>";',
'    document.getElementById("module-tbody").innerHTML = "<tr><td style=\\"text-align:center;color:var(--muted);\\">No records in this module.</td></tr>";',
'    return;',
'  }',
'  const cols = Object.keys(list[0]).filter(function (k) { return k !== "password"; });',
'  const hasBill = list[0].billNo !== undefined;',
'  document.getElementById("module-thead").innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + (hasBill ? "<th>Print</th>" : "") + (key === "users" ? "<th>Edit & Status</th>" : "") + "</tr>";',
'  const tbody = document.getElementById("module-tbody");',
'  tbody.innerHTML = list.map(function (row) {',
'    let tr = "<tr>" + cols.map(function (c) { const val = Array.isArray(row[c]) ? row[c].join(", ") : row[c]; return "<td>" + (val !== undefined && val !== null && val !== "" ? val : "-") + "</td>"; }).join("");',
'    if (hasBill) tr += "<td><button class=\\"btn primary open-inv-btn\\" data-billno=\\"" + row.billNo + "\\">Print Bill</button></td>";',
'    if (key === "users") {',
'      tr += "<td><button class=\\"btn primary usr-edit-btn\\" data-id=\\"" + row.id + "\\">Edit / Perms</button>";',
'      if (!row.isProtected) { const nextSt = row.status === "Active" ? "Deactivated" : "Active"; tr += " <button class=\\"btn " + (nextSt === "Active" ? "success" : "danger") + " usr-st-btn\\" data-id=\\"" + row.id + "\\" data-st=\\"" + nextSt + "\\">" + nextSt + "</button>"; }',
'      tr += "</td>";',
'    }',
'    return tr + "</tr>";',
'  }).join("");',
'  tbody.querySelectorAll(".open-inv-btn").forEach(function (b) { b.addEventListener("click", function () { openBillingModalByBillNo(b.getAttribute("data-billno")); }); });',
'  tbody.querySelectorAll(".usr-edit-btn").forEach(function (b) { b.addEventListener("click", function () { startEditUser(b.getAttribute("data-id")); }); });',
'  tbody.querySelectorAll(".usr-st-btn").forEach(function (b) { b.addEventListener("click", async function () { await fetch("/api/users/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: b.getAttribute("data-id"), status: b.getAttribute("data-st") }) }); loadModuleTable("users"); }); });',
'}',

'function startEditUser(userId) {',
'  const u = usersList.find(function (x) { return x.id === userId; });',
'  if (!u) return;',
'  editingUserId = u.id;',
'  document.getElementById("user-form-title").innerText = "Edit User & Permissions: " + u.name;',
'  document.getElementById("user-save-btn").innerText = "Update User & Permissions";',
'  document.getElementById("new-u-name").value = u.name;',
'  document.getElementById("new-u-username").value = u.username;',
'  document.getElementById("new-u-password").value = u.password;',
'  document.getElementById("new-u-role").value = u.role;',
'  const hasAll = Array.isArray(u.permissions) && u.permissions.includes("all");',
'  document.querySelectorAll(".u-perm-cb").forEach(function (cb) {',
'    cb.checked = hasAll || (Array.isArray(u.permissions) && u.permissions.includes(cb.value));',
'  });',
'}',

'async function handleSaveUser(e) {',
'  e.preventDefault();',
'  const perms = getCheckedPermissions();',
'  const payload = {',
'    userId: editingUserId,',
'    name: document.getElementById("new-u-name").value,',
'    username: document.getElementById("new-u-username").value,',
'    password: document.getElementById("new-u-password").value,',
'    role: document.getElementById("new-u-role").value,',
'    permissions: perms.length ? perms : ["dashboard"]',
'  };',
'  const url = editingUserId ? "/api/users/update" : "/api/users/create";',
'  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });',
'  const d = await res.json(); alert(d.message);',
'  if (d.success) { resetUserForm(); loadModuleTable("users"); }',
'}',

// Multi-Item Purchase Invoice Functions
'function addPurchaseInvoiceItem() {',
'  const name = document.getElementById("pp-name").value.trim();',
'  const batch = document.getElementById("pp-batch").value.trim() || "B01";',
'  const mfgExp = document.getElementById("pp-mfgexp").value.trim() || "- / -";',
'  const hsn = document.getElementById("pp-hsn").value.trim() || "30045031";',
'  const qty = Math.max(1, Number(document.getElementById("pp-qty").value || 1));',
'  const mrp = Number(document.getElementById("pp-mrp").value || document.getElementById("pp-rate").value || 0);',
'  const rate = Number(document.getElementById("pp-rate").value || 0);',
'  const gstPct = Number(document.getElementById("pp-gst").value || 12);',
'  if (!name || rate <= 0) { alert("Enter Medicine Name and valid Purchase Rate."); return; }',
'  const lineTotal = Number((qty * rate * (1 + gstPct / 100)).toFixed(2));',
'  purchaseInvoiceItems.push({ itemName: name, batch: batch, mfgExp: mfgExp, hsn: hsn, qty: qty, mrp: mrp, rate: rate, gstPct: gstPct, totalAmount: lineTotal });',
'  document.getElementById("pp-name").value = "";',
'  document.getElementById("pp-batch").value = "";',
'  document.getElementById("pp-rate").value = "";',
'  renderPurchaseInvoiceItems();',
'}',

'function renderPurchaseInvoiceItems() {',
'  const tbody = document.getElementById("pp-items-tbody");',
'  tbody.innerHTML = purchaseInvoiceItems.map(function (it, i) {',
'    return "<tr><td>" + it.itemName + "</td><td>" + it.batch + "</td><td>" + it.mfgExp + "</td><td>" + it.hsn + "</td><td>" + it.qty + "</td><td>₹" + Number(it.mrp).toFixed(2) + "</td><td>₹" + Number(it.rate).toFixed(2) + "</td><td>" + it.gstPct + "%</td><td><b>₹" + Number(it.totalAmount).toFixed(2) + "</b></td><td><button type=\\"button\\" class=\\"btn danger rm-pur-it\\" data-i=\\"" + i + "\\">X</button></td></tr>";',
'  }).join("") || "<tr><td colspan=\\"10\\" style=\\"text-align:center;color:var(--muted);\\">Add medicines above to build multi-item purchase invoice.</td></tr>";',
'  tbody.querySelectorAll(".rm-pur-it").forEach(function (b) { b.addEventListener("click", function () { purchaseInvoiceItems.splice(Number(b.getAttribute("data-i")), 1); renderPurchaseInvoiceItems(); }); });',
'}',

'async function submitPurchaseInvoice(e) {',
'  e.preventDefault();',
'  if (!purchaseInvoiceItems.length) { addPurchaseInvoiceItem(); }',
'  if (!purchaseInvoiceItems.length) return;',
'  const res = await fetch("/api/pharmacy/purchase/invoice", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({',
'      vendor: document.getElementById("pp-vendor").value,',
'      invoiceNo: document.getElementById("pp-inv").value,',
'      payType: document.getElementById("pp-paytype").value,',
'      chequeNo: document.getElementById("pp-cheque").value,',
'      items: purchaseInvoiceItems',
'    })',
'  });',
'  const data = await res.json(); alert(data.message);',
'  if (data.success) {',
'    purchaseInvoiceItems = [];',
'    renderPurchaseInvoiceItems();',
'    document.getElementById("pharmacy-purchase-form").reset();',
'    loadPharmacyStock();',
'    await loadPurchaseLedger();',
'    renderSubDashboardStats("purchase-entry");',
'  }',
'}',

'async function loadPurchaseLedger() {',
'  const res = await fetch("/api/pharmacy/purchases");',
'  pharmacyPurchasesList = await res.json();',
'  renderPurchaseLedgerTable();',
'}',

'function renderPurchaseLedgerTable() {',
'  const q = (document.getElementById("pp-ledger-search").value || "").trim().toLowerCase();',
'  const filtered = pharmacyPurchasesList.filter(function (p) {',
'    if (!q) return true;',
'    return (p.invoiceNo || "").toLowerCase().includes(q) || (p.vendor || "").toLowerCase().includes(q) || (p.itemsSummary || "").toLowerCase().includes(q);',
'  });',
'  const tbody = document.getElementById("pp-ledger-tbody");',
'  tbody.innerHTML = filtered.map(function (p) {',
'    const isDue = p.paymentStatus === "Credit Due";',
'    const stBadge = isDue ? "<span style=\\"color:var(--red);font-weight:900;\\">Credit Due</span>" : "<span style=\\"color:var(--green);font-weight:900;\\">Paid (" + p.payType + ")</span>";',
'    const actBtn = isDue ? "<button type=\\"button\\" class=\\"btn warn settle-pur-btn\\" data-id=\\"" + p.purId + "\\">Mark Paid</button>" : "-";',
'    return "<tr><td>" + p.purId + "</td><td>" + p.date + "</td><td><b>" + p.invoiceNo + "</b></td><td><b>" + p.vendor + "</b></td><td>" + p.itemsSummary + "</td><td>" + p.payType + "</td><td>" + (p.chequeNo || "-") + "</td><td>" + stBadge + "</td><td><b>₹" + Number(p.totalAmount).toFixed(2) + "</b></td><td>" + actBtn + "</td></tr>";',
'  }).join("") || "<tr><td colspan=\\"10\\" style=\\"text-align:center;color:var(--muted);\\">No purchase records matching search.</td></tr>";',
'  tbody.querySelectorAll(".settle-pur-btn").forEach(function (btn) {',
'    btn.addEventListener("click", async function () {',
'      const purId = btn.getAttribute("data-id");',
'      const mode = prompt("Enter Payment Mode (Cash / Cheque):", "Cash");',
'      if (!mode) return;',
'      const chq = mode.toLowerCase().includes("cheque") ? (prompt("Enter Cheque No:", "") || "") : "";',
'      const r = await fetch("/api/pharmacy/purchase/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purId: purId, settleMode: mode, chequeNo: chq }) });',
'      const d = await r.json(); alert(d.message);',
'      if (d.success) { await loadPurchaseLedger(); renderSubDashboardStats("purchase-entry"); }',
'    });',
'  });',
'}',

// Pharmacy Stock Audit Functions
'function renderStockAuditTable() {',
'  const tbody = document.getElementById("audit-stock-tbody");',
'  if (!tbody) return;',
'  const q = ((document.getElementById("audit-search-input") && document.getElementById("audit-search-input").value) || "").trim().toLowerCase();',
'  const rows = pharmacyStockList.filter(function (m) {',
'    if (!q) return true;',
'    return (m.itemName || "").toLowerCase().includes(q) || (m.batch || "").toLowerCase().includes(q) || (m.itemCode || "").toLowerCase().includes(q);',
'  });',
'  tbody.innerHTML = rows.map(function (m, idx) {',
'    const sysQty = Number(m.qty || 0);',
'    const phyQty = Number(m.physicalQty !== undefined ? m.physicalQty : sysQty);',
'    const diff = Number((phyQty - sysQty).toFixed(2));',
'    const status = diff > 0 ? "Extra Stock" : (diff < 0 ? "Short Stock" : "Matched");',
'    const color = diff > 0 ? "color:var(--blue);font-weight:900;" : (diff < 0 ? "color:var(--red);font-weight:900;" : "color:var(--green);font-weight:900;");',
'    const valDiff = Number((diff * Number(m.rate || 0)).toFixed(2));',
'    return "<tr><td>" + m.itemCode + "</td><td><b>" + m.itemName + "</b></td><td>" + m.batch + "</td><td>" + sysQty + "</td>" +',
'      "<td><input type=\\"number\\" class=\\"aud-phy-inp\\" data-code=\\"" + m.itemCode + "\\" value=\\"" + phyQty + "\\" style=\\"width:80px;padding:5px;border:1px solid var(--line);border-radius:6px;font-weight:800;\\"></td>" +',
'      "<td class=\\"aud-diff-cell\\" style=\\"" + color + "\\">" + diff + "</td>" +',
'      "<td class=\\"aud-st-cell\\" style=\\"" + color + "\\">" + status + "</td>" +',
'      "<td>₹" + Number(m.rate || 0).toFixed(2) + "</td>" +',
'      "<td class=\\"aud-val-cell\\">₹" + valDiff.toFixed(2) + "</td>" +',
'      "<td><button type=\\"button\\" class=\\"btn primary aud-save-btn\\" data-code=\\"" + m.itemCode + "\\">Save Audit</button></td></tr>";',
'  }).join("");',

'  tbody.querySelectorAll(".aud-phy-inp").forEach(function (inp) {',
'    inp.addEventListener("input", function () {',
'      const code = inp.getAttribute("data-code");',
'      const m = pharmacyStockList.find(function (x) { return x.itemCode === code; });',
'      if (!m) return;',
'      const phy = Number(inp.value || 0);',
'      const diff = Number((phy - Number(m.qty || 0)).toFixed(2));',
'      const tr = inp.closest("tr");',
'      tr.querySelector(".aud-diff-cell").innerText = diff;',
'      tr.querySelector(".aud-st-cell").innerText = diff > 0 ? "Extra Stock" : (diff < 0 ? "Short Stock" : "Matched");',
'      tr.querySelector(".aud-val-cell").innerText = "₹" + (diff * Number(m.rate || 0)).toFixed(2);',
'    });',
'  });',

'  tbody.querySelectorAll(".aud-save-btn").forEach(function (btn) {',
'    btn.addEventListener("click", async function () {',
'      const code = btn.getAttribute("data-code");',
'      const tr = btn.closest("tr");',
'      const phyVal = Number(tr.querySelector(".aud-phy-inp").value || 0);',
'      const sync = confirm("Update System Stock to Physical Stock (" + phyVal + ")?");',
'      const r = await fetch("/api/pharmacy/audit/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemCode: code, physicalQty: phyVal, syncStock: sync }) });',
'      const d = await r.json(); alert(d.message);',
'      if (d.success) loadPharmacyStock();',
'    });',
'  });',
'}',

'function exportStockAuditCsv() {',
'  const lines = ["Item Code,Medicine Name,Batch,System Stock,Physical Stock,Diff Qty,Status,Rate,Value Diff"];',
'  pharmacyStockList.forEach(function (m) {',
'    const sys = Number(m.qty || 0);',
'    const phy = Number(m.physicalQty !== undefined ? m.physicalQty : sys);',
'    const diff = phy - sys;',
'    const st = diff > 0 ? "Extra Stock" : (diff < 0 ? "Short Stock" : "Matched");',
'    const vDiff = (diff * Number(m.rate || 0)).toFixed(2);',
'    lines.push("\\"" + m.itemCode + "\\",\\"" + m.itemName + "\\",\\"" + m.batch + "\\"," + sys + "," + phy + "," + diff + ",\\"" + st + "\\"," + m.rate + "," + vDiff);',
'  });',
'  const blob = new Blob([lines.join("\\n")], { type: "text/csv;charset=utf-8;" });',
'  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Pharmacy_Stock_Audit_" + new Date().toISOString().slice(0,10) + ".csv"; a.click();',
'}',

// Backup & Export Functions
'async function downloadBackupJson() {',
'  const res = await fetch("/api/backup/export"); const d = await res.json();',
'  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });',
'  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "AR_ERP_Backup_" + new Date().toISOString().slice(0,10) + ".json"; a.click();',
'}',

'async function exportBackupCsv() {',
'  const res = await fetch("/api/backup/export"); const d = await res.json();',
'  const lines = ["Module,Ref No,Date,Party/Patient,Amount"];',
'  (d.erpData.bills || []).forEach(function (b) { lines.push("\\"" + b.billType + "\\",\\"" + b.billNo + "\\",\\"" + b.date + "\\",\\"" + b.patientName + "\\"," + b.netFee); });',
'  (d.erpData.pharmacyPurchases || []).forEach(function (p) { lines.push("\\"Pharmacy Purchase\\",\\"" + p.invoiceNo + "\\",\\"" + p.date + "\\",\\"" + p.vendor + "\\"," + p.totalAmount); });',
'  const blob = new Blob([lines.join("\\n")], { type: "text/csv;charset=utf-8;" });',
'  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "AR_ERP_Report_Export_" + new Date().toISOString().slice(0,10) + ".csv"; a.click();',
'}',

'function handleLogoFileSelect(e) {',
'  const file = e.target.files && e.target.files[0];',
'  if (!file) return;',
'  const reader = new FileReader();',
'  reader.onload = function (ev) {',
'    instituteDetails.logoDataUrl = ev.target.result;',
'    const prev = document.getElementById("inst-logo-preview");',
'    prev.src = ev.target.result; prev.style.display = "inline-block";',
'  };',
'  reader.readAsDataURL(file);',
'}',

'function addItemToSaleCart() {',
'  const idx = Number(document.getElementById("ps-med-select").value || 0);',
'  const med = pharmacyStockList[idx];',
'  if (!med) { alert("No medicine stock found"); return; }',
'  const qty = Math.max(1, Number(document.getElementById("ps-qty").value || 1));',
'  const discPct = Number(document.getElementById("ps-disc").value || 0);',
'  const taxable = (qty * Number(med.rate || 0)) * (1 - discPct / 100);',
'  const lineTotal = taxable * (1 + Number(med.gstPct || 0) / 100);',
'  saleCart.push({ itemCode: med.itemCode, name: med.itemName, batch: med.batch, mfg: med.mfgDate, exp: med.expDate, hsn: med.hsn, qty: qty, unit: med.unit, mrp: med.mrp, rate: med.rate, discPct: discPct, gstPct: med.gstPct, lineTotal: Number(lineTotal.toFixed(2)) });',
'  renderSaleCart();',
'}',

'function renderSaleCart() {',
'  const tbody = document.getElementById("ps-cart-tbody");',
'  tbody.innerHTML = saleCart.map(function (it, i) {',
'    return "<tr><td>" + it.name + "</td><td>" + it.batch + "</td><td>" + it.mfg + " / " + it.exp + "</td><td>" + it.hsn + "</td><td>" + it.qty + "</td><td>₹" + Number(it.mrp).toFixed(2) + "</td><td>₹" + Number(it.rate).toFixed(2) + "</td><td>" + it.discPct + "%</td><td>" + it.gstPct + "%</td><td><b>₹" + Number(it.lineTotal).toFixed(2) + "</b></td><td><button type=\\"button\\" class=\\"btn danger rm-cart\\" data-i=\\"" + i + "\\">X</button></td></tr>";',
'  }).join("");',
'  tbody.querySelectorAll(".rm-cart").forEach(function (b) { b.addEventListener("click", function () { saleCart.splice(Number(b.getAttribute("data-i")), 1); renderSaleCart(); }); });',
'}',

'async function submitPharmacySaleBill() {',
'  if (!saleCart.length) { alert("Add at least 1 medicine first."); return; }',
'  const res = await fetch("/api/pharmacy/sale/create", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ patientName: document.getElementById("ps-name").value || "Counter Customer", contact: document.getElementById("ps-phone").value || "", payType: document.getElementById("ps-paytype").value, createdBy: currentUser.name, items: saleCart })',
'  });',
'  const data = await res.json();',
'  if (data.success) { saleCart = []; renderSaleCart(); loadPharmacyStock(); renderBillModal(data.bill); }',
'  else alert(data.message);',
'}',

'async function handlePharmacyReturn(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/pharmacy/return/create", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ refBillNo: document.getElementById("pr-billno").value, itemName: document.getElementById("pr-medname").value, batch: document.getElementById("pr-batch").value, qty: document.getElementById("pr-qty").value, refundAmount: document.getElementById("pr-refund").value, reason: document.getElementById("pr-reason").value })',
'  });',
'  const data = await res.json(); alert(data.message);',
'  if (data.success) { document.getElementById("pharmacy-return-form").reset(); switchView(activeModuleKey); }',
'}',

'async function handleAddMedicine(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/pharmacy/medicine/add", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ itemName: document.getElementById("pm-name").value, batch: document.getElementById("pm-batch").value, mfgDate: document.getElementById("pm-mfg").value, expDate: document.getElementById("pm-exp").value, hsn: document.getElementById("pm-hsn").value, qty: document.getElementById("pm-qty").value, mrp: document.getElementById("pm-mrp").value, rate: document.getElementById("pm-rate").value, gstPct: document.getElementById("pm-gst").value })',
'  });',
'  const data = await res.json(); alert(data.message);',
'  if (data.success) { document.getElementById("pharmacy-med-form").reset(); loadPharmacyStock(); switchView(activeModuleKey); }',
'}',

'async function handlePatientReg(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/patients/register", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ existingUhid: document.getElementById("reg-uhid").value, title: document.getElementById("reg-title").value, name: document.getElementById("reg-name").value, patientType: document.getElementById("reg-ptype").value, relation: document.getElementById("reg-relation").value, guardian: document.getElementById("reg-guardian").value, age: document.getElementById("reg-age").value, gender: document.getElementById("reg-gender").value, contact: document.getElementById("reg-contact").value, adhaar: document.getElementById("reg-adhaar").value, abha: document.getElementById("reg-abha").value, address: document.getElementById("reg-address").value, doctor: document.getElementById("reg-doctor").value, fee: document.getElementById("reg-fee").value, emergencyCharge: document.getElementById("reg-emg-fee").value, discount: document.getElementById("reg-discount").value, netFee: document.getElementById("reg-netfee").value, payType: document.getElementById("reg-paytype").value, createdBy: currentUser.name })',
'  });',
'  const data = await res.json();',
'  if (data.success) { document.getElementById("patient-reg-form").reset(); document.getElementById("reg-discount").value = "0"; renderBillModal(data.bill); }',
'  else alert(data.message);',
'}',

'async function handleCreateAbha(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/abdm/create-abha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: document.getElementById("abdm-uhid").value, patientName: document.getElementById("abdm-name").value, mobileOrAadhaar: document.getElementById("abdm-ref").value, desiredAbha: document.getElementById("abdm-handle").value, m2CareContext: document.getElementById("abdm-m2").value }) });',
'  const data = await res.json(); alert(data.message + ": " + data.record.abhaAddress);',
'  if (data.success) { document.getElementById("abdm-create-form").reset(); loadModuleTable(activeModuleKey); }',
'}',

'async function handleNhcxClaim(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/nhcx/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: document.getElementById("nhcx-uhid").value, patientName: document.getElementById("nhcx-name").value, payer: document.getElementById("nhcx-payer").value, claimType: document.getElementById("nhcx-type").value, amount: document.getElementById("nhcx-amount").value }) });',
'  const data = await res.json(); alert(data.message);',
'  if (data.success) { document.getElementById("nhcx-claim-form").reset(); loadModuleTable(activeModuleKey); }',
'}',

'async function handleOpdBook(e) { e.preventDefault(); const u = document.getElementById("opd-uhid").value; const r = await fetch("/api/opd/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: u, patientName: u, patientType: document.getElementById("opd-ptype").value, doctor: document.getElementById("opd-doctor").value, slot: document.getElementById("opd-slot").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("opd-book-form").reset(); loadModuleTable("opd"); } }',
'async function handleIpdAdmit(e) { e.preventDefault(); const r = await fetch("/api/ipd/admit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: document.getElementById("ipd-uhid").value, patientName: document.getElementById("ipd-name").value, patientType: document.getElementById("ipd-ptype").value, ward: document.getElementById("ipd-ward").value, doctor: document.getElementById("ipd-doctor").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("ipd-admit-form").reset(); loadModuleTable("ipd"); } }',
'async function handleAddWard(e) { e.preventDefault(); const r = await fetch("/api/wards/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wardName: document.getElementById("w-name").value, totalBeds: document.getElementById("w-beds").value, dailyCharge: document.getElementById("w-charge").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("ward-add-form").reset(); loadModuleTable("wards"); } }',
'async function handleAddLab(e) { e.preventDefault(); const r = await fetch("/api/lab/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: document.getElementById("lab-uhid").value, patientName: document.getElementById("lab-name").value, testName: document.getElementById("lab-test").value, result: document.getElementById("lab-result").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("lab-add-form").reset(); loadModuleTable("lab"); } }',
'async function handleAddRad(e) { e.preventDefault(); const r = await fetch("/api/radiology/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uhid: document.getElementById("rad-uhid").value, patientName: document.getElementById("rad-name").value, modality: document.getElementById("rad-mod").value, finding: document.getElementById("rad-finding").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("rad-add-form").reset(); loadModuleTable("radiology"); } }',
'async function handleAddInvItem(e) { e.preventDefault(); const r = await fetch("/api/inventory/item/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: document.getElementById("inv-name").value, category: document.getElementById("inv-cat").value, warehouse: document.getElementById("inv-wh").value, stock: document.getElementById("inv-stock").value, unit: document.getElementById("inv-unit").value, rate: document.getElementById("inv-rate").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("inv-item-form").reset(); switchView(activeModuleKey); } }',
'async function handleAddGrn(e) { e.preventDefault(); const r = await fetch("/api/inventory/grn/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor: document.getElementById("grn-vendor").value, itemName: document.getElementById("grn-item").value, qty: document.getElementById("grn-qty").value, rate: document.getElementById("grn-rate").value, warehouse: document.getElementById("grn-wh").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("inv-grn-form").reset(); switchView(activeModuleKey); } }',
'async function handleAddBioEq(e) { e.preventDefault(); const r = await fetch("/api/biomed/equipment/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ equipment: document.getElementById("bio-name").value, department: document.getElementById("bio-dept").value, serialNo: document.getElementById("bio-serial").value, makeModel: document.getElementById("bio-model").value, amcStatus: document.getElementById("bio-amc").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("bio-eq-form").reset(); switchView(activeModuleKey); } }',
'async function handleAddBioWo(e) { e.preventDefault(); const r = await fetch("/api/biomed/wo/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ equipment: document.getElementById("wo-eq").value, department: document.getElementById("wo-dept").value, issue: document.getElementById("wo-issue").value, status: document.getElementById("wo-status").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("bio-wo-form").reset(); switchView(activeModuleKey); } }',
'async function handleAddFinance(e) { e.preventDefault(); const r = await fetch("/api/finance/entry/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceModule: document.getElementById("fin-mod").value, type: document.getElementById("fin-type").value, head: document.getElementById("fin-head").value, mode: document.getElementById("fin-mode").value, amount: document.getElementById("fin-amt").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("fin-add-form").reset(); switchView(activeModuleKey); } }',
'async function handleAddDoctor(e) { e.preventDefault(); const r = await fetch("/api/doctors/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: document.getElementById("doc-name").value, fee: document.getElementById("doc-fee").value, department: document.getElementById("doc-dept").value }) }); const d = await r.json(); alert(d.message); if (d.success) { document.getElementById("doctor-form").reset(); loadDoctors(); loadModuleTable("doctors"); } }',
'async function handleChangePassword(e) { e.preventDefault(); const r = await fetch("/api/users/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: currentUser.username, oldPassword: document.getElementById("pass-old").value, newPassword: document.getElementById("pass-new").value }) }); const d = await res.json(); alert(d.message); if (d.success) document.getElementById("password-change-form").reset(); }',

'async function runCustomReport() {',
'  const f = document.getElementById("rep-from").value; const t = document.getElementById("rep-to").value; const s = document.getElementById("rep-scope").value;',
'  const res = await fetch("/api/reports/custom?from=" + encodeURIComponent(f) + "&to=" + encodeURIComponent(t) + "&scope=" + encodeURIComponent(s));',
'  const data = await res.json();',
'  document.getElementById("rep-summary-badge").innerText = "Records: " + data.count + " | Total Amount: ₹" + Number(data.totalAmount || 0).toFixed(2);',
'  document.getElementById("rep-custom-tbody").innerHTML = (data.rows || []).map(function (r) {',
'    return "<tr><td>" + r.date + "</td><td><b>" + r.module + "</b></td><td>" + r.docNo + "</td><td>" + r.party + "</td><td>" + r.category + "</td><td>" + r.mode + "</td><td><b>₹" + Number(r.amount || 0).toFixed(2) + "</b></td></tr>";',
'  }).join("") || "<tr><td colspan=\\"7\\" style=\\"text-align:center;color:var(--muted);\\">No records in selected date/module range.</td></tr>";',
'}',

'async function loadInstituteDetails() {',
'  const res = await fetch("/api/institute"); const data = await res.json();',
'  if (!data.success) return;',
'  instituteDetails = data.institute;',
'  document.getElementById("print-inst-name").innerText = instituteDetails.name || "";',
'  document.getElementById("print-inst-address").innerText = (instituteDetails.tagline || "") + " • " + (instituteDetails.address || "");',
'  document.getElementById("print-inst-gstin").innerText = instituteDetails.gstin || "-";',
'  document.getElementById("print-inst-phone").innerText = instituteDetails.phone || "-";',
'  document.getElementById("presc-inst-name").innerText = instituteDetails.name || "";',
'  document.getElementById("presc-inst-address").innerText = (instituteDetails.tagline || "") + " • " + (instituteDetails.address || "");',
'  document.getElementById("pb-bank").innerText = instituteDetails.bankName || "-";',
'  document.getElementById("pb-branch").innerText = instituteDetails.branch || "-";',
'  document.getElementById("pb-acc").innerText = instituteDetails.accountNo || "-";',
'  document.getElementById("pb-ifsc").innerText = instituteDetails.ifsc || "-";',
'  document.getElementById("pb-upi").innerText = instituteDetails.upiId || "-";',

'  const logoUrl = instituteDetails.logoDataUrl || "";',
'  ["print-inst-logo", "presc-inst-logo", "inst-logo-preview"].forEach(function (id) {',
'    const el = document.getElementById(id);',
'    if (el) { el.src = logoUrl; el.style.display = logoUrl ? (id === "inst-logo-preview" ? "inline-block" : "block") : "none"; }',
'  });',
'  const sbLogo = document.getElementById("sidebar-logo-box");',
'  if (sbLogo) { sbLogo.innerHTML = logoUrl ? "<img src=\\"" + logoUrl + "\\" style=\\"width:100%;height:100%;object-fit:cover;\\">" : "AR"; }',

'  if (document.getElementById("inst-name")) {',
'    document.getElementById("inst-name").value = instituteDetails.name || "";',
'    document.getElementById("inst-tagline").value = instituteDetails.tagline || "";',
'    document.getElementById("inst-address").value = instituteDetails.address || "";',
'    document.getElementById("inst-gstin").value = instituteDetails.gstin || "";',
'    document.getElementById("inst-phone").value = instituteDetails.phone || "";',
'    document.getElementById("inst-pos").value = instituteDetails.placeOfSupply || "";',
'    document.getElementById("inst-emg-fee").value = instituteDetails.emergencyFee !== undefined ? instituteDetails.emergencyFee : 250;',
'    document.getElementById("inst-bank").value = instituteDetails.bankName || "";',
'    document.getElementById("inst-acc").value = instituteDetails.accountNo || "";',
'    document.getElementById("inst-ifsc").value = instituteDetails.ifsc || "";',
'    document.getElementById("inst-upi").value = instituteDetails.upiId || "";',
'  }',
'}',

'async function handleSaveInstitute(e) {',
'  e.preventDefault();',
'  const res = await fetch("/api/institute", {',
'    method: "POST",',
'    headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ name: document.getElementById("inst-name").value, tagline: document.getElementById("inst-tagline").value, address: document.getElementById("inst-address").value, gstin: document.getElementById("inst-gstin").value, phone: document.getElementById("inst-phone").value, placeOfSupply: document.getElementById("inst-pos").value, emergencyFee: document.getElementById("inst-emg-fee").value, bankName: document.getElementById("inst-bank").value, accountNo: document.getElementById("inst-acc").value, ifsc: document.getElementById("inst-ifsc").value, upiId: document.getElementById("inst-upi").value, logoDataUrl: instituteDetails.logoDataUrl || "" })',
'  });',
'  const d = await res.json(); alert(d.message); if (d.success) loadInstituteDetails();',
'}',

'function applyPrintOptions() {',
'  const pairs = [["opt-batch",".col-batch"],["opt-mfgexp",".col-mfgexp"],["opt-hsn",".col-hsn"],["opt-mrp",".col-mrp"],["opt-gst",".sec-gst"],["opt-bank",".sec-bank"],["opt-terms",".sec-terms"]];',
'  pairs.forEach(function (p) { const checked = document.getElementById(p[0]).checked; document.querySelectorAll(p[1]).forEach(function (el) { el.classList.toggle("hide-col", !checked); }); });',
'}',

'function renderBillModal(bill) {',
'  currentActiveBillNo = bill.billNo;',
'  document.getElementById("pb-doc-title").innerText = (bill.billType || "TAX").toUpperCase() + " TAX INVOICE";',
'  document.getElementById("pb-billno").innerText = bill.billNo;',
'  document.getElementById("pb-datetime").innerText = bill.dateTime;',
'  document.getElementById("pb-pos").innerText = bill.placeOfSupply || instituteDetails.placeOfSupply || "-";',
'  document.getElementById("pb-uhid").innerText = bill.uhid || "-";',
'  document.getElementById("pb-user").innerText = bill.createdBy || "-";',
'  document.getElementById("pb-name").innerText = bill.patientName || "-";',
'  document.getElementById("pb-ptype").innerText = bill.patientType || "Normal";',
'  document.getElementById("pb-contact").innerText = bill.contact || "-";',
'  document.getElementById("pb-address").innerText = bill.address || "-";',
'  document.getElementById("pb-doctor").innerText = bill.doctor || "-";',
'  document.getElementById("pb-paymode").innerText = bill.payType || "Cash";',
'  document.getElementById("pb-pay-status").innerText = (bill.payType || "").includes("Credit") ? "Credit / Due" : "Paid";',
'  document.getElementById("pb-items-tbody").innerHTML = (bill.items || []).map(function (it, idx) {',
'    return "<tr><td>" + (idx + 1) + "</td><td>" + it.name + "</td><td class=\\"col-batch\\">" + (it.batch || "-") + "</td><td class=\\"col-mfgexp\\">" + (it.mfg || "-") + "</td><td class=\\"col-mfgexp\\">" + (it.exp || "-") + "</td><td class=\\"col-hsn\\">" + (it.hsn || "-") + "</td><td>" + it.qty + " " + (it.unit || "") + "</td><td class=\\"col-mrp\\">₹" + Number(it.mrp || 0).toFixed(2) + "</td><td>₹" + Number(it.rate || 0).toFixed(2) + "</td><td>" + Number(it.discPct || 0).toFixed(2) + "%</td><td>₹" + Number(it.taxable || 0).toFixed(2) + "</td><td>₹" + Number(it.gstAmt || 0).toFixed(2) + " (" + (it.gstPct || 0) + "%)</td><td><b>₹" + Number(it.lineTotal || 0).toFixed(2) + "</b></td></tr>";',
'  }).join("");',
'  document.getElementById("pb-gross").innerText = "₹" + Number(bill.totalGross || 0).toFixed(2);',
'  document.getElementById("pb-disc").innerText = Number(bill.totalDisc || 0).toFixed(2);',
'  document.getElementById("pb-disc-val").innerText = "₹" + Number(bill.totalDisc || 0).toFixed(2);',
'  document.getElementById("pb-taxable").innerText = Number(bill.totalTaxable || 0).toFixed(2);',
'  document.getElementById("pb-gst").innerText = Number(bill.totalGst || 0).toFixed(2);',
'  document.getElementById("pb-gst-val").innerText = "₹" + Number(bill.totalGst || 0).toFixed(2);',
'  document.getElementById("pb-amount").innerText = "₹" + Number(bill.netFee || 0).toFixed(2);',
'  applyPrintOptions();',
'  document.getElementById("print-modal").style.display = "flex";',
'  document.getElementById("prescription-modal").style.display = "none";',
'}',

'async function openBillingModalByUHID(uhid, preferredType) {',
'  const res = await fetch("/api/bills"); const bills = await res.json();',
'  const bill = bills.find(function (b) { return b.uhid === uhid && (!preferredType || b.billType === preferredType); }) || bills.find(function (b) { return b.uhid === uhid; });',
'  if (bill) renderBillModal(bill); else alert("No bill found for " + uhid);',
'}',

'async function openBillingModalByBillNo(billNo) {',
'  const res = await fetch("/api/bills"); const bills = await res.json();',
'  const bill = bills.find(function (b) { return b.billNo === billNo; });',
'  if (bill) renderBillModal(bill);',
'}',

'async function openPrescriptionSheet(uhid) {',
'  const res = await fetch("/api/patients/search?q=" + encodeURIComponent(uhid)); const data = await res.json();',
'  if (!data.length) return;',
'  const p = data[0];',
'  document.getElementById("pr-uhid").innerText = p.uhid; document.getElementById("pr-date").innerText = p.date;',
'  document.getElementById("pr-name").innerText = p.title + " " + p.name; document.getElementById("pr-age").innerText = p.age + " Yrs / " + p.gender;',
'  document.getElementById("pr-guardian").innerText = (p.relation || "") + " " + (p.guardian || ""); document.getElementById("pr-contact").innerText = p.contact;',
'  document.getElementById("pr-doctor").innerText = p.doctor; document.getElementById("pr-address").innerText = p.address || "-";',
'  ["vital-bp","vital-pulse","vital-temp","vital-wt","pr-investigation","pr-treatment","pr-nextvisit"].forEach(function (id) { document.getElementById(id).value = ""; });',
'  document.getElementById("prescription-modal").style.display = "flex"; document.getElementById("print-modal").style.display = "none";',
'}',

'async function requestBillEdit() {',
'  if (currentUser.role !== "Super Admin" && currentUser.role !== "Admin") { alert("Only Super Admin / Admin can edit bills."); return; }',
'  const newNet = prompt("New Net Amount (₹) for " + currentActiveBillNo + ":"); if (newNet === null || newNet === "") return;',
'  const newMode = prompt("Payment Mode (Cash / Cheque / UPI / Card / Credit):", "Cash"); if (!newMode) return;',
'  const res = await fetch("/api/bills/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billNo: currentActiveBillNo, netFee: newNet, payType: newMode, userRole: currentUser.role }) });',
'  const d = await res.json(); alert(d.message); if (d.success) renderBillModal(d.bill);',
'}',

'async function handleQuickSearch(val, boxId, openRx) {',
'  const box = document.getElementById(boxId);',
'  if ((val || "").trim().length < 2) { box.style.display = "none"; return; }',
'  const res = await fetch("/api/patients/search?q=" + encodeURIComponent(val)); const data = await res.json();',
'  if (!data.length) { box.style.display = "none"; return; }',
'  box.innerHTML = data.map(function (p) { return "<div class=\\"suggestion-item\\" data-uhid=\\"" + p.uhid + "\\"><b>" + p.title + " " + p.name + "</b> (" + p.uhid + ") | " + p.contact + "</div>"; }).join("");',
'  box.style.display = "block";',
'  box.querySelectorAll(".suggestion-item").forEach(function (item) {',
'    item.addEventListener("click", async function () {',
'      const u = item.getAttribute("data-uhid"); box.style.display = "none";',
'      if (openRx) { openPrescriptionSheet(u); return; }',
'      const r = await fetch("/api/patients/search?q=" + encodeURIComponent(u)); const arr = await r.json();',
'      if (arr.length) { const p = arr[0]; document.getElementById("reg-uhid").value = p.uhid; document.getElementById("reg-name").value = p.name; document.getElementById("reg-age").value = p.age; document.getElementById("reg-contact").value = p.contact; document.getElementById("reg-abha").value = p.abha || ""; document.getElementById("reg-address").value = p.address || ""; }',
'    });',
'  });',
'}',

'async function sendAiQuery() {',
'  const inp = document.getElementById("ai-input"); const txt = inp.value.trim(); if (!txt) return;',
'  const body = document.getElementById("ai-chat-body");',
'  body.innerHTML += "<div style=\\"text-align:right;\\"><b>You:</b> " + txt + "</div>"; inp.value = "";',
'  const res = await fetch("/api/ai/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: txt }) });',
'  const d = await res.json();',
'  body.innerHTML += "<div style=\\"background:#f0f6ff;padding:8px;border-radius:6px;\\">" + d.reply + "</div>";',
'  body.scrollTop = body.scrollHeight;',
'}',
'</script></body></html>'
].join('\n');

app.get('/', function (req, res) {
    res.send(htmlPage);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log('AR Healthcare Master ERP running on port ' + PORT);
});