const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all sales
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sales');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a sale entry
router.post('/', async (req, res) => {
  try {
    const { customer_name, total_amount } = req.body;
    const [result] = await db.query(
      'INSERT INTO sales (customer_name, total_amount) VALUES (?, ?)',
      [customer_name, total_amount]
    );
    res.status(201).json({ message: 'Sale recorded successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;