const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM suppliers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add supplier
router.post('/', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const [result] = await db.query(
      'INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)',
      [name, phone, address]
    );
    res.status(201).json({ message: 'Supplier added successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;