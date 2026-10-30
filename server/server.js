require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('client'));

// Database Connection Configuration supporting Supabase / MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'aws.connect.psdb.cloud',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ar_erp',
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let db;
async function initDatabase() {
    try {
        db = await mysql.createPool(dbConfig);
        console.log('Database connected successfully.');

        // Ensure essential tables exist automatically
        await db.query(`
            CREATE TABLE IF NOT EXISTS bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invNo VARCHAR(50) UNIQUE,
                date VARCHAR(50),
                cust VARCHAR(100),
                mob VARCHAR(20),
                netTotal DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS medicines (
                id INT AUTO_INCREMENT PRIMARY KEY,
                medId VARCHAR(50) UNIQUE,
                brand VARCHAR(100),
                generic VARCHAR(100),
                strength VARCHAR(50),
                stock INT DEFAULT 0,
                price DECIMAL(10,2)
            )
        `);
    } catch (err) {
        console.error('Database connection/initialization error:', err.message);
    }
}
initDatabase();

// --- API ROUTES ---

// 1. Bills Endpoints
app.get('/api/bills', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM bills ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching bills:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bills', async (req, res) => {
    try {
        const b = req.body;
        const query = `INSERT INTO bills (invNo, date, cust, mob, netTotal) VALUES (?, ?, ?, ?, ?)`;
        await db.query(query, [b.invNo || `PBILL${Date.now()}`, b.date || new Date().toISOString().split('T')[0], b.cust || 'Walk-in Patient', b.mob || '', b.netTotal || 0]);
        res.json({ success: true, message: 'Bill saved successfully' });
    } catch (err) {
        console.error('Error saving bill:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Medicines Endpoints
app.get('/api/medicines', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM medicines');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching medicines:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AR ERP Server running live on port ${PORT}`);
});