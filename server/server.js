const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// In-Memory/Server Users Sync Store (Default Seed Users)
let systemUsers = [
    { username: 'admin', pass: 'admin123', name: 'DRx. Aarif Rabbani', role: 'Super Admin' },
    { username: 'staff1', pass: '1234', name: 'Sales Staff 1', role: 'Billing Operator' }
];

// Serve Static Frontend Files from client/src
app.use(express.static(path.join(__dirname, 'client', 'src')));

// API Endpoint: Get All Cloud Users
app.get('/api/users', (req, res) => {
    try {
        res.status(200).json(systemUsers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cloud users' });
    }
});

// API Endpoint: Register New Cloud User
app.post('/api/users', (req, res) => {
    try {
        const { username, pass, password, name, role } = req.body;
        const userPassword = pass || password;

        if (!username || !userPassword) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const existingUser = systemUsers.find(u => u.username === username);
        if (existingUser) {
            existingUser.pass = userPassword;
            existingUser.name = name || existingUser.name;
            existingUser.role = role || existingUser.role;
        } else {
            systemUsers.push({
                username,
                pass: userPassword,
                name: name || username,
                role: role || 'Billing Operator'
            });
        }

        res.status(200).json({ success: true, users: systemUsers });
    } catch (err) {
        res.status(500).json({ error: 'Server save error' });
    }
});

// API Endpoint: Update User Password
app.post('/api/users/update-password', (req, res) => {
    try {
        const { username, pass } = req.body;
        const user = systemUsers.find(u => u.username === username);

        if (user) {
            user.pass = pass;
            return res.status(200).json({ success: true, message: 'Password updated successfully' });
        }
        res.status(404).json({ error: 'User not found' });
    } catch (err) {
        res.status(500).json({ error: 'Update error' });
    }
});

// Wildcard Route to serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'src', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`ARHEALTHCARE Enterprise Server running on port ${PORT}`);
});