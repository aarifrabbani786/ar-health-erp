const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db'); // Database connection import
const app = express();

app.use(cors());
app.use(express.json());

// In-Memory User Store
let systemUsers = [
    { username: 'admin', pass: 'admin123', name: 'DRx. Aarif Rabbani', role: 'Super Admin', status: 'Active' }
];

// Detect and Resolve Client Directory Safely
const possibleClientPaths = [
    path.join(__dirname, 'client', 'src'),
    path.join(__dirname, 'client'),
    path.join(__dirname, 'src'),
    path.resolve(process.cwd(), 'client', 'src'),
    __dirname
];

let resolvedClientPath = path.join(__dirname, 'client', 'src');

for (let p of possibleClientPaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
        resolvedClientPath = p;
        break;
    }
}

// Static Middleware
app.use(express.static(resolvedClientPath));

// API Endpoints
app.get('/api/users', (req, res) => {
    res.json(systemUsers);
});

app.post('/api/users', (req, res) => {
    try {
        const { username, pass, password, name, role, permissions, status } = req.body;
        const userPassword = pass || password;

        if (!username || !userPassword) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const idx = systemUsers.findIndex(u => u.username === username);
        const userData = {
            username,
            pass: userPassword,
            name: name || username,
            role: role || 'Staff',
            status: status || 'Active',
            permissions: permissions || { sales: true, returns: true, medicines: false, admin: false }
        };

        if (idx >= 0) systemUsers[idx] = userData;
        else systemUsers.push(userData);

        res.json({ success: true, users: systemUsers });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/users/update-status', (req, res) => {
    const { username, status } = req.body;
    const user = systemUsers.find(u => u.username === username);
    if (user) {
        user.status = status;
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
});

app.post('/api/users/update-password', (req, res) => {
    const { username, pass } = req.body;
    const user = systemUsers.find(u => u.username === username);
    if (user) {
        user.pass = pass;
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
});

// --- BILLS & MEDICINES API ENDPOINTS ---
app.get('/api/bills', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM bills');
        res.json(rows);
    } catch (err) {
        console.error('API Error fetching bills:', err.message);
        res.status(500).json({ error: err.message, tableTried: 'bills' });
    }
});
app.post('/api/bills', async (req, res) => {
    try {
        const b = req.body;
        const query = `INSERT INTO bills (invNo, date, cust, mob, netTotal) VALUES (?, ?, ?, ?, ?)`;
        await db.query(query, [b.invNo, b.date, b.cust, b.mob, b.netTotal]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving bill:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/medicines', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM medicines');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching medicines:', err);
        res.status(500).json({ error: err.message });
    }
});

// Primary Home Route
app.get('/', (req, res) => {
    const file = path.join(resolvedClientPath, 'index.html');
    if (fs.existsSync(file)) {
        return res.sendFile(file);
    }
    res.status(404).send('index.html file not found on server directory');
});

// Universal Safe Fallback Middleware (Fixes Cannot GET)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const file = path.join(resolvedClientPath, 'index.html');
        if (fs.existsSync(file)) {
            return res.sendFile(file);
        }
    }
    next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`A.R. HEALTHCARE Enterprise Server running on port ${PORT}`);
});