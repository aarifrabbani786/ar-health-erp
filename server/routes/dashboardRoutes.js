const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyTenant = require('../middleware/tenantAuthMiddleware');

// Get Dashboard Summary & Analytics
router.get('/summary', verifyTenant, async (req, res) => {
  try {
    const tenantId = req.tenant.tenantId;

    // 1. Today's Sales Total & Count
    const [todaySales] = await db.query(
      `SELECT 
         COALESCE(SUM(total_amount), 0) AS todayTotalSales, 
         COUNT(id) AS todayInvoiceCount 
       FROM sales 
       WHERE tenant_id = ? AND DATE(sale_date) = CURDATE()`,
      [tenantId]
    );

    // 2. All-time Sales Total
    const [totalSales] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS totalRevenue, COUNT(id) AS totalInvoices 
       FROM sales 
       WHERE tenant_id = ?`,
      [tenantId]
    );

    // 3. Total Products Count
    const [totalProducts] = await db.query(
      `SELECT COUNT(id) AS totalProducts FROM products WHERE tenant_id = ?`,
      [tenantId]
    );

    // 4. Low Stock Batches Count (Quantity < 10)
    const [lowStock] = await db.query(
      `SELECT COUNT(id) AS lowStockCount 
       FROM product_batches 
       WHERE tenant_id = ? AND quantity <= 10`,
      [tenantId]
    );

    // 5. Expiring Soon Count (Within next 60 days)
    const [expiringSoon] = await db.query(
      `SELECT COUNT(id) AS expiringCount 
       FROM product_batches 
       WHERE tenant_id = ? AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)`,
      [tenantId]
    );

    // 6. Total Suppliers Count
    const [totalSuppliers] = await db.query(
      `SELECT COUNT(id) AS totalSuppliers FROM suppliers WHERE tenant_id = ?`,
      [tenantId]
    );

    res.status(200).json({
      summary: {
        todaySales: parseFloat(todaySales[0].todayTotalSales),
        todayInvoices: todaySales[0].todayInvoiceCount,
        totalRevenue: parseFloat(totalSales[0].totalRevenue),
        totalInvoices: totalSales[0].totalInvoices,
        totalProducts: totalProducts[0].totalProducts,
        lowStockItems: lowStock[0].lowStockCount,
        expiringSoonItems: expiringSoon[0].expiringCount,
        totalSuppliers: totalSuppliers[0].totalSuppliers
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
  const express = require('express');
const router = express.Router();
const { isAuthenticated, checkRole } = require('../middleware/authMiddleware');

// 👑 1. Super Admin Dashboard Analytics
router.get('/super-admin', isAuthenticated, checkRole('Super Admin'), async (req, res) => {
    res.json({
        role: 'Super Admin',
        message: 'Welcome Super Admin! System-wide statistics and management access.',
        modules: ['Stores Management', 'System Settings', 'Global Revenue', 'Admin Accounts']
    });
});

// 🛡️ 2. Admin Dashboard (Store Owner)
router.get('/admin', isAuthenticated, checkRole('Super Admin', 'Admin'), async (req, res) => {
    res.json({
        role: 'Admin',
        message: 'Welcome Admin! Store control and operations.',
        modules: ['Inventory Control', 'Sales Reports', 'Purchase Logs', 'Staff Management', 'Customer Ledger']
    });
});

// 👤 3. Staff Dashboard (Limited Permissions)
router.get('/staff', isAuthenticated, checkRole('Super Admin', 'Admin', 'Staff'), async (req, res) => {
    res.json({
        role: 'Staff',
        message: 'Welcome Staff! Daily counter operations.',
        modules: ['POS Billing', 'Sales Returns', 'Product Search']
    });
});

module.exports = router;