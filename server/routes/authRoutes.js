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
});

module.exports = router;