const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all sales returns
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sales_returns');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add sales return
router.post('/', async (req, res) => {
    try {
        const { sale_id, reason, refund_amount } = req.body;
        const [result] = await db.query(
            'INSERT INTO sales_returns (sale_id, reason, refund_amount) VALUES (?, ?, ?)',
            [sale_id, reason, refund_amount]
        );
        res.status(201).json({ message: 'Sales return processed successfully', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;