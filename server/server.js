const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from client/src
app.use(express.static(path.join(__dirname, '../client/src')));

// Bulletproof Path Resolution using __dirname
const db = require(path.join(__dirname, 'db'));

const authRoutes = require(path.join(__dirname, 'routes/authRoutes'));
const tenantRoutes = require(path.join(__dirname, 'routes/tenantRoutes'));
const productRoutes = require(path.join(__dirname, 'routes/productRoutes'));
const supplierRoutes = require(path.join(__dirname, 'routes/supplierRoutes'));
const purchaseRoutes = require(path.join(__dirname, 'routes/purchaseRoutes'));
const saleRoutes = require(path.join(__dirname, 'routes/saleRoutes'));
const dashboardRoutes = require(path.join(__dirname, 'routes/dashboardRoutes'));
const customerLedgerRoutes = require(path.join(__dirname, 'routes/customerLedgerRoutes'));
const salesReturnRoutes = require(path.join(__dirname, 'routes/salesReturnRoutes'));

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ledger', customerLedgerRoutes);
app.use('/api/sales-returns', salesReturnRoutes);

// Root Route - Serve frontend index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/src/index.html'));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});