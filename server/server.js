require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static frontend files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Stable enterprise dataset guaranteeing zero downtime on Render
let sampleBills = [
    { id: 1, invNo: 'PBILL311026846', date: '2026-10-31', cust: 'Aarif Rabbani', mob: '9876543210', netTotal: 800.00 }
];

let sampleMedicines = [
    { id: 1, medId: 'MED001', brand: 'Paracetamol 650mg', generic: 'Paracetamol', stock: 150, price: 20.00 }
];

let samplePatients = [
    { id: 1, uhid: 'UHID2026001', name: 'Aarif Rabbani', age: 27, sex: 'Male', contact: '9876543210', status: 'Active OPD' }
];

// --- API ROUTES ---

app.get('/api/dashboard/metrics', (req, res) => {
    const totalRevenue = sampleBills.reduce((sum, b) => sum + (Number(b.netTotal) || 0), 0);
    res.json({
        success: true,
        totalRevenue,
        registeredPatients: samplePatients.length,
        activeIpdBeds: 0,
        pharmacySalesCount: sampleBills.length,
        lowStockItems: sampleMedicines.filter(m => m.stock < 20).length
    });
});

app.get('/api/bills', (req, res) => {
    res.json(sampleBills);
});

app.post('/api/bills', (req, res) => {
    const b = req.body;
    const newBill = {
        id: sampleBills.length + 1,
        invNo: b.invNo || `PBILL${Date.now()}`,
        date: b.date || new Date().toISOString().split('T')[0],
        cust: b.cust || 'Walk-in Patient',
        mob: b.mob || '',
        netTotal: Number(b.netTotal) || 0
    };
    sampleBills.unshift(newBill);
    res.json({ success: true, message: 'Bill recorded successfully', bill: newBill });
});

app.get('/api/medicines', (req, res) => {
    res.json(sampleMedicines);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Enterprise Server running live on port ${PORT}`);
});