const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// Register Admin
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const [existing] = await db.query('SELECT * FROM super_admins WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Super Admin already exists!' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await db.query('INSERT INTO super_admins (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);
    res.status(201).json({ message: 'Super Admin registered successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  // Login Endpoint for Super Admin, Admin & Staff
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user with role name
        const [users] = await db.query(
            `SELECT u.*, r.role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ?`,
            [email]
        );

        if (!users || users.length === 0) {
            return res.status(400).json({ message: 'Invalid Email or Password' });
        }

        const user = users[0];

        // Compare Hashed Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Email or Password' });
        }

        // Save User Info & Role in Session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role_id: user.role_id,
            role_name: user.role_name || 'Staff'
        };

        res.json({
            success: true,
            message: 'Login successful!',
            user: req.session.user
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
});

module.exports = router;