const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all products
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a product
router.post('/', async (req, res) => {
  try {
    const { name, batch_no, mrp, purchase_price, stock } = req.body;
    const [result] = await db.query(
      'INSERT INTO products (name, batch_no, mrp, purchase_price, stock) VALUES (?, ?, ?, ?, ?)',
      [name, batch_no, mrp, purchase_price, stock]
    );
    res.status(201).json({ message: 'Product added successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;