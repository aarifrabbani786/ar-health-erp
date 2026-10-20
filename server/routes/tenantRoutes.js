const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyTenant = require('../middleware/tenantAuthMiddleware');

// 1. Register a New Tenant (Protected Route)
router.post('/register', async (req, res) => {
  try {
    const { storeName, ownerName, email, password, phone, address, subdomain } = req.body;

    // Check if tenant email already exists
    const [existing] = await db.query('SELECT * FROM tenants WHERE contact_email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Tenant with this email already exists!' });
    }

    // Hash tenant password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert tenant into database
    await db.query(
      `INSERT INTO tenants (organization_name, owner_name, contact_email, password, contact_phone, address, subdomain, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [storeName, ownerName, email, hashedPassword, phone, address, subdomain]
    );

    res.status(201).json({ message: 'Tenant registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Tenant Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [tenants] = await db.query('SELECT * FROM tenants WHERE contact_email = ?', [email]);
    if (tenants.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const tenant = tenants[0];
    const isMatch = await bcrypt.compare(password, tenant.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { tenantId: tenant.id, email: tenant.contact_email },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Tenant login successful',
      token,
      tenant: {
        id: tenant.id,
        organizationName: tenant.organization_name,
        ownerName: tenant.owner_name,
        email: tenant.contact_email,
        subdomain: tenant.subdomain
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Tenant Profile & Logo Route
router.put('/profile', verifyTenant, async (req, res) => {
  try {
    const tenantId = req.tenant.tenantId;
    const { name, logoUrl, address, gstNumber } = req.body;

    await db.query(
      `UPDATE tenants 
       SET organization_name = COALESCE(?, organization_name), 
           logo_url = COALESCE(?, logo_url), 
           address = COALESCE(?, address), 
           gst_number = COALESCE(?, gst_number) 
       WHERE id = ?`,
      [name, logoUrl, address, gstNumber, tenantId]
    );

    res.status(200).json({ message: 'Tenant profile and logo updated successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;