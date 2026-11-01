require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client folder if it exists
app.use(express.static(path.join(__dirname, 'client')));

// Safe in-memory demo bills array to guarantee zero downtime and immediate metrics loading
let sampleBills = [
    { id: 1, invNo: 'PBILL311026846', date: '2026-10-31', cust: 'Aarif Rabbani', mob: '9876543210', netTotal: 800.00 }
];

let sampleMedicines = [
    { id: 1, medId: 'MED001', brand: 'Paracetamol 650', stock: 150, price: 20.00 }
];

// --- ROOT & API ROUTES ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>AR ERP | Enterprise System</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; margin: 0; padding: 40px; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                h1 { color: #0f172a; margin-top: 0; }
                .card { background: #f8fafc; border-left: 5px solid #0284c7; padding: 20px; border-radius: 8px; margin-top: 20px; }
                .metric { font-size: 32px; font-weight: bold; color: #0284c7; margin: 10px 0 0 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AR ERP Software Workspace</h1>
                <p style="color: #64748b;">Hospital, Pharmacy & Enterprise Management System (Live Active)</p>
                <div class="card">
                    <span style="font-size: 12px; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">TOTAL REVENUE</span>
                    <div class="metric" id="total-revenue">₹800.00</div>
                </div>
            </div>
            <script>
                fetch('/api/bills')
                    .then(res => res.json())
                    .then(data => {
                        let total = data.reduce((sum, b) => sum + (Number(b.netTotal) || 0), 0);
                        document.getElementById('total-revenue').innerText = '₹' + total.toFixed(2);
                    })
                    .catch(err => console.error('Error fetching live bills:', err));
            </script>
        </body>
        </html>
    `);
});

// 1. Get Bills API
app.get('/api/bills', (req, res) => {
    res.json(sampleBills);
});

// 2. Post Bill API
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
    res.json({ success: true, message: 'Bill saved successfully', bill: newBill });
});

// 3. Get Medicines API
app.get('/api/medicines', (req, res) => {
    res.json(sampleMedicines);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live seamlessly on port ${PORT}`);
});