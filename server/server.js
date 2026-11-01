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

// FEFO & Unit Helper: Convert Strips/Packs to Loose Base Units
function convertToUnits(packs, looseUnits, unitsPerPack = 10) {
    return (Number(packs || 0) * Number(unitsPerPack)) + Number(looseUnits || 0);
}

// --- API ENDPOINTS FOR PHARMACY ERP ---

// 1. Fetch Medicines & Inventory with FEFO Sorting
app.get('/api/pharmacy/inventory', async (req, res) => {
    try {
        if (pool) {
            const query = `
                SELECT m.med_id, m.brand_name, m.generic_name, m.pack_type, m.units_per_pack,
                       b.id as batch_id, b.batch_no, b.expiry_date, b.sale_rate, b.mrp, b.available_qty
                FROM medicines m
                JOIN medicine_batches b ON m.id = b.medicine_id
                WHERE b.expiry_date > CURRENT_DATE AND b.available_qty > 0
                ORDER BY b.expiry_date ASC; -- FEFO Rule
            `;
            const dbRes = await pool.query(query);
            return res.json({ success: true, data: dbRes.rows });
        }
        res.json({
            success: true,
            data: [
                { med_id: 'MED001', brand_name: 'Paracetamol 650mg', generic_name: 'Paracetamol', pack_type: 'Strip', units_per_pack: 10, batch_no: 'B2601', expiry_date: '2027-12-31', sale_rate: 20.00, mrp: 22.00, available_qty: 150 },
                { med_id: 'MED002', brand_name: 'Amoxycillin 500mg', generic_name: 'Amoxycillin', pack_type: 'Strip', units_per_pack: 10, batch_no: 'B2602', expiry_date: '2027-08-15', sale_rate: 45.00, mrp: 50.00, available_qty: 85 }
            ]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. ACID Transactional Billing with FEFO Batch Deduction & Stock Movement Ledger
app.post('/api/pharmacy/checkout', async (req, res) => {
    if (!pool) {
        return res.json({ success: true, message: 'Local Mode Simulation: Invoice recorded' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start ACID DB Transaction

        const { customerName, mobile, items } = req.body; // items: [{ batch_id, medicine_id, strips, tablets, price }]
        const invNo = `INV${Date.now().toString().slice(-8)}`;
        let grandTotal = 0;

        for (let item of items) {
            const unitsToSell = convertToUnits(item.strips, item.tablets, item.unitsPerPack || 10);
            
            // Check Available Stock & Lock Row
            const batchRes = await client.query('SELECT available_qty, batch_no FROM medicine_batches WHERE id = $1 FOR UPDATE', [item.batch_id]);
            if (batchRes.rows.length === 0 || batchRes.rows[0].available_qty < unitsToSell) {
                throw new Error(`Insufficient stock for Batch ${item.batch_no || item.batch_id}. Available: ${batchRes.rows[0]?.available_qty || 0}`);
            }

            // Update Batch Sold Qty
            await client.query('UPDATE medicine_batches SET sold_qty = sold_qty + $1 WHERE id = $2', [unitsToSell, item.batch_id]);

            // Add Immutable Stock Movement Log
            await client.query(
                'INSERT INTO stock_movements (transaction_type, reference_id, medicine_id, batch_id, qty_change, reason) VALUES ($1, $2, $3, $4, $5, $6)',
                ['SALE', invNo, item.medicine_id, item.batch_id, -unitsToSell, 'Pharmacy POS Sales Outflow']
            );

            grandTotal += Number(item.price) * unitsToSell;
        }

        // Save Master Sales Invoice
        await client.query(
            'INSERT INTO sales_invoices (inv_no, date, customer_name, mobile, net_total) VALUES ($1, CURRENT_DATE, $2, $3, $4)',
            [invNo, customerName || 'Walk-in Patient', mobile || '', grandTotal]
        );

        await client.query('COMMIT'); // Commit Complete Transaction
        res.json({ success: true, message: 'POS Bill transaction committed cleanly', invoiceNo: invNo, totalAmount: grandTotal });
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error to prevent overselling
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// App Dashboard Route Setup
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>A R Pharma ERP | FEFO & POS System</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: #0f172a; color: white; padding: 40px; }
        .card { background: #1e293b; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        h2 { color: #38bdf8; margin-bottom: 15px; }
        p { color: #94a3b8; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🏥 A R Pharma & Healthcare Enterprise ERP (Phase 2 Active)</h2>
        <p>FEFO inventory allocation, Strip-to-Tablet base unit converters, and ACID DB transactions are initialized.</p>
    </div>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running on port ${PORT}`);
});