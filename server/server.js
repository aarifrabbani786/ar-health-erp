const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// In-Memory Database Users
let systemUsers = [
    { username: 'admin', pass: 'admin123', name: 'DRx. Aarif Rabbani', role: 'Super Admin', status: 'Active' }
];

// Absolute Client Path Fix for Render
const clientSrcPath = path.resolve(__dirname, 'client', 'src');
app.use(express.static(clientSrcPath));

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

// Explicit Catch-All Page Serving (Fixes Not Found)
app.get('/', (req, res) => {
    res.sendFile(path.resolve(clientSrcPath, 'index.html'));
});

app.use((req, res) => {
    res.sendFile(path.resolve(clientSrcPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`ARHEALTHCARE Enterprise Server running on port ${PORT}`);
});