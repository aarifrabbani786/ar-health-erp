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

let instituteInfo = {
    name: 'A.R. MEDICAL COLLEGE & HEALTHCARE',
    tagline: 'Hospital • Pharmacy • Biomedical • ABDM M1/M2/M3 & NHCX HIMS',
    address: 'Village Badahara Rani, Maharajganj, Uttar Pradesh',
    gstin: '09AABCA1234F1Z5',
    phone: '+91 9005554424',
    bankName: 'State Bank of India',
    accountNo: '301234567890',
    ifsc: 'SBIN0001234',
    upiId: 'arhealthcare@upi'
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

let dailySequence = { date: '', count: 1 };
function getNextUHID() {
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '').slice(0, 4) + new Date().getFullYear().toString().slice(-2);
    if (dailySequence.date !== todayStr) {
        dailySequence.date = todayStr;
        dailySequence.count = 1;
    }
    return 'AR' + todayStr + '-' + dailySequence.count.toString().padStart(2, '0');
}

function incrementUHID() {
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '').slice(0, 4) + new Date().getFullYear().toString().slice(-2);
    if (dailySequence.date !== todayStr) {
        dailySequence.date = todayStr;
        dailySequence.count = 1;
    } else {
        dailySequence.count += 1;
    }
}

let erpData = {
    users: [
        { id: 'USR-101', name: 'Aarif Rabbani', username: 'Aarif', password: '7860', role: 'Super Admin', permissions: ['all'], status: 'Active', isProtected: true },
        { id: 'USR-102', name: 'Admin User', username: 'admin', password: '123', role: 'Admin', permissions: ['all'], status: 'Active', isProtected: false },
        { id: 'USR-103', name: 'Staff Reception', username: 'staff', password: '123', role: 'Cashier / Receptionist', permissions: ['patients', 'patient-search', 'opd', 'hospital-billing', 'abdm-hims'], status: 'Active', isProtected: false },
        { id: 'USR-104', name: 'Demo User', username: 'demo', password: '1234', role: 'Demo Viewer', permissions: ['all'], status: 'Active', isProtected: false, isDemo: true }
    ],
    patients: [
        { uhid: 'AR011126-01', title: 'Mr.', name: 'Aarif Rabbani', relation: 'S/O', guardian: 'Md Rabbani', age: 27, gender: 'Male', contact: '9876543210', adhaar: '123456789012', abha: 'aarif@abdm', abhaNo: '12-3456-7890-1234', address: 'Maharajganj, UP', doctor: 'Dr. A. Khan', fee: 500, discount: 50, netFee: 450, payType: 'Cash', date: '2026-11-01 14:00', workflowStatus: 'Registered & Visited' }
    ],
    doctors: [
        { id: 'DOC1', name: 'Dr. A. Khan (General Physician)', fee: 500, department: 'General Medicine' },
        { id: 'DOC2', name: 'Dr. Priya Singh (Gynecologist)', fee: 700, department: 'Gynecology' }
    ],
    bills: [
        {
            billNo: 'INV-011126-01',
            uhid: 'AR011126-01',
            patientName: 'Mr. Aarif Rabbani',
            contact: '9876543210',
            address: 'Maharajganj, UP',
            doctor: 'Dr. A. Khan',
            payType: 'Cash',
            createdBy: 'Aarif (Super Admin)',
            dateTime: '2026-11-01 14:00',
            edited: false,
            items: [
                { name: 'OPD Consultation / Medicine Pack', batch: 'B2601', mfg: '01/26', exp: '12/27', hsn: '999311', qty: 1, mrp: 500, rate: 450, discPct: 10, gstPct: 12 }
            ]
        }
    ],
    opdAppointments: [
        { appId: 'APT-101', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', doctor: 'Dr. A. Khan', tokenNo: 1, slot: 'Morning Session (10 AM - 1 PM)', status: 'Booked' }
    ],
    ipdAdmissions: [
        { ipdNo: 'IPD-01', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', ward: 'General Ward - Bed 01', doctor: 'Dr. A. Khan', admitDate: '2026-11-01', status: 'Admitted' }
    ],
    wards: [
        { wardName: 'General Ward', totalBeds: 10, occupiedBeds: 1, dailyCharge: '₹500 / day' },
        { wardName: 'Private Room', totalBeds: 5, occupiedBeds: 0, dailyCharge: '₹1500 / day' },
        { wardName: 'ICU', totalBeds: 5, occupiedBeds: 1, dailyCharge: '₹3000 / day' }
    ],
    laboratory: [
        { testId: 'LAB-101', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', testName: 'Complete Blood Count (CBC)', status: 'Completed', result: 'Hb: 13.5 g/dL, WBC: 7200 /µL, Platelets: 2.5L', date: '2026-11-01' }
    ],
    radiology: [
        { radId: 'RAD-101', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', modality: 'Digital X-Ray Chest PA', status: 'Reported', finding: 'Lung fields clear, CP angles sharp', date: '2026-11-01' }
    ],
    pharmacyStock: [
        { itemCode: 'MED-501', itemName: 'Paracetamol 650mg', batch: 'PAR26A', hsn: '30049099', qty: 450, mrp: 30, rate: 25, gstPct: 12 }
    ],
    abdmRecords: [
        { abdmId: 'ABDM-M1-01', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', abhaAddress: 'aarif@abdm', abhaNumber: '12-3456-7890-1234', m1Status: 'Verified', m2CareContext: 'OPD-01 Linked', m3ClaimId: 'CLM-NHCX-01', nhcxStatus: 'Pre-Auth Approved' }
    ],
    nhcxClaims: [
        { claimId: 'CLM-NHCX-01', uhid: 'AR011126-01', patientName: 'Mr. Aarif Rabbani', payer: 'National Health Claims Exchange (NHCX)', claimType: 'Cashless Pre-Auth', amount: 450, status: 'Approved', updatedAt: '2026-11-01' }
    ],
    inventoryItems: [
        { itemId: 'ITM-201', name: 'Surgical Gloves Box', warehouse: 'Central Store', stock: 85, unit: 'Box', reorderLevel: 20 }
    ],
    biomedicalAssets: [
        { assetId: 'BIO-301', equipment: 'Multipara Patient Monitor', department: 'ICU', serialNo: 'MPM-9921', amcStatus: 'Active AMC', nextPm: '2026-12-15' }
    ],
    financeEntries: [
        { voucherNo: 'VCH-801', type: 'Receipt', head: 'OPD Consultation', mode: 'Cash', amount: 450, date: '2026-11-01' }
    ],
    auditLogs: [
        { time: '2026-11-01 14:00', user: 'Aarif Rabbani', action: 'System Initialized with ABDM M1/M2/M3 & NHCX HIMS' }
    ]
};

function buildBillObject({ billNo, uhid, patientName, contact, address, doctor, payType, createdBy, dateTime, items }) {
    const cleanItems = (items && items.length ? items : [
        { name: 'OPD Consultation Fee', batch: 'OPD', mfg: '-', exp: '-', hsn: '999311', qty: 1, mrp: 500, rate: 500, discPct: 0, gstPct: 0 }
    ]).map(it => {
        const qty = Math.max(1, Number(it.qty || 1));
        const rate = Number(it.rate || 0);
        const mrp = Number(it.mrp || rate);
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
            qty,
            mrp,
            rate,
            discPct,
            discAmt,
            taxable,
            gstPct,
            gstAmt,
            lineTotal
        };
    });

    const totalTaxable = cleanItems.reduce((s, x) => s + x.taxable, 0);
    const totalGst = cleanItems.reduce((s, x) => s + x.gstAmt, 0);
    const totalDisc = cleanItems.reduce((s, x) => s + x.discAmt, 0);
    const totalGross = cleanItems.reduce((s, x) => s + (x.qty * x.rate), 0);
    const netFee = Number((totalTaxable + totalGst).toFixed(2));

    return {
        billNo,
        uhid,
        patientName,
        contact: contact || '',
        address: address || '',
        doctor: doctor || '',
        payType: payType || 'Cash',
        createdBy: createdBy || 'Staff',
        dateTime: dateTime || new Date().toLocaleString('en-GB'),
        edited: false,
        items: cleanItems,
        totalGross: Number(totalGross.toFixed(2)),
        totalDisc: Number(totalDisc.toFixed(2)),
        totalTaxable: Number(totalTaxable.toFixed(2)),
        totalGst: Number(totalGst.toFixed(2)),
        netFee
    };
}

erpData.bills = erpData.bills.map(b => buildBillObject(b));

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = (username || '').trim().toLowerCase();
        const user = erpData.users.find(u => u.username.toLowerCase() === cleanUser && u.password === password);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid User ID or Password. (Admin: Aarif / 7860)' });
        if (user.status === 'Deactivated') return res.status(403).json({ success: false, message: 'Account is deactivated by Admin.' });
        res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, permissions: user.permissions, status: user.status, isProtected: user.isProtected, isDemo: user.isDemo } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/institute', (req, res) => res.json({ success: true, institute: instituteInfo, printConfig }));
app.post('/api/institute', (req, res) => {
    const { name, tagline, address, gstin, phone, bankName, accountNo, ifsc, upiId } = req.body;
    if (name !== undefined) instituteInfo.name = name;
    if (tagline !== undefined) instituteInfo.tagline = tagline;
    if (address !== undefined) instituteInfo.address = address;
    if (gstin !== undefined) instituteInfo.gstin = gstin;
    if (phone !== undefined) instituteInfo.phone = phone;
    if (bankName !== undefined) instituteInfo.bankName = bankName;
    if (accountNo !== undefined) instituteInfo.accountNo = accountNo;
    if (ifsc !== undefined) instituteInfo.ifsc = ifsc;
    if (upiId !== undefined) instituteInfo.upiId = upiId;
    res.json({ success: true, message: 'Institute & Billing details updated successfully!', institute: instituteInfo });
});

app.post('/api/print-config', (req, res) => {
    printConfig = { ...printConfig, ...req.body };
    res.json({ success: true, printConfig });
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
            permissions: permissions || ['patients', 'patient-search', 'abdm-hims'],
            status: 'Active',
            isProtected: false
        };
        erpData.users.push(newUser);
        erpData.auditLogs.unshift({ time: new Date().toLocaleString('en-GB'), user: 'Admin', action: 'Created user ' + name + ' (' + role + ')' });
        res.json({ success: true, message: 'User created successfully', users: erpData.users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users/permissions', (req, res) => {
    const { userId, permissions } = req.body;
    const user = erpData.users.find(u => u.id === userId);
    if (user) {
        if (user.isProtected) return res.status(403).json({ success: false, message: 'Super Admin permissions cannot be modified!' });
        user.permissions = permissions;
        res.json({ success: true, message: 'Permissions updated successfully!', users: erpData.users });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.post('/api/users/status', (req, res) => {
    const { userId, status } = req.body;
    const user = erpData.users.find(u => u.id === userId);
    if (user) {
        if (user.isProtected) return res.status(403).json({ success: false, message: 'Super Admin account cannot be deactivated!' });
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
        incrementUHID();

        const nowStr = new Date().toLocaleString('en-GB');
        const fee = Number(p.fee || 0);
        const discount = Number(p.discount || 0);
        const netFee = Math.max(0, fee - discount);
        const discPct = fee > 0 ? Number(((discount / fee) * 100).toFixed(2)) : 0;

        const newPatient = {
            uhid, title: p.title || 'Mr.', name: p.name, relation: p.relation || 'C/O', guardian: p.guardian || '',
            age: p.age, gender: p.gender, contact: p.contact, adhaar: p.adhaar || '', abha: p.abha || '',
            abhaNo: p.abhaNo || '', address: p.address || '', doctor: p.doctor, fee, discount, netFee,
            payType: p.payType || 'Cash', date: nowStr, workflowStatus: 'Registered & Visited'
        };
        erpData.patients.unshift(newPatient);

        const billNo = 'INV-' + Date.now().toString().slice(-6);
        const newBill = buildBillObject({
            billNo,
            uhid,
            patientName: (p.title || '') + ' ' + p.name,
            contact: p.contact,
            address: p.address || '',
            doctor: p.doctor,
            payType: p.payType || 'Cash',
            createdBy: p.createdBy || 'Staff',
            dateTime: nowStr,
            items: [
                {
                    name: 'OPD Consultation - ' + (p.doctor || 'General'),
                    batch: 'OPD',
                    mfg: '-',
                    exp: '-',
                    hsn: '999311',
                    qty: 1,
                    mrp: fee,
                    rate: fee,
                    discPct,
                    gstPct: Number(p.gstPct || 0)
                }
            ]
        });
        erpData.bills.unshift(newBill);
        erpData.financeEntries.unshift({ voucherNo: 'VCH-' + Date.now().toString().slice(-4), type: p.payType === 'Credit / Udhar' ? 'Credit' : 'Receipt', head: 'OPD Billing', mode: p.payType || 'Cash', amount: newBill.netFee, date: nowStr });
        erpData.auditLogs.unshift({ time: nowStr, user: p.createdBy || 'Staff', action: `Registered ${p.name} (${uhid}) | Bill ${billNo} | ₹${newBill.netFee} (${p.payType})` });

        res.json({ success: true, message: 'Patient Registered & Bill Generated', patient: newPatient, bill: newBill });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/opd/book', (req, res) => {
    const { uhid, patientName, doctor, slot } = req.body;
    const aptId = 'APT-' + Date.now().toString().slice(-4);
    const tokenNo = erpData.opdAppointments.length + 1;
    const newApt = { appId: aptId, uhid, patientName, doctor, tokenNo, slot: slot || 'Morning Session', status: 'Booked' };
    erpData.opdAppointments.unshift(newApt);
    res.json({ success: true, message: 'OPD Appointment Booked Successfully', appointment: newApt });
});

app.post('/api/ipd/admit', (req, res) => {
    const { uhid, patientName, ward, doctor } = req.body;
    const ipdNo = 'IPD-' + Date.now().toString().slice(-4);
    const admitDate = new Date().toLocaleDateString('en-GB');
    const newAdmit = { ipdNo, uhid, patientName, ward, doctor, admitDate, status: 'Admitted' };
    erpData.ipdAdmissions.unshift(newAdmit);
    res.json({ success: true, message: 'Patient Admitted to IPD Successfully', admission: newAdmit });
});

app.post('/api/wards/add', (req, res) => {
    const { wardName, totalBeds, dailyCharge } = req.body;
    const newWard = { wardName, totalBeds: Number(totalBeds), occupiedBeds: 0, dailyCharge: '₹' + dailyCharge + ' / day' };
    erpData.wards.push(newWard);
    res.json({ success: true, message: 'Ward Added Successfully', wards: erpData.wards });
});

app.post('/api/lab/add', (req, res) => {
    const { uhid, patientName, testName, result, status } = req.body;
    const entry = {
        testId: 'LAB-' + Date.now().toString().slice(-4),
        uhid,
        patientName,
        testName,
        status: status || 'Completed',
        result: result || 'Pending Entry',
        date: new Date().toLocaleDateString('en-GB')
    };
    erpData.laboratory.unshift(entry);
    res.json({ success: true, message: 'Lab Report Saved', entry });
});

app.post('/api/pharmacy/add', (req, res) => {
    const { itemName, batch, hsn, qty, mrp, rate, gstPct } = req.body;
    const med = {
        itemCode: 'MED-' + Date.now().toString().slice(-4),
        itemName,
        batch: batch || 'B01',
        hsn: hsn || '30049099',
        qty: Number(qty || 1),
        mrp: Number(mrp || rate || 0),
        rate: Number(rate || 0),
        gstPct: Number(gstPct || 12)
    };
    erpData.pharmacyStock.unshift(med);
    res.json({ success: true, message: 'Medicine Stock Added', med });
});

app.post('/api/abdm/create-abha', (req, res) => {
    const { uhid, patientName, mobileOrAadhaar, desiredAbha, m2CareContext } = req.body;
    const cleanHandle = (desiredAbha || (patientName || 'patient').toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-3)) + '@abdm';
    const abhaNumber = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join('-');
    const record = {
        abdmId: 'ABDM-M1-' + Date.now().toString().slice(-4),
        uhid: uhid || getNextUHID(),
        patientName,
        abhaAddress: cleanHandle,
        abhaNumber,
        m1Status: 'ABHA Created & Verified',
        m2CareContext: m2CareContext || 'OPD/IPD Health Record Ready',
        m3ClaimId: 'Pending NHCX',
        nhcxStatus: 'Ready for Pre-Auth'
    };
    erpData.abdmRecords.unshift(record);
    const pat = erpData.patients.find(p => p.uhid === uhid);
    if (pat) { pat.abha = cleanHandle; pat.abhaNo = abhaNumber; }
    res.json({ success: true, message: 'ABHA Created (M1 Ready)', record });
});

app.post('/api/nhcx/claim', (req, res) => {
    const { uhid, patientName, payer, claimType, amount } = req.body;
    const claimId = 'CLM-NHCX-' + Date.now().toString().slice(-4);
    const claim = {
        claimId,
        uhid,
        patientName,
        payer: payer || 'NHCX Health Payer',
        claimType: claimType || 'Cashless Pre-Auth',
        amount: Number(amount || 0),
        status: 'Submitted to NHCX',
        updatedAt: new Date().toLocaleDateString('en-GB')
    };
    erpData.nhcxClaims.unshift(claim);
    const abdm = erpData.abdmRecords.find(r => r.uhid === uhid);
    if (abdm) { abdm.m3ClaimId = claimId; abdm.nhcxStatus = 'Submitted (' + claimType + ')'; }
    res.json({ success: true, message: 'NHCX Claim / Pre-Auth Submitted', claim });
});

app.get('/api/patients/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    if (q.length < 2) return res.json([]);
    const results = erpData.patients.filter(p =>
        p.name.toLowerCase().includes(q) || p.contact.includes(q) || p.uhid.toLowerCase().includes(q) || (p.adhaar && p.adhaar.includes(q)) || (p.abha && p.abha.toLowerCase().includes(q))
    );
    res.json(results);
});

app.get('/api/bills', (req, res) => res.json(erpData.bills));

app.post('/api/bills/edit', (req, res) => {
    const { billNo, netFee, payType, userRole } = req.body;
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Only Super Admin and Admin can directly edit bills!' });
    }
    const bill = erpData.bills.find(b => b.billNo === billNo);
    if (bill) {
        const updatedNet = Number(netFee);
        bill.netFee = updatedNet;
        bill.totalTaxable = updatedNet;
        bill.totalGst = 0;
        bill.payType = payType;
        bill.edited = true;
        res.json({ success: true, message: 'Bill updated successfully!', bill });
    } else {
        res.status(404).json({ success: false, message: 'Bill not found' });
    }
});

app.post('/api/ai/query', (req, res) => {
    const { prompt } = req.body;
    const q = (prompt || '').toLowerCase();
    let reply = 'AR AI: Main aapka AR ERP & HIMS (ABDM M1/M2/M3 + NHCX) assistant hu. Aap mujhse patients, revenue, credit bills, ABHA ya NHCX claims ke baare me pooch sakte hain.';
    if (q.includes('patient') || q.includes('kitne')) {
        reply = `AR AI: Total registered patients abhi ${erpData.patients.length} hain.`;
    } else if (q.includes('revenue') || q.includes('income') || q.includes('collection')) {
        const totalRev = erpData.bills.reduce((acc, b) => acc + Number(b.netFee || 0), 0);
        reply = `AR AI: Total billed/collected amount abhi ₹${totalRev.toFixed(2)} hai.`;
    } else if (q.includes('credit') || q.includes('udhar')) {
        const credits = erpData.bills.filter(b => b.payType === 'Credit / Udhar');
        reply = `AR AI: Total Credit / Udhar bills ${credits.length} hain.`;
    } else if (q.includes('abha') || q.includes('nhcx') || q.includes('abdm')) {
        reply = `AR AI: ${erpData.abdmRecords.length} ABDM profiles aur ${erpData.nhcxClaims.length} NHCX claims active hain.`;
    }
    res.json({ success: true, reply });
});

app.get('/api/module/:key', (req, res) => {
    const key = req.params.key;
    if (['patients', 'patient-search', 'patients-reg', 'medical-records'].includes(key)) return res.json({ success: true, data: erpData.patients });
    if (['opd'].includes(key)) return res.json({ success: true, data: erpData.opdAppointments });
    if (['ipd', 'discharge', 'nursing', 'ot-icu'].includes(key)) return res.json({ success: true, data: erpData.ipdAdmissions });
    if (['wards'].includes(key)) return res.json({ success: true, data: erpData.wards });
    if (['bills', 'hospital-billing', 'sales-billing', 'sales-return', 'pharmacy-reports'].includes(key)) return res.json({ success: true, data: erpData.bills });
    if (['doctors'].includes(key)) return res.json({ success: true, data: erpData.doctors });
    if (['users'].includes(key)) return res.json({ success: true, data: erpData.users });
    if (['lab', 'laboratory'].includes(key)) return res.json({ success: true, data: erpData.laboratory });
    if (['radiology'].includes(key)) return res.json({ success: true, data: erpData.radiology });
    if (['pharmacy', 'medicines', 'batch-stock', 'purchase-entry', 'stock-alerts'].includes(key)) return res.json({ success: true, data: erpData.pharmacyStock });
    if (['abdm', 'abdm-hims', 'abha', 'm1', 'm2', 'm3'].includes(key)) return res.json({ success: true, data: erpData.abdmRecords });
    if (['nhcx', 'claims'].includes(key)) return res.json({ success: true, data: erpData.nhcxClaims });
    if (['inv-dash', 'item-master', 'warehouses', 'requisitions', 'grn', 'stock-issue', 'stock-ledger', 'po', 'quotations', 'payments'].includes(key)) return res.json({ success: true, data: erpData.inventoryItems });
    if (['biomed-dash', 'equipment', 'complaints', 'repairs', 'pm', 'calibration', 'amc', 'vendors', 'handover', 'biomed-reports'].includes(key)) return res.json({ success: true, data: erpData.biomedicalAssets });
    if (['accounts', 'income-expenses', 'cash-bank', 'rec-pay', 'payroll', 'reports'].includes(key)) return res.json({ success: true, data: erpData.financeEntries });
    if (['audit-logs'].includes(key)) return res.json({ success: true, data: erpData.auditLogs });
    res.json({ success: true, data: erpData.patients });
});

app.get('/api/dashboard/metrics', (req, res) => {
    const rev = erpData.bills.reduce((acc, b) => acc + Number(b.netFee || 0), 0);
    const creditTotal = erpData.bills.filter(b => b.payType === 'Credit / Udhar').reduce((acc, b) => acc + Number(b.netFee || 0), 0);
    res.json({ success: true, totalRevenue: rev, creditTotal, registeredPatients: erpData.patients.length, activeIpdBeds: erpData.ipdAdmissions.length, lowStockItems: 1 });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AR Healthcare ERP - Complete HIMS (ABDM M1/M2/M3 & NHCX)</title>
<style>
:root{--navy:#10243a;--navy2:#173650;--blue:#2674e8;--cyan:#16b8b0;--bg:#f3f6fb;--card:#fff;--text:#18283d;--muted:#718096;--line:#e4eaf2;--green:#16875d;--red:#c93c48;--shadow:0 8px 28px rgba(23,44,75,.07)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-weight:600;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}

#login-screen{display:flex;justify-content:center;align-items:center;height:100vh;width:100vw;background:url('https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=1920&auto=format&fit=crop') no-repeat center center/cover;position:fixed;z-index:9999}
.login-card-wrapper{background:rgba(15, 23, 42, 0.65);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.35);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,0.6);width:min(900px,94vw);height:520px;display:flex;overflow:hidden;position:relative;z-index:1}
.login-left{flex:1.2;padding:40px 45px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:rgba(15,23,42,0.75);color:#fff}
.login-left h2{font-size:26px;font-weight:900;margin-bottom:15px;color:#fff;width:100%}
.login-left form{width:100%;max-width:320px}
.login-right{flex:1;background:url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1000&auto=format&fit=crop') no-repeat center center/cover;color:#fff;padding:40px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;position:relative}
.login-right-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(16,185,129,0.55),rgba(38,116,232,0.7));z-index:1}
.login-right-content{position:relative;z-index:2;background:rgba(15,23,42,0.7);padding:22px;border-radius:14px;backdrop-filter:blur(8px);width:100%;border:1px solid rgba(255,255,255,0.2)}
.login-field{margin-bottom:16px;text-align:left;position:relative}
.login-field label{display:block;font-size:12px;font-weight:800;color:#e2e8f0;margin-bottom:6px}
.login-input{width:100%;padding:12px 14px;border:1px solid rgba(255,255,255,0.3);border-radius:10px;font-size:14px;font-weight:700;background:rgba(15,23,42,0.85);color:#ffffff !important;outline:none}
.login-btn{width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;margin-top:10px;box-shadow:0 8px 20px rgba(16,185,129,0.4);text-align:center}

#app{display:none;height:100vh;width:100vw;flex-direction:row}
.sidebar{width:276px;background:linear-gradient(180deg,var(--navy),#0d1c2c);color:#d9e6f5;display:flex;flex-direction:column;flex-shrink:0;transition:all 0.3s ease;overflow-y:auto}
.brand{display:flex;align-items:center;gap:12px;padding:20px 18px;border-bottom:1px solid #ffffff18;position:sticky;top:0;background:var(--navy);z-index:10}
.logo{width:43px;height:43px;border-radius:13px;background:linear-gradient(135deg,#23c6b8,#3478f6);display:grid;place-items:center;color:white;font-weight:900;font-size:16px}
.brand strong{display:block;font-size:14px;font-weight:900;color:#fff}
.brand small{display:block;color:#9db3ca;font-size:10px;font-weight:700;margin-top:4px}
.nav{padding:12px 10px 30px;flex:1}
.nav-label{font-size:11px;font-weight:900;letter-spacing:1.2px;color:#7893ae;padding:16px 11px 7px}
.nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;margin:2px 0;color:#c6d4e4;font-size:13px;font-weight:700;border:0;background:transparent;width:100%;text-align:left;cursor:pointer;transition:all 0.2s}
.nav-item:hover,.nav-item.active{background:#ffffff15;color:#fff;transform:translateX(4px)}
.nav-item.active{box-shadow:inset 3px 0 #29c7be;font-weight:900}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.topbar{height:74px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px}
.profile{display:flex;align-items:center;gap:12px}
.avatar{width:38px;height:38px;border-radius:12px;background:#e4efff;color:#2464c4;display:grid;place-items:center;font-weight:900;font-size:13px}
.content{padding:24px 28px;overflow-y:auto;flex:1}
.view-section{display:none}
.view-section.active{display:block}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:22px}
.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow)}
.stat-label{font-size:11px;font-weight:800;color:var(--muted)}
.stat-value{font-size:24px;font-weight:900;margin:12px 0 4px;color:var(--navy)}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:22px;margin-bottom:22px}
.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.panel-head h3{font-size:16px;font-weight:900;margin:0;color:var(--navy)}
.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:15px}
.field{display:flex;flex-direction:column;gap:6px;position:relative}
.field label{font-size:12px;font-weight:800;color:var(--navy)}
.field input,.field select{padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-weight:700;outline:none}
table{width:100%;border-collapse:collapse}
th{text-align:left;background:#f8fafd;color:#5a6a8e;font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;padding:12px 14px}
td{padding:12px 14px;border-top:1px solid #edf1f6;font-size:12px;font-weight:700}
.btn{border:1px solid var(--line);background:#fff;color:var(--text);border-radius:9px;padding:9px 15px;font-size:12px;font-weight:800;cursor:pointer}
.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.btn.success{background:var(--cyan);border-color:var(--cyan);color:#fff}
.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
.suggestions-box{position:absolute;top:65px;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.1);max-height:200px;overflow-y:auto;z-index:100;display:none}
.suggestion-item{padding:10px 12px;border-bottom:1px solid #f0f4f9;cursor:pointer;font-size:12px;font-weight:700}
.suggestion-item:hover{background:#f0f6ff}

#ar-ai-widget{position:fixed;bottom:25px;right:25px;z-index:99999}
#ar-ai-btn{background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;border:none;border-radius:50px;padding:12px 22px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 10px 25px rgba(38,116,232,0.3);display:flex;align-items:center;gap:8px}
#ar-ai-box{position:absolute;bottom:60px;right:0;width:350px;background:#fff;border-radius:16px;box-shadow:0 15px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;border:1px solid var(--line)}
.ai-head{background:var(--navy);color:#fff;padding:14px;font-weight:700;font-size:13px;display:flex;justify-content:space-between}
.ai-body{padding:15px;max-height:250px;overflow-y:auto;font-size:12px;display:flex;flex-direction:column;gap:10px}
.ai-foot{padding:10px;border-top:1px solid var(--line);display:flex;gap:8px}
.ai-foot input{flex:1;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;outline:none}

#print-modal, #prescription-modal{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;justify-content:center;align-items:center;z-index:99999;padding:14px}
.print-card{background:#fff;padding:24px;border-radius:14px;width:min(860px,96vw);max-height:92vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,0.3)}
.inv-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;border:1px solid #cbd5e1;padding:10px 12px;border-radius:8px;font-size:12px;margin-bottom:12px}
.print-opts{display:flex;flex-wrap:wrap;gap:10px;background:#f8fafc;border:1px solid var(--line);padding:10px 12px;border-radius:8px;margin-bottom:14px;font-size:11px;font-weight:800}
.print-opts label{display:flex;align-items:center;gap:4px;cursor:pointer}
.col-batch,.col-mfgexp,.col-hsn,.col-mrp,.sec-gst,.sec-bank,.sec-terms{display:table-row-group}
.hide-col{display:none !important}

@media print {
  body * { visibility: hidden !important; }
  #print-card-area, #print-card-area * { visibility: visible !important; }
  #prescription-card-area, #prescription-card-area * { visibility: visible !important; }
  #print-modal, #prescription-modal { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; display: flex !important; align-items: flex-start !important; justify-content: center !important; padding: 0 !important; }
  .print-card { box-shadow: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; max-height: none !important; overflow: visible !important; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 10mm; }
}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-card-wrapper">
    <div class="login-left">
      <h2>Sign In</h2>
      <form id="login-form-element">
        <div class="login-field">
          <label>User ID / Username</label>
          <input type="text" id="login-u" class="login-input" required autocomplete="username">
        </div>
        <div class="login-field">
          <label>Password</label>
          <input type="password" id="login-p" class="login-input" required autocomplete="current-password">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;font-size:12px;">
          <a href="#" id="forgot-link" style="color:#38bdf8;text-decoration:none;font-weight:800;">Forgot User ID?</a>
        </div>
        <button type="submit" class="login-btn">Sign In ➔</button>
      </form>
    </div>
    <div class="login-right">
      <div class="login-right-overlay"></div>
      <div class="login-right-content">
        <h2 style="font-size:20px;font-weight:900;margin:0 0 6px 0;">🏥 A.R. ONLINE ZONE</h2>
        <p style="font-size:13px;font-weight:700;line-height:1.4;margin:0;opacity:0.9;">Complete HIMS • ABDM M1/M2/M3 & NHCX</p>
        <div style="margin-top:10px;font-size:11px;font-weight:800;background:rgba(16,185,129,0.3);padding:4px 10px;border-radius:20px;display:inline-block;">⚡ Live Billing, ABHA & Claims</div>
      </div>
    </div>
  </div>
</div>

<div id="app">
  <aside class="sidebar" id="sidebar-panel">
    <div class="brand"><div class="logo">AR</div><div><strong>AR HEALTHCARE ERP</strong><small>HIMS • ABDM M1/M2/M3 • NHCX</small></div></div>
    <nav class="nav" id="nav-menu"></nav>
  </aside>

  <main class="main">
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:15px;">
        <button class="btn btn-sm" id="sidebar-toggle-btn" style="padding:6px 10px;font-size:14px;">☰</button>
        <h3 id="topbar-title" style="font-size:18px;font-weight:900;color:var(--navy);">Dashboard</h3>
      </div>
      <div class="profile">
        <div class="avatar" id="user-avatar">AR</div>
        <div><strong id="user-display-name" style="font-size:13px;font-weight:900;display:block;">-</strong><small id="user-display-role" style="font-size:11px;font-weight:800;color:var(--muted);">-</small></div>
        <button class="btn btn-sm danger" id="logout-btn" style="margin-left:15px;">Logout</button>
      </div>
    </header>

    <section class="content">
      <div id="view-dashboard" class="view-section active">
        <div class="stats">
          <div class="stat"><div class="stat-label">TOTAL REVENUE (COLLECTED)</div><div class="stat-value" id="m-rev">₹0.00</div></div>
          <div class="stat"><div class="stat-label">CREDIT / UDHAR TOTAL</div><div class="stat-value" id="m-credit" style="color:var(--red);">₹0.00</div></div>
          <div class="stat"><div class="stat-label">REGISTERED PATIENTS</div><div class="stat-value" id="m-pat">0</div></div>
          <div class="stat"><div class="stat-label">ACTIVE IPD BEDS</div><div class="stat-value" id="m-ipd">1 / 20</div></div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Quick Find & Patient Workflow Hub</h3><small style="color:var(--muted)">Search patient instantly & perform any action</small></div>
          <div style="position:relative;margin-bottom:15px;">
            <input type="text" id="dash-quick-find" placeholder="🔍 Type Patient Name, Mobile, ABHA or UHID..." style="width:100%;padding:12px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-weight:700;outline:none;">
            <div class="suggestions-box" id="dash-quick-suggestions"></div>
          </div>
          <table>
            <thead><tr><th>UHID</th><th>Patient Name</th><th>Mobile</th><th>ABHA</th><th>Doctor</th><th>Net Fee (₹)</th><th>Status</th><th>Quick Actions</th></tr></thead>
            <tbody id="dash-patients"></tbody>
          </table>
        </div>
      </div>

      <div id="view-module-container" class="view-section">
        <div class="panel" id="patient-reg-panel" style="display:none;">
          <div class="panel-head"><h3>New Patient Registration & Quick Billing</h3></div>
          <form id="patient-reg-form">
            <div class="form-grid">
              <div class="field"><label>Auto UHID (Date-Wise)</label><input type="text" id="reg-uhid" readonly style="background:#edf2f7;font-weight:900;color:var(--blue);"></div>
              <div class="field"><label>Live Patient Search</label><input type="text" id="live-search-input" placeholder="Type Name, Mobile..." autocomplete="off"><div class="suggestions-box" id="search-suggestions"></div></div>
              <div class="field"><label>Title</label><select id="reg-title"><option>Mr.</option><option>Mrs.</option><option>Miss</option><option>Master</option><option>Baby of</option></select></div>
              <div class="field"><label>Patient Name *</label><input type="text" id="reg-name" required></div>
              <div class="field"><label>Relation</label><select id="reg-relation"><option>S/O</option><option>D/O</option><option>W/O</option><option>C/O</option></select></div>
              <div class="field"><label>Guardian Name</label><input type="text" id="reg-guardian"></div>
              <div class="field"><label>Age *</label><input type="number" id="reg-age" required></div>
              <div class="field"><label>Gender</label><select id="reg-gender"><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div class="field"><label>Mobile No (10-Digit) *</label><input type="text" id="reg-contact" maxlength="10" required placeholder="10 digits"></div>
              <div class="field"><label>Aadhaar No</label><input type="text" id="reg-adhaar" maxlength="12" placeholder="12 digits"></div>
              <div class="field"><label>ABHA Address / ID</label><input type="text" id="reg-abha" placeholder="name@abdm"></div>
              <div class="field"><label>Address</label><input type="text" id="reg-address" placeholder="Address..."></div>
              <div class="field"><label>Consulting Doctor *</label><select id="reg-doctor" required></select></div>
              <div class="field"><label>Doctor Fee (₹) *</label><input type="number" id="reg-fee" required></div>
              <div class="field"><label>Discount (₹)</label><input type="number" id="reg-discount" value="0"></div>
              <div class="field"><label>Net Payable Fee (₹)</label><input type="number" id="reg-netfee" readonly style="background:#edf2f7;font-weight:900;color:var(--green);"></div>
              <div class="field"><label>Payment Type *</label><select id="reg-paytype"><option>Cash</option><option>Credit / Udhar</option><option>UPI / Online</option><option>Card</option></select></div>
            </div>
            <button type="submit" class="btn primary" style="padding:12px 25px;font-size:13px;">💾 Register & Generate Bill</button>
          </form>
        </div>

        <div class="panel" id="abdm-panel" style="display:none;">
          <div class="panel-head"><h3>ABDM HIMS (M1 ABHA Creation • M2 Health Records • M3 & NHCX Claims)</h3></div>
          <form id="abdm-create-form" class="form-grid">
            <div class="field"><label>Patient UHID</label><input type="text" id="abdm-uhid" placeholder="e.g. AR011126-01"></div>
            <div class="field"><label>Patient Full Name *</label><input type="text" id="abdm-name" required placeholder="Full Name"></div>
            <div class="field"><label>Mobile / Aadhaar Ref *</label><input type="text" id="abdm-ref" required placeholder="10-digit Mobile / Aadhaar"></div>
            <div class="field"><label>Preferred ABHA Handle</label><input type="text" id="abdm-handle" placeholder="e.g. rahul.up (auto @abdm)"></div>
            <div class="field"><label>M2 Care Context / Health Record</label><input type="text" id="abdm-m2" placeholder="OPD Prescription / Lab / Discharge"></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">🆔 Create ABHA (M1) & Link M2 Record</button></div>
          </form>
          <hr style="border:0;border-top:1px solid var(--line);margin:18px 0;">
          <form id="nhcx-claim-form" class="form-grid">
            <div class="field"><label>Claim Patient UHID *</label><input type="text" id="nhcx-uhid" required placeholder="UHID"></div>
            <div class="field"><label>Patient Name *</label><input type="text" id="nhcx-name" required placeholder="Patient Name"></div>
            <div class="field"><label>NHCX Payer / TPA</label><input type="text" id="nhcx-payer" value="National Health Claims Exchange (NHCX)"></div>
            <div class="field"><label>M3 / NHCX Workflow Type</label><select id="nhcx-type"><option>Cashless Pre-Auth</option><option>Claim Submission</option><option>Enhancement Request</option></select></div>
            <div class="field"><label>Claim Amount (₹) *</label><input type="number" id="nhcx-amount" required placeholder="0"></div>
            <div style="display:flex;align-items:flex-end;"><button type="submit" class="btn success" style="width:100%;">📤 Submit to NHCX (M3)</button></div>
          </form>
        </div>

        <div class="panel" id="opd-panel" style="display:none;">
          <div class="panel-head"><h3>Book OPD Appointment / Token</h3></div>
          <form id="opd-book-form" class="form-grid">
            <div class="field"><label>Patient UHID / Name *</label><input type="text" id="opd-search-uhid" placeholder="Enter UHID or Name" required></div>
            <div class="field"><label>Select Doctor *</label><select id="opd-doctor" required></select></div>
            <div class="field"><label>Time Slot</label><select id="opd-slot"><option>Morning Session (10 AM - 1 PM)</option><option>Evening Session (5 PM - 8 PM)</option></select></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">🎫 Book OPD Appointment & Generate Token</button></div>
          </form>
        </div>

        <div class="panel" id="ipd-panel" style="display:none;">
          <div class="panel-head"><h3>IPD Patient Admission</h3></div>
          <form id="ipd-admit-form" class="form-grid">
            <div class="field"><label>Patient UHID *</label><input type="text" id="ipd-uhid" placeholder="Enter UHID..." required></div>
            <div class="field"><label>Patient Name *</label><input type="text" id="ipd-name" placeholder="Patient Name..." required></div>
            <div class="field"><label>Select Ward / Bed *</label><select id="ipd-ward" required><option value="General Ward - Bed 01">General Ward - Bed 01</option><option value="Private Room - Bed 01">Private Room - Bed 01</option><option value="ICU - Bed 01">ICU - Bed 01</option></select></div>
            <div class="field"><label>Consulting Doctor *</label><select id="ipd-doctor" required></select></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">🛏 Admit Patient to IPD</button></div>
          </form>
        </div>

        <div class="panel" id="wards-panel" style="display:none;">
          <div class="panel-head"><h3>Manage Wards & Beds Setup</h3></div>
          <form id="ward-add-form" class="form-grid">
            <div class="field"><label>Ward Name *</label><input type="text" id="w-name" placeholder="e.g. Deluxe Ward" required></div>
            <div class="field"><label>Total Beds *</label><input type="number" id="w-beds" placeholder="10" required></div>
            <div class="field"><label>Daily Charge (₹) *</label><input type="number" id="w-charge" placeholder="1000" required></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">+ Add New Ward</button></div>
          </form>
        </div>

        <div class="panel" id="lab-panel" style="display:none;">
          <div class="panel-head"><h3>Laboratory Test & Report Entry</h3></div>
          <form id="lab-add-form" class="form-grid">
            <div class="field"><label>UHID *</label><input type="text" id="lab-uhid" required placeholder="AR011126-01"></div>
            <div class="field"><label>Patient Name *</label><input type="text" id="lab-name" required placeholder="Patient Name"></div>
            <div class="field"><label>Test Name *</label><input type="text" id="lab-test" required placeholder="e.g. Complete Blood Count (CBC)"></div>
            <div class="field" style="grid-column:span 2;"><label>Test Values / Findings *</label><input type="text" id="lab-result" required placeholder="Hb, WBC, Platelets, LFT, KFT values..."></div>
            <div style="display:flex;align-items:flex-end;"><button type="submit" class="btn primary" style="width:100%;">🧪 Save Lab Report</button></div>
          </form>
        </div>

        <div class="panel" id="pharmacy-panel" style="display:none;">
          <div class="panel-head"><h3>Add Medicine / Pharmacy Item</h3></div>
          <form id="pharmacy-add-form" class="form-grid">
            <div class="field"><label>Medicine / Product Name *</label><input type="text" id="med-name" required placeholder="Paracetamol 650mg"></div>
            <div class="field"><label>Batch No *</label><input type="text" id="med-batch" required placeholder="B2601"></div>
            <div class="field"><label>HSN Code</label><input type="text" id="med-hsn" value="30049099"></div>
            <div class="field"><label>Qty *</label><input type="number" id="med-qty" required placeholder="100"></div>
            <div class="field"><label>MRP (₹)</label><input type="number" id="med-mrp" placeholder="30"></div>
            <div class="field"><label>Rate (₹) *</label><input type="number" id="med-rate" required placeholder="25"></div>
            <div style="grid-column:span 3;"><button type="submit" class="btn primary">+ Add Pharmacy Stock</button></div>
          </form>
        </div>

        <div class="panel" id="doctor-panel" style="display:none;">
          <div class="panel-head"><h3>Manage Doctors (Add New Doctor ID/Name)</h3></div>
          <form id="doctor-form" class="form-grid">
            <div class="field"><label>Doctor Name & Qualification *</label><input type="text" id="doc-name" placeholder="Dr. Name (Specialization)" required></div>
            <div class="field"><label>Default Consultation Fee (₹) *</label><input type="number" id="doc-fee" required></div>
            <div class="field"><label>Department</label><input type="text" id="doc-dept" placeholder="General / Ortho / Gynae"></div>
            <div style="grid-column: span 3;"><button type="submit" class="btn primary">+ Save New Doctor</button></div>
          </form>
        </div>

        <div class="panel" id="user-mgmt-panel" style="display:none;">
          <div class="panel-head"><h3>Create User & Dynamic Permissions</h3></div>
          <form id="user-create-form" class="form-grid" style="grid-template-columns:1fr 1fr;">
            <div class="field"><label>Full Name *</label><input type="text" id="new-u-name" required></div>
            <div class="field"><label>User ID / Username *</label><input type="text" id="new-u-username" required></div>
            <div class="field"><label>Password *</label><input type="password" id="new-u-password" required></div>
            <div class="field"><label>Role *</label><select id="new-u-role"><option>Cashier / Receptionist</option><option>Pharmacist</option><option>Doctor</option><option>Accountant</option></select></div>
            <div class="field" style="grid-column:span 2;">
              <label>Select Module Permissions:</label>
              <div id="permission-checkboxes" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px;font-size:12px;font-weight:700;background:#f8fafd;padding:12px;border:1px solid var(--line);border-radius:8px;">
                <label><input type="checkbox" value="patients" checked> Patient Registration</label>
                <label><input type="checkbox" value="patient-search" checked> Patient Search Master</label>
                <label><input type="checkbox" value="abdm-hims" checked> ABDM M1/M2/M3 & NHCX</label>
                <label><input type="checkbox" value="opd"> OPD & Appointments</label>
                <label><input type="checkbox" value="ipd"> IPD Admissions</label>
                <label><input type="checkbox" value="doctors"> Doctors & Departments</label>
                <label><input type="checkbox" value="hospital-billing" checked> Hospital Billing</label>
                <label><input type="checkbox" value="pharmacy"> Pharmacy Dashboard</label>
                <label><input type="checkbox" value="medicines"> Medicine Master</label>
                <label><input type="checkbox" value="accounts"> Accounts Dashboard</label>
              </div>
            </div>
            <div style="grid-column: span 2;"><button type="submit" class="btn primary">👤 Create User Account</button></div>
          </form>
        </div>

        <div class="panel" id="backup-panel" style="display:none;">
          <div class="panel-head"><h3>Settings, Institute Header & Invoice Bank/GST Setup</h3></div>
          <form id="institute-form" class="form-grid">
            <div class="field"><label>Institute / Hospital / Pharmacy Name *</label><input type="text" id="inst-name" required></div>
            <div class="field"><label>Tagline / Subtitle *</label><input type="text" id="inst-tagline" required></div>
            <div class="field"><label>Address / Location *</label><input type="text" id="inst-address" required></div>
            <div class="field"><label>GSTIN</label><input type="text" id="inst-gstin"></div>
            <div class="field"><label>Phone</label><input type="text" id="inst-phone"></div>
            <div class="field"><label>UPI ID</label><input type="text" id="inst-upi"></div>
            <div class="field"><label>Bank Name</label><input type="text" id="inst-bank"></div>
            <div class="field"><label>Account No</label><input type="text" id="inst-acc"></div>
            <div class="field"><label>IFSC</label><input type="text" id="inst-ifsc"></div>
            <div style="grid-column:span 3;"><button type="submit" class="btn primary">💾 Save Institute & Billing Settings</button></div>
          </form>
        </div>

        <div class="panel" id="password-panel" style="display:none;">
          <div class="panel-head"><h3>Change Your Account Password</h3></div>
          <form id="password-change-form" style="max-width:400px;display:flex;flex-direction:column;gap:15px;">
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
    <div class="ai-head"><span>🤖 AR AI Assistant</span><span style="cursor:pointer;" id="ai-close-btn">✕</span></div>
    <div class="ai-body" id="ai-chat-body">
      <div><b>AR AI:</b> Hello Aarif! Ask me about patients, revenue, credit bills, ABHA (M1/M2/M3) or NHCX.</div>
    </div>
    <div class="ai-foot">
      <input type="text" id="ai-input" placeholder="Ask AR AI...">
      <button class="btn primary" id="ai-send-btn">Send</button>
    </div>
  </div>
  <button id="ar-ai-btn">✨ AR AI</button>
</div>

<!-- Customizable Tax / Pharmacy / Hospital Bill Print Modal -->
<div id="print-modal">
  <div class="print-card" id="print-card-area">
    <div class="print-opts no-print">
      <span style="color:var(--navy);">PRINT SETTINGS:</span>
      <label><input type="checkbox" id="opt-batch" checked> Batch</label>
      <label><input type="checkbox" id="opt-mfgexp" checked> MFG/EXP</label>
      <label><input type="checkbox" id="opt-hsn" checked> HSN/SAC</label>
      <label><input type="checkbox" id="opt-mrp" checked> MRP</label>
      <label><input type="checkbox" id="opt-gst" checked> GST Breakup</label>
      <label><input type="checkbox" id="opt-bank" checked> Bank/UPI</label>
      <label><input type="checkbox" id="opt-terms" checked> Terms & Sign</label>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:12px;">
      <div>
        <h2 style="margin:0;color:var(--navy);font-weight:900;font-size:20px;" id="print-inst-name">A.R. MEDICAL COLLEGE & HEALTHCARE</h2>
        <p style="margin:3px 0;font-size:11px;font-weight:700;color:var(--muted);" id="print-inst-address">Village Badahara Rani, Maharajganj, Uttar Pradesh</p>
        <div style="font-size:11px;font-weight:800;">GSTIN: <span id="print-inst-gstin">09AABCA1234F1Z5</span> | Ph: <span id="print-inst-phone">+91 9005554424</span></div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:900;color:var(--blue);">TAX / BILL INVOICE</div>
        <div style="font-size:11px;font-weight:800;">ORIGINAL FOR RECIPIENT</div>
      </div>
    </div>

    <div class="inv-grid">
      <div>
        <div><strong>Patient / Customer:</strong> <span id="pb-name"></span></div>
        <div><strong>UHID:</strong> <span id="pb-uhid"></span> | <strong>Phone:</strong> <span id="pb-contact"></span></div>
        <div><strong>Address:</strong> <span id="pb-address"></span></div>
        <div><strong>Doctor:</strong> <span id="pb-doctor"></span></div>
      </div>
      <div>
        <div><strong>Invoice No:</strong> <span id="pb-billno"></span></div>
        <div><strong>Date & Time:</strong> <span id="pb-datetime"></span></div>
        <div><strong>Payment Mode:</strong> <span id="pb-paymode" style="color:var(--blue);font-weight:900;">Cash</span></div>
        <div><strong>Billed By:</strong> <span id="pb-user"></span></div>
      </div>
    </div>

    <table style="width:100%;margin:10px 0;border:1px solid #cbd5e1;">
      <thead>
        <tr>
          <th>#</th>
          <th>Product / Service</th>
          <th class="col-batch">Batch</th>
          <th class="col-mfgexp">MFG / EXP</th>
          <th class="col-hsn">HSN</th>
          <th>Qty</th>
          <th class="col-mrp">MRP</th>
          <th>Rate</th>
          <th>Disc</th>
          <th>Taxable</th>
          <th>GST</th>
          <th>Total (₹)</th>
        </tr>
      </thead>
      <tbody id="pb-items-tbody"></tbody>
    </table>

    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;margin-top:12px;font-size:12px;">
      <div>
        <div class="sec-gst" style="border:1px solid #cbd5e1;padding:8px 10px;border-radius:6px;margin-bottom:8px;">
          <strong>Tax Summary:</strong> Taxable: ₹<span id="pb-taxable">0.00</span> | GST: ₹<span id="pb-gst">0.00</span> | Disc: ₹<span id="pb-disc">0.00</span>
        </div>
        <div class="sec-bank" style="border:1px solid #cbd5e1;padding:8px 10px;border-radius:6px;">
          <div><strong>Bank:</strong> <span id="pb-bank"></span> (<span id="pb-acc"></span> / <span id="pb-ifsc"></span>)</div>
          <div><strong>UPI ID:</strong> <span id="pb-upi"></span></div>
        </div>
      </div>
      <div style="border:1px solid #cbd5e1;padding:10px 12px;border-radius:6px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Gross Amount:</span><span id="pb-gross">₹0.00</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Discount:</span><span id="pb-disc-val">₹0.00</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>GST Total:</span><span id="pb-gst-val">₹0.00</span></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:var(--green);border-top:1px solid #cbd5e1;padding-top:6px;">
          <span>Net Payable (<span id="pb-pay-status">Paid</span>):</span>
          <span id="pb-amount">₹0.00</span>
        </div>
      </div>
    </div>

    <div class="sec-terms" style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:11px;">
      <div style="max-width:60%;color:var(--muted);">
        <strong>Terms:</strong> Goods/services billed as per hospital/pharmacy tariff. Subject to local jurisdiction. E. & O.E.
      </div>
      <div style="text-align:right;font-weight:800;">
        <div style="margin-bottom:22px;">_________________________</div>
        <div>Authorised Signatory</div>
      </div>
    </div>

    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
      <button class="btn" id="print-modal-close-btn">Close</button>
      <button class="btn success" id="print-modal-presc-btn">📝 Open Prescription</button>
      <button class="btn" id="print-modal-edit-btn">✏️ Edit Bill</button>
      <button class="btn primary" id="print-modal-print-btn">🖨 Print A4 Bill</button>
    </div>
  </div>
</div>

<!-- Prescription Modal -->
<div id="prescription-modal">
  <div class="print-card" id="prescription-card-area" style="width:min(800px,96vw);max-height:92vh;overflow-y:auto;">
    <div style="text-align:center;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:15px;">
      <h2 style="margin:0;color:var(--navy);font-weight:900;" id="presc-inst-name">A.R. MEDICAL COLLEGE & HEALTHCARE</h2>
      <p style="margin:4px 0;font-size:11px;font-weight:800;color:var(--muted);" id="presc-inst-address">Village Badahara Rani, Maharajganj, Uttar Pradesh</p>
      <h3 style="margin:8px 0;color:var(--blue);font-weight:900;">OPD Prescription Sheet</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;font-weight:700;margin-bottom:12px;border:1px solid var(--line);padding:10px;border-radius:8px;">
      <div><strong>UHID:</strong> <span id="pr-uhid"></span></div>
      <div><strong>Date:</strong> <span id="pr-date"></span></div>
      <div><strong>Patient Name:</strong> <span id="pr-name"></span></div>
      <div><strong>Age / Sex:</strong> <span id="pr-age"></span></div>
      <div><strong>Guardian:</strong> <span id="pr-guardian"></span></div>
      <div><strong>Contact:</strong> <span id="pr-contact"></span></div>
      <div><strong>Doctor Name:</strong> <span id="pr-doctor"></span></div>
      <div><strong>Address:</strong> <span id="pr-address"></span></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;background:#f8fafd;padding:10px;border-radius:8px;font-size:12px;">
      <div><label>BP:</label> <input type="text" id="vital-bp" value="" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div>
      <div><label>Pulse:</label> <input type="text" id="vital-pulse" value="" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div>
      <div><label>Temp:</label> <input type="text" id="vital-temp" value="" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div>
      <div><label>Weight:</label> <input type="text" id="vital-wt" value="" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;"></div>
    </div>

    <div style="display:grid;grid-template-columns:220px 1fr;gap:15px;margin-bottom:15px;">
      <div style="border-right:1px solid var(--line);padding-right:12px;">
        <label style="font-size:12px;font-weight:900;color:var(--navy);display:block;margin-bottom:6px;">Investigation / Advice:</label>
        <textarea id="pr-investigation" style="width:100%;height:220px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:12px;font-weight:700;"></textarea>
      </div>
      <div>
        <div style="margin-bottom:8px;font-size:18px;font-weight:900;color:var(--blue);">Rx</div>
        <textarea id="pr-treatment" style="width:100%;height:220px;padding:8px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-weight:700;"></textarea>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:10px;margin-top:10px;font-size:12px;font-weight:800;">
      <div><span>Next Visit: </span><input type="text" id="pr-nextvisit" value="" style="padding:4px;border:1px solid var(--line);border-radius:4px;width:140px;"></div>
      <div style="text-align:right;">
        <div style="margin-bottom:25px;">___________________________</div>
        <div>Doctor Signature</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:10px;font-size:10px;color:var(--muted);font-weight:700;border-top:1px dashed var(--line);padding-top:6px;">
      * Note: This prescription is not for medico-legal purposes.
    </div>

    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:15px;">
      <button class="btn" id="presc-close-btn">Close</button>
      <button class="btn primary" id="presc-print-btn">🖨 Print Official Prescription</button>
    </div>
  </div>
</div>

<script>
let currentUser = null;
let activeModuleKey = 'dashboard';
let doctorsList = [];
let currentActiveBillNo = '';
let instituteDetails = { name: '', tagline: '', address: '', gstin: '', phone: '', bankName: '', accountNo: '', ifsc: '', upiId: '' };

const navGroups = [
  { label: "OVERVIEW", items: [["Dashboard", "dashboard", "▦"], ["Notifications", "notifications", "♧"], ["Tasks & Approvals", "approvals", "✓"]] },
  { label: "ABDM HIMS & NHCX (M1/M2/M3)", items: [["ABHA & NHCX Hub", "abdm-hims", "🆔"], ["NHCX Claims (M3)", "nhcx", "📤"]] },
  { label: "HOSPITAL MANAGEMENT", items: [["Patient Registration", "patients", "＋"], ["Patient Search", "patient-search", "⌕"], ["OPD & Appointments", "opd", "🩺"], ["IPD Admissions", "ipd", "🛏"], ["Wards & Beds", "wards", "🏢"], ["Doctors & Departments", "doctors", "✚"], ["Nursing Station", "nursing", "👩‍⚕️"], ["Laboratory", "lab", "🧪"], ["Radiology", "radiology", "🩻"], ["OT & ICU", "ot-icu", "⚡"], ["Discharge Management", "discharge", "📋"], ["Hospital Billing", "hospital-billing", "₹"], ["Medical Records", "medical-records", "▧"]] },
  { label: "PHARMACY", items: [["Pharmacy Dashboard", "pharmacy", "✚"], ["Medicine Master", "medicines", "▤"], ["Batch & Strip Stock", "batch-stock", "📦"], ["Purchase Entry", "purchase-entry", "🛒"], ["Sales Billing", "sales-billing", "💵"], ["Sales Return", "sales-return", "↩"], ["Expiry & Low Stock", "stock-alerts", "⚠"], ["Pharmacy Reports", "pharmacy-reports", "📊"]] },
  { label: "CENTRAL STORE & PURCHASE", items: [["Inventory Dashboard", "inv-dash", "📊"], ["Item Master", "item-master", "📦"], ["Warehouses & Stores", "warehouses", "🏭"], ["Goods Receipt (GRN)", "grn", "📥"], ["Stock Ledger", "stock-ledger", "📖"], ["Purchase Orders", "po", "📝"]] },
  { label: "BIOMEDICAL ENGINEERING", items: [["Biomedical Dashboard", "biomed-dash", "⚡"], ["Equipment Assets", "equipment", "💻"], ["Work Orders & Repairs", "repairs", "🛠"], ["Preventive Maintenance", "pm", "🛡"], ["AMC / CMC Contracts", "amc", "📜"]] },
  { label: "FINANCE & HRMS", items: [["Accounts Dashboard", "accounts", "🏦"], ["Income & Expenses", "income-expenses", "📈"], ["Cash & Bank", "cash-bank", "💰"], ["Payroll", "payroll", "💳"]] },
  { label: "REPORTS & ADMINISTRATION", items: [["Reports & Analytics", "reports", "📊"], ["User & Role Management", "users", "♙"], ["Change Password", "password", "⚙"], ["Audit Logs", "audit-logs", "☷"], ["Settings & Backup", "backup", "💾"]] }
];

window.addEventListener('DOMContentLoaded', () => {
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
    loadInstituteDetails();
    switchView(savedPage || 'dashboard');
  }

  document.getElementById('login-form-element').addEventListener('submit', handleLogin);
  document.getElementById('sidebar-toggle-btn').addEventListener('click', toggleSidebarSlide);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('dash-quick-find').addEventListener('input', (e) => handleDashQuickFind(e.target.value));
  document.getElementById('patient-reg-form').addEventListener('submit', handlePatientRegistration);
  document.getElementById('abdm-create-form').addEventListener('submit', handleCreateAbha);
  document.getElementById('nhcx-claim-form').addEventListener('submit', handleNhcxClaim);
  document.getElementById('opd-book-form').addEventListener('submit', handleOpdAppointment);
  document.getElementById('ipd-admit-form').addEventListener('submit', handleIpdAdmission);
  document.getElementById('ward-add-form').addEventListener('submit', handleAddWard);
  document.getElementById('lab-add-form').addEventListener('submit', handleAddLab);
  document.getElementById('pharmacy-add-form').addEventListener('submit', handleAddPharmacy);
  document.getElementById('doctor-form').addEventListener('submit', handleAddNewDoctor);
  document.getElementById('user-create-form').addEventListener('submit', handleCreateUser);
  document.getElementById('password-change-form').addEventListener('submit', handleChangePassword);
  document.getElementById('institute-form').addEventListener('submit', handleInstituteUpdate);
  document.getElementById('ai-close-btn').addEventListener('click', toggleAiBox);
  document.getElementById('ai-send-btn').addEventListener('click', sendAiQuery);
  document.getElementById('ai-input').addEventListener('keypress', (e) => { if(e.key==='Enter') sendAiQuery(); });
  document.getElementById('ar-ai-btn').addEventListener('click', toggleAiBox);

  ['opt-batch','opt-mfgexp','opt-hsn','opt-mrp','opt-gst','opt-bank','opt-terms'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyPrintOptions);
  });

  document.getElementById('print-modal-close-btn').addEventListener('click', () => { document.getElementById('print-modal').style.display = 'none'; });
  document.getElementById('print-modal-presc-btn').addEventListener('click', () => { openPrescriptionSheet(document.getElementById('pb-uhid').innerText); });
  document.getElementById('print-modal-edit-btn').addEventListener('click', requestBillEdit);
  document.getElementById('print-modal-print-btn').addEventListener('click', () => {
    applyPrintOptions();
    document.getElementById('print-modal').style.display = 'flex';
    document.getElementById('prescription-modal').style.display = 'none';
    window.print();
  });
  document.getElementById('presc-close-btn').addEventListener('click', () => { document.getElementById('prescription-modal').style.display = 'none'; });
  document.getElementById('presc-print-btn').addEventListener('click', () => {
    document.getElementById('prescription-modal').style.display = 'flex';
    document.getElementById('print-modal').style.display = 'none';
    window.print();
  });
  document.getElementById('live-search-input').addEventListener('input', (e) => handleLiveSearch(e.target.value));
  document.getElementById('reg-doctor').addEventListener('change', autoFetchDoctorFee);
  document.getElementById('reg-fee').addEventListener('input', calculateNetFee);
  document.getElementById('reg-discount').addEventListener('input', calculateNetFee);
  document.getElementById('forgot-link').addEventListener('click', (e) => { e.preventDefault(); alert('Please contact your Super Admin to recover your User ID & Password.'); });
});

function applyPrintOptions() {
  const showBatch = document.getElementById('opt-batch').checked;
  const showMfgExp = document.getElementById('opt-mfgexp').checked;
  const showHsn = document.getElementById('opt-hsn').checked;
  const showMrp = document.getElementById('opt-mrp').checked;
  const showGst = document.getElementById('opt-gst').checked;
  const showBank = document.getElementById('opt-bank').checked;
  const showTerms = document.getElementById('opt-terms').checked;

  document.querySelectorAll('.col-batch').forEach(el => el.classList.toggle('hide-col', !showBatch));
  document.querySelectorAll('.col-mfgexp').forEach(el => el.classList.toggle('hide-col', !showMfgExp));
  document.querySelectorAll('.col-hsn').forEach(el => el.classList.toggle('hide-col', !showHsn));
  document.querySelectorAll('.col-mrp').forEach(el => el.classList.toggle('hide-col', !showMrp));
  document.querySelectorAll('.sec-gst').forEach(el => el.classList.toggle('hide-col', !showGst));
  document.querySelectorAll('.sec-bank').forEach(el => el.classList.toggle('hide-col', !showBank));
  document.querySelectorAll('.sec-terms').forEach(el => el.classList.toggle('hide-col', !showTerms));
}

async function loadInstituteDetails() {
  const res = await fetch('/api/institute');
  const data = await res.json();
  if (data.success) {
    instituteDetails = data.institute;
    document.getElementById('print-inst-name').innerText = instituteDetails.name;
    document.getElementById('print-inst-address').innerText = instituteDetails.tagline + ' • ' + instituteDetails.address;
    document.getElementById('print-inst-gstin').innerText = instituteDetails.gstin || '-';
    document.getElementById('print-inst-phone').innerText = instituteDetails.phone || '-';
    document.getElementById('presc-inst-name').innerText = instituteDetails.name;
    document.getElementById('presc-inst-address').innerText = instituteDetails.tagline + ' • ' + instituteDetails.address;

    document.getElementById('pb-bank').innerText = instituteDetails.bankName || '-';
    document.getElementById('pb-acc').innerText = instituteDetails.accountNo || '-';
    document.getElementById('pb-ifsc').innerText = instituteDetails.ifsc || '-';
    document.getElementById('pb-upi').innerText = instituteDetails.upiId || '-';

    if (document.getElementById('inst-name')) {
      document.getElementById('inst-name').value = instituteDetails.name || '';
      document.getElementById('inst-tagline').value = instituteDetails.tagline || '';
      document.getElementById('inst-address').value = instituteDetails.address || '';
      document.getElementById('inst-gstin').value = instituteDetails.gstin || '';
      document.getElementById('inst-phone').value = instituteDetails.phone || '';
      document.getElementById('inst-upi').value = instituteDetails.upiId || '';
      document.getElementById('inst-bank').value = instituteDetails.bankName || '';
      document.getElementById('inst-acc').value = instituteDetails.accountNo || '';
      document.getElementById('inst-ifsc').value = instituteDetails.ifsc || '';
    }
  }
}

async function handleInstituteUpdate(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('inst-name').value,
    tagline: document.getElementById('inst-tagline').value,
    address: document.getElementById('inst-address').value,
    gstin: document.getElementById('inst-gstin').value,
    phone: document.getElementById('inst-phone').value,
    upiId: document.getElementById('inst-upi').value,
    bankName: document.getElementById('inst-bank').value,
    accountNo: document.getElementById('inst-acc').value,
    ifsc: document.getElementById('inst-ifsc').value
  };
  const res = await fetch('/api/institute', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) loadInstituteDetails();
}

function toggleSidebarSlide() {
  const sb = document.getElementById('sidebar-panel');
  sb.style.marginLeft = sb.style.marginLeft === '-276px' ? '0' : '-276px';
}

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
      loadInstituteDetails();
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
  navGroups.forEach(function(g) {
    let groupItemsHtml = '';
    g.items.forEach(function(i) {
      if (currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.isDemo || currentUser.permissions.includes('all') || currentUser.permissions.includes(i[1])) {
        groupItemsHtml += '<button class="nav-item ' + (i[1] === activeModuleKey ? 'active' : '') + '" id="nav-btn-' + i[1] + '" data-key="' + i[1] + '"><span class="nav-icon">' + i[2] + '</span><span>' + i[0] + '</span></button>';
      }
    });
    if (groupItemsHtml !== '') {
      html += '<div class="nav-label">' + g.label + '</div>' + groupItemsHtml;
    }
  });
  const navMenu = document.getElementById('nav-menu');
  navMenu.innerHTML = html;
  navMenu.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-key')));
  });
}

async function loadDoctors() {
  const res = await fetch('/api/doctors');
  doctorsList = await res.json();
  let opt = '<option value="">-- Select Doctor --</option>';
  doctorsList.forEach(function(d) {
    opt += '<option value="' + d.name + '">' + d.name + ' (Fee: ₹' + d.fee + ')</option>';
  });
  ['reg-doctor', 'opd-doctor', 'ipd-doctor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opt;
  });
}

function autoFetchDoctorFee() {
  const docName = document.getElementById('reg-doctor').value;
  const doc = doctorsList.find(function(d) { return d.name === docName; });
  if (doc) {
    document.getElementById('reg-fee').value = doc.fee;
    calculateNetFee();
  }
}

function calculateNetFee() {
  const fee = Number(document.getElementById('reg-fee').value || 0);
  const disc = Number(document.getElementById('reg-discount').value || 0);
  document.getElementById('reg-netfee').value = Math.max(0, fee - disc);
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

  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  const activeBtn = document.getElementById('nav-btn-' + targetKey);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.view-section').forEach(function(v) { v.classList.remove('active'); });

  if (targetKey === 'dashboard') {
    document.getElementById('view-dashboard').classList.add('active');
    loadDashboardMetrics();
  } else {
    document.getElementById('view-module-container').classList.add('active');
    document.getElementById('patient-reg-panel').style.display = (targetKey === 'patients' || targetKey === 'patient-search') ? 'block' : 'none';
    document.getElementById('abdm-panel').style.display = (targetKey === 'abdm-hims' || targetKey === 'nhcx') ? 'block' : 'none';
    document.getElementById('opd-panel').style.display = (targetKey === 'opd') ? 'block' : 'none';
    document.getElementById('ipd-panel').style.display = (targetKey === 'ipd') ? 'block' : 'none';
    document.getElementById('wards-panel').style.display = (targetKey === 'wards') ? 'block' : 'none';
    document.getElementById('lab-panel').style.display = (targetKey === 'lab') ? 'block' : 'none';
    document.getElementById('pharmacy-panel').style.display = (targetKey === 'pharmacy' || targetKey === 'medicines') ? 'block' : 'none';
    document.getElementById('doctor-panel').style.display = (targetKey === 'doctors') ? 'block' : 'none';
    document.getElementById('user-mgmt-panel').style.display = (targetKey === 'users' && (currentUser.role === 'Super Admin' || currentUser.role === 'Admin')) ? 'block' : 'none';
    document.getElementById('backup-panel').style.display = (targetKey === 'backup') ? 'block' : 'none';
    document.getElementById('password-panel').style.display = (targetKey === 'password') ? 'block' : 'none';

    if (targetKey === 'patients' || targetKey === 'patient-search') {
      fetchNextUHID();
    }
    loadUniqueModuleData(targetKey);
  }

  const foundItem = navGroups.flatMap(function(g) { return g.items; }).find(function(i) { return i[1] === targetKey; });
  document.getElementById('topbar-title').innerText = foundItem ? foundItem[0].toUpperCase() : targetKey.toUpperCase();
}

async function loadDashboardMetrics() {
  const res = await fetch('/api/dashboard/metrics');
  const data = await res.json();
  if (data.success) {
    document.getElementById('m-rev').innerText = '₹' + data.totalRevenue.toFixed(2);
    document.getElementById('m-credit').innerText = '₹' + data.creditTotal.toFixed(2);
    document.getElementById('m-pat').innerText = data.registeredPatients;
    document.getElementById('m-ipd').innerText = data.activeIpdBeds + ' / 20';
  }

  const pRes = await fetch('/api/module/patients');
  const pData = await pRes.json();
  let html = '';
  (pData.data || []).forEach(function(p) {
    html += '<tr>' +
      '<td><b>' + p.uhid + '</b></td>' +
      '<td>' + p.title + ' ' + p.name + '</td>' +
      '<td>' + p.contact + '</td>' +
      '<td>' + (p.abha || '-') + '</td>' +
      '<td>' + p.doctor + '</td>' +
      '<td style="font-weight:900;">₹' + p.netFee + ' (' + p.payType + ')</td>' +
      '<td><span style="background:#eef6ff;color:var(--blue);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:800;">' + (p.workflowStatus || 'Active') + '</span></td>' +
      '<td>' +
        '<button class="btn btn-sm primary action-presc-btn" data-uhid="' + p.uhid + '">📝 Rx</button> ' +
        '<button class="btn btn-sm success action-bill-btn" data-uhid="' + p.uhid + '">🖨 Bill</button>' +
      '</td>' +
    '</tr>';
  });
  const tbody = document.getElementById('dash-patients');
  tbody.innerHTML = html;

  tbody.querySelectorAll('.action-presc-btn').forEach(btn => {
    btn.addEventListener('click', () => openPrescriptionSheet(btn.getAttribute('data-uhid')));
  });
  tbody.querySelectorAll('.action-bill-btn').forEach(btn => {
    btn.addEventListener('click', () => openBillingModalByUHID(btn.getAttribute('data-uhid')));
  });
}

async function handleDashQuickFind(val) {
  const box = document.getElementById('dash-quick-suggestions');
  if (val.trim().length < 2) { box.style.display = 'none'; return; }
  const res = await fetch('/api/patients/search?q=' + encodeURIComponent(val));
  const data = await res.json();
  if (!data.length) { box.style.display = 'none'; return; }
  box.innerHTML = data.map(p => `<div class="suggestion-item quick-sugg-item" data-uhid="${p.uhid}"><strong>${p.title} ${p.name}</strong> (${p.uhid}) | Mob: ${p.contact}</div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.quick-sugg-item').forEach(item => {
    item.addEventListener('click', () => { openPrescriptionSheet(item.getAttribute('data-uhid')); box.style.display = 'none'; });
  });
}

async function loadUniqueModuleData(key) {
  const heading = document.getElementById('module-title-heading');
  if (heading) heading.innerText = key.toUpperCase().replace('-', ' ') + ' RECORDS';

  const res = await fetch('/api/module/' + key);
  const json = await res.json();
  const list = (json.data || []).map(row => {
    if (row.items) {
      return {
        billNo: row.billNo,
        uhid: row.uhid,
        patientName: row.patientName,
        doctor: row.doctor,
        payType: row.payType,
        gross: row.totalGross,
        gst: row.totalGst,
        netFee: row.netFee,
        dateTime: row.dateTime
      };
    }
    return row;
  });

  if (!list.length) {
    document.getElementById('module-thead').innerHTML = '<tr><th>Status</th></tr>';
    document.getElementById('module-tbody').innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--muted);">No records available.</td></tr>';
    return;
  }

  const columns = Object.keys(list[0]);
  const hasBillPrint = list[0].billNo !== undefined;
  document.getElementById('module-thead').innerHTML = '<tr>' +
    columns.map(c => '<th>' + c.toUpperCase() + '</th>').join('') +
    (key === 'users' ? '<th>ACTIONS & PERMISSIONS</th>' : '') +
    (hasBillPrint ? '<th>INVOICE</th>' : '') +
    '</tr>';

  let rows = '';
  list.forEach(row => {
    rows += '<tr>' + columns.map(c => '<td>' + (row[c] !== undefined ? row[c] : '—') + '</td>').join('');
    if (key === 'users') {
      const isAct = row.status === 'Active';
      if (row.isProtected) {
        rows += '<td><span style="color:var(--green);font-weight:900;">🔒 Locked (Super Admin)</span></td>';
      } else {
        rows += '<td>' +
          '<button class="btn btn-sm ' + (isAct ? 'danger' : 'success') + ' toggle-status-btn" data-id="' + row.id + '" data-status="' + (isAct ? 'Deactivated' : 'Active') + '">' + (isAct ? 'Deactivate' : 'Activate') + '</button> ' +
          '<button class="btn btn-sm primary edit-perm-btn" data-id="' + row.id + '" data-name="' + row.name + '">⚙ Edit Perms</button>' +
          '</td>';
      }
    }
    if (hasBillPrint) {
      rows += '<td><button class="btn btn-sm primary open-inv-btn" data-billno="' + row.billNo + '">🖨 Print Bill</button></td>';
    }
    rows += '</tr>';
  });

  const tbody = document.getElementById('module-tbody');
  tbody.innerHTML = rows;

  tbody.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleUserStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status')));
  });
  tbody.querySelectorAll('.edit-perm-btn').forEach(btn => {
    btn.addEventListener('click', () => editUserPermissions(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
  });
  tbody.querySelectorAll('.open-inv-btn').forEach(btn => {
    btn.addEventListener('click', () => openBillingModalByBillNo(btn.getAttribute('data-billno')));
  });
}

async function editUserPermissions(userId, userName) {
  const newPerms = prompt("Enter comma-separated permissions for " + userName + ":", "patients, patient-search, hospital-billing, abdm-hims");
  if (!newPerms) return;
  const permsArr = newPerms.split(',').map(s => s.trim());
  const res = await fetch('/api/users/permissions', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ userId, permissions: permsArr })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) loadUniqueModuleData('users');
}

async function handleLiveSearch(val) {
  const box = document.getElementById('search-suggestions');
  if (val.trim().length < 2) { box.style.display = 'none'; return; }
  const res = await fetch('/api/patients/search?q=' + encodeURIComponent(val));
  const data = await res.json();
  if (!data.length) { box.style.display = 'none'; return; }
  box.innerHTML = data.map(p => `<div class="suggestion-item live-sugg-item" data-uhid="${p.uhid}"><strong>${p.title} ${p.name}</strong> (${p.uhid}) - Mob: ${p.contact}</div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.live-sugg-item').forEach(item => {
    item.addEventListener('click', () => { autoFillPatient(item.getAttribute('data-uhid')); box.style.display = 'none'; });
  });
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

function renderBillModal(bill) {
  currentActiveBillNo = bill.billNo;
  document.getElementById('pb-billno').innerText = bill.billNo;
  document.getElementById('pb-datetime').innerText = bill.dateTime;
  document.getElementById('pb-uhid').innerText = bill.uhid;
  document.getElementById('pb-user').innerText = bill.createdBy;
  document.getElementById('pb-name').innerText = bill.patientName;
  document.getElementById('pb-contact').innerText = bill.contact || '-';
  document.getElementById('pb-address').innerText = bill.address || '-';
  document.getElementById('pb-doctor').innerText = bill.doctor || '-';
  document.getElementById('pb-paymode').innerText = bill.payType;
  document.getElementById('pb-pay-status').innerText = (bill.payType || '').includes('Credit') ? 'Credit / Due' : 'Paid';

  const tbody = document.getElementById('pb-items-tbody');
  tbody.innerHTML = (bill.items || []).map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${it.name}</td>
      <td class="col-batch">${it.batch || '-'}</td>
      <td class="col-mfgexp">${it.mfg || '-'} / ${it.exp || '-'}</td>
      <td class="col-hsn">${it.hsn || '-'}</td>
      <td>${it.qty}</td>
      <td class="col-mrp">₹${Number(it.mrp || 0).toFixed(2)}</td>
      <td>₹${Number(it.rate || 0).toFixed(2)}</td>
      <td>${Number(it.discPct || 0)}%</td>
      <td>₹${Number(it.taxable || 0).toFixed(2)}</td>
      <td>₹${Number(it.gstAmt || 0).toFixed(2)} (${it.gstPct || 0}%)</td>
      <td style="font-weight:900;">₹${Number(it.lineTotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  document.getElementById('pb-gross').innerText = '₹' + Number(bill.totalGross || bill.netFee || 0).toFixed(2);
  document.getElementById('pb-disc').innerText = Number(bill.totalDisc || 0).toFixed(2);
  document.getElementById('pb-disc-val').innerText = '₹' + Number(bill.totalDisc || 0).toFixed(2);
  document.getElementById('pb-taxable').innerText = Number(bill.totalTaxable || bill.netFee || 0).toFixed(2);
  document.getElementById('pb-gst').innerText = Number(bill.totalGst || 0).toFixed(2);
  document.getElementById('pb-gst-val').innerText = '₹' + Number(bill.totalGst || 0).toFixed(2);
  document.getElementById('pb-amount').innerText = '₹' + Number(bill.netFee || 0).toFixed(2);

  applyPrintOptions();
  document.getElementById('print-modal').style.display = 'flex';
  document.getElementById('prescription-modal').style.display = 'none';
}

async function handlePatientRegistration(e) {
  e.preventDefault();
  if (currentUser.isDemo) { alert('Demo mode: Action simulated successfully!'); return; }
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
    renderBillModal(data.bill);
    document.getElementById('patient-reg-form').reset();
    document.getElementById('reg-discount').value = '0';
    fetchNextUHID();
  } else {
    alert(data.message);
  }
}

async function handleCreateAbha(e) {
  e.preventDefault();
  const res = await fetch('/api/abdm/create-abha', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      uhid: document.getElementById('abdm-uhid').value,
      patientName: document.getElementById('abdm-name').value,
      mobileOrAadhaar: document.getElementById('abdm-ref').value,
      desiredAbha: document.getElementById('abdm-handle').value,
      m2CareContext: document.getElementById('abdm-m2').value
    })
  });
  const data = await res.json();
  alert(`${data.message}: ${data.record.abhaAddress} (${data.record.abhaNumber})`);
  if (data.success) { document.getElementById('abdm-create-form').reset(); loadUniqueModuleData(activeModuleKey); }
}

async function handleNhcxClaim(e) {
  e.preventDefault();
  const res = await fetch('/api/nhcx/claim', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      uhid: document.getElementById('nhcx-uhid').value,
      patientName: document.getElementById('nhcx-name').value,
      payer: document.getElementById('nhcx-payer').value,
      claimType: document.getElementById('nhcx-type').value,
      amount: document.getElementById('nhcx-amount').value
    })
  });
  const data = await res.json();
  alert(`${data.message} (${data.claim.claimId})`);
  if (data.success) { document.getElementById('nhcx-claim-form').reset(); loadUniqueModuleData(activeModuleKey); }
}

async function handleOpdAppointment(e) {
  e.preventDefault();
  const uhid = document.getElementById('opd-search-uhid').value;
  const doctor = document.getElementById('opd-doctor').value;
  const slot = document.getElementById('opd-slot').value;
  const res = await fetch('/api/opd/book', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ uhid, patientName: uhid, doctor, slot })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) { document.getElementById('opd-book-form').reset(); switchView('opd'); }
}

async function handleIpdAdmission(e) {
  e.preventDefault();
  const uhid = document.getElementById('ipd-uhid').value;
  const patientName = document.getElementById('ipd-name').value;
  const ward = document.getElementById('ipd-ward').value;
  const doctor = document.getElementById('ipd-doctor').value;
  const res = await fetch('/api/ipd/admit', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ uhid, patientName, ward, doctor })
  });
  const data = await res.json();
  alert(data.message + ' (IPD No: ' + data.admission.ipdNo + ')');
  if (data.success) { document.getElementById('ipd-admit-form').reset(); switchView('ipd'); }
}

async function handleAddWard(e) {
  e.preventDefault();
  const wardName = document.getElementById('w-name').value;
  const totalBeds = document.getElementById('w-beds').value;
  const dailyCharge = document.getElementById('w-charge').value;
  const res = await fetch('/api/wards/add', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ wardName, totalBeds, dailyCharge })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) { document.getElementById('ward-add-form').reset(); switchView('wards'); }
}

async function handleAddLab(e) {
  e.preventDefault();
  const res = await fetch('/api/lab/add', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      uhid: document.getElementById('lab-uhid').value,
      patientName: document.getElementById('lab-name').value,
      testName: document.getElementById('lab-test').value,
      result: document.getElementById('lab-result').value
    })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) { document.getElementById('lab-add-form').reset(); loadUniqueModuleData('lab'); }
}

async function handleAddPharmacy(e) {
  e.preventDefault();
  const res = await fetch('/api/pharmacy/add', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      itemName: document.getElementById('med-name').value,
      batch: document.getElementById('med-batch').value,
      hsn: document.getElementById('med-hsn').value,
      qty: document.getElementById('med-qty').value,
      mrp: document.getElementById('med-mrp').value,
      rate: document.getElementById('med-rate').value
    })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) { document.getElementById('pharmacy-add-form').reset(); loadUniqueModuleData(activeModuleKey); }
}

async function openBillingModalByUHID(uhid) {
  const res = await fetch('/api/bills');
  const bills = await res.json();
  const bill = (bills || []).find(b => b.uhid === uhid);
  if (bill) renderBillModal(bill);
  else alert('Bill not found for this UHID.');
}

async function openBillingModalByBillNo(billNo) {
  const res = await fetch('/api/bills');
  const bills = await res.json();
  const bill = (bills || []).find(b => b.billNo === billNo);
  if (bill) renderBillModal(bill);
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
    document.getElementById('pr-address').innerText = p.address || 'Maharajganj, UP';

    ['vital-bp','vital-pulse','vital-temp','vital-wt','pr-investigation','pr-treatment','pr-nextvisit'].forEach(id => {
      document.getElementById(id).value = '';
    });

    document.getElementById('prescription-modal').style.display = 'flex';
    document.getElementById('print-modal').style.display = 'none';
  }
}

async function requestBillEdit() {
  if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin') {
    alert('Only Super Admin and Admin can edit bills directly!');
    return;
  }
  const newNet = prompt("Enter new Net Fee (₹) for bill " + currentActiveBillNo + ":");
  if (!newNet) return;
  const newMode = prompt("Enter payment mode (Cash / Credit / UPI):", "Cash");
  if (!newMode) return;

  const res = await fetch('/api/bills/edit', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ billNo: currentActiveBillNo, netFee: newNet, payType: newMode, userRole: currentUser.role })
  });
  const data = await res.json();
  alert(data.message);
  if (data.success) renderBillModal(data.bill);
}

async function handleAddNewDoctor(e) {
  e.preventDefault();
  if (currentUser.isDemo) { alert('Demo mode active'); return; }
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
    document.getElementById('doctor-form').reset();
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  if (currentUser.isDemo) { alert('Demo mode active'); return; }
  const checkboxes = document.querySelectorAll('#permission-checkboxes input[type="checkbox"]:checked');
  const perms = Array.from(checkboxes).map(cb => cb.value);

  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      name: document.getElementById('new-u-name').value,
      username: document.getElementById('new-u-username').value,
      password: document.getElementById('new-u-password').value,
      role: document.getElementById('new-u-role').value,
      permissions: perms
    })
  });
  const data = await res.json();
  if (data.success) {
    alert('User created successfully with selected permissions!');
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
  else alert(data.message);
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
  if (data.success) document.getElementById('password-change-form').reset();
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
    console.log('AR ERP & HIMS Server running live on port ' + PORT);
});