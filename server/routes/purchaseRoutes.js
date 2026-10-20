const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all purchases
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM purchases');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add purchase
router.post('/', async (req, res) => {
  try {
    const { supplier_id, total_amount } = req.body;
    const [result] = await db.query(
      'INSERT INTO purchases (supplier_id, total_amount) VALUES (?, ?)',
      [supplier_id, total_amount]
    );
    res.status(201).json({ message: 'Purchase recorded successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;