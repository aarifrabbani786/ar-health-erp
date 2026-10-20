const express = require('express');
const router = express.Router();
const db = require('../db');

// Get customer ledger entries
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customer_ledger');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add ledger entry
router.post('/', async (req, res) => {
  try {
    const { customer_name, debit, credit, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO customer_ledger (customer_name, debit, credit, description) VALUES (?, ?, ?, ?)',
      [customer_name, debit || 0, credit || 0, description]
    );
    res.status(201).json({ message: 'Ledger entry added successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;