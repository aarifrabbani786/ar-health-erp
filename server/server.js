const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

// --- PROFESSIONAL ADMIN DASHBOARD (ROOT) ---
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>A.R. Health ERP - Admin Portal</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --bg-main: #0f172a; --bg-sidebar: #1e293b; --bg-card: #1e293b;
                --border-color: #334155; --text-main: #f8fafc; --text-muted: #94a3b8;
                --accent-blue: #38bdf8; --accent-hover: #0284c7; --success: #34d399;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { background-color: var(--bg-main); color: var(--text-main); display: flex; height: 100vh; overflow: hidden; }
            sidebar { width: 260px; background-color: var(--bg-sidebar); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
            .brand { padding: 20px; font-size: 20px; font-weight: bold; color: var(--accent-blue); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px; }
            .menu { list-style: none; padding: 20px 10px; overflow-y: auto; flex: 1; }
            .menu li { margin-bottom: 8px; }
            .menu a { display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: var(--text-muted); text-decoration: none; border-radius: 8px; font-size: 14px; transition: 0.2s; }
            .menu a:hover, .menu a.active { background-color: var(--accent-hover); color: white; }
            .main-content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
            header { background-color: var(--bg-sidebar); padding: 15px 30px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
            .header-title h2 { font-size: 22px; color: var(--text-main); }
            .header-title p { font-size: 13px; color: var(--text-muted); }
            .user-badge { background: #065f46; color: var(--success); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
            .container { padding: 30px; max-width: 1200px; margin: 0 auto; width: 100%; }
            .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: var(--bg-card); border: 1px solid var(--border-color); padding: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; }
            .stat-info h4 { color: var(--text-muted); font-size: 13px; text-transform: uppercase; }
            .stat-info span { font-size: 22px; font-weight: bold; color: var(--text-main); }
            .stat-icon { font-size: 30px; color: var(--accent-blue); background: rgba(56, 189, 248, 0.1); padding: 12px; border-radius: 8px; }
            .section-title { font-size: 18px; margin-bottom: 15px; color: var(--accent-blue); border-left: 4px solid var(--accent-blue); padding-left: 10px; }
            .modules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
            .card { background: var(--bg-card); border: 1px solid var(--border-color); padding: 20px; border-radius: 10px; transition: 0.3s; display: flex; flex-direction: column; justify-content: space-between; }
            .card:hover { transform: translateY(-4px); border-color: var(--accent-blue); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
            .card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
            .card-top i { font-size: 22px; color: var(--accent-blue); }
            .card h3 { font-size: 16px; color: var(--text-main); }
            .card p { font-size: 13px; color: var(--text-muted); margin-bottom: 15px; }
            .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent-blue); color: #0f172a; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; transition: 0.2s; }
            .btn:hover { background: #0284c7; color: white; }
        </style>
    </head>
    <body>
        <sidebar>
            <div class="brand"><i class="fa-solid fa-clinic-medical"></i> A.R. Health ERP</div>
            <ul class="menu">
                <li><a href="/" class="active"><i class="fa-solid fa-chart-pie"></i> Dashboard</a></li>
                <li><a href="/admin/products-view"><i class="fa-solid fa-boxes-stacked"></i> Products</a></li>
                <li><a href="/admin/sales-view"><i class="fa-solid fa-cash-register"></i> Sales & Billing</a></li>
                <li><a href="/admin/sales-returns-view"><i class="fa-solid fa-rotate-left"></i> Sales Return</a></li>
                <li><a href="/admin/purchases-view"><i class="fa-solid fa-truck-ramp-box"></i> Purchases</a></li>
                <li><a href="/admin/ledger-view"><i class="fa-solid fa-book"></i> Customer Ledger</a></li>
                <li><a href="/admin/suppliers-view"><i class="fa-solid fa-users"></i> Suppliers</a></li>
            </ul>
        </sidebar>
        <div class="main-content">
            <header>
                <div class="header-title">
                    <h2>Admin Overview</h2>
                    <p>A.R. Online Zone - Enterprise Management System</p>
                </div>
                <div class="user-badge"><i class="fa-solid fa-circle-check"></i> System Online</div>
            </header>
            <div class="container">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-info"><h4>Database</h4><span>Connected</span></div>
                        <i class="fa-solid fa-database stat-icon"></i>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info"><h4>Environment</h4><span>Node / MySQL</span></div>
                        <i class="fa-solid fa-server stat-icon"></i>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info"><h4>Security</h4><span>Multi-Tenant</span></div>
                        <i class="fa-solid fa-shield-halved stat-icon"></i>
                    </div>
                </div>
                <div class="section-title">Management Modules (Direct Table Views)</div>
                <div class="modules-grid">
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-boxes-stacked"></i><h3>Products & Stock</h3></div><p>Manage medicine items, inventory batches, and stock levels.</p></div>
                        <a class="btn" href="/admin/products-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-cash-register"></i><h3>Sales & Billing</h3></div><p>View point-of-sale invoices and counter sales.</p></div>
                        <a class="btn" href="/admin/sales-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-rotate-left"></i><h3>Sales Return</h3></div><p>Handle medicine returns and customer refunds.</p></div>
                        <a class="btn" href="/admin/sales-returns-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-truck-ramp-box"></i><h3>Purchases</h3></div><p>Track supplier orders and inbound stock.</p></div>
                        <a class="btn" href="/admin/purchases-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-book"></i><h3>Customer Ledger</h3></div><p>Monitor credit limits and due balances.</p></div>
                        <a class="btn" href="/admin/ledger-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                    <div class="card">
                        <div><div class="card-top"><i class="fa-solid fa-users"></i><h3>Suppliers Directory</h3></div><p>Manage pharmaceutical distributors.</p></div>
                        <a class="btn" href="/admin/suppliers-view"><i class="fa-solid fa-eye"></i> View Table</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// --- ADMIN TABLE VIEW ROUTES ---
app.get('/admin/products-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products');
    let trs = rows.map(p => `<tr><td>${p.id}</td><td><b>${p.name}</b></td><td>${p.batch_no || 'N/A'}</td><td>₹${p.mrp || 0}</td><td>₹${p.purchase_price || 0}</td><td><span class="badge">${p.stock || 0} units</span></td></tr>`).join('');
    res.send(renderTableView('Products & Inventory', 'fa-boxes-stacked', 'ID,Medicine Name,Batch No,MRP,Purchase Price,Stock Level', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

app.get('/admin/sales-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sales');
    let trs = rows.map(s => `<tr><td>${s.id}</td><td><b>${s.customer_name || 'Walk-in'}</b></td><td>₹${s.total_amount || 0}</td><td>${s.sale_date || 'N/A'}</td></tr>`).join('');
    res.send(renderTableView('Sales & Billing', 'fa-cash-register', 'Sale ID,Customer Name,Total Amount,Date', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

app.get('/admin/sales-returns-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sales_returns');
    let trs = rows.map(r => `<tr><td>${r.id}</td><td>${r.sale_id}</td><td>${r.reason || 'N/A'}</td><td>₹${r.refund_amount || 0}</td><td>${r.return_date || 'N/A'}</td></tr>`).join('');
    res.send(renderTableView('Sales Return', 'fa-rotate-left', 'Return ID,Sale ID,Reason,Refund Amount,Date', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

app.get('/admin/purchases-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM purchases');
    let trs = rows.map(p => `<tr><td>${p.id}</td><td>Supplier ID: ${p.supplier_id}</td><td>₹${p.total_amount || 0}</td><td>${p.purchase_date || 'N/A'}</td></tr>`).join('');
    res.send(renderTableView('Purchases', 'fa-truck-ramp-box', 'Purchase ID,Supplier,Total Amount,Date', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

app.get('/admin/ledger-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customer_ledger');
    let trs = rows.map(l => `<tr><td>${l.id}</td><td><b>${l.customer_name}</b></td><td style="color:#ef4444;">₹${l.debit || 0}</td><td style="color:#22c55e;">₹${l.credit || 0}</td><td>${l.description || 'N/A'}</td></tr>`).join('');
    res.send(renderTableView('Customer Ledger', 'fa-book', 'Ledger ID,Customer Name,Debit (Due),Credit (Paid),Description', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

app.get('/admin/suppliers-view', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM suppliers');
    let trs = rows.map(s => `<tr><td>${s.id}</td><td><b>${s.name}</b></td><td>${s.phone || 'N/A'}</td><td>${s.address || 'N/A'}</td></tr>`).join('');
    res.send(renderTableView('Suppliers Directory', 'fa-users', 'ID,Supplier Name,Phone,Address', trs));
  } catch (err) { res.send(errPage(err.message)); }
});

function renderTableView(title, icon, headers, rows) {
  let ths = headers.split(',').map(h => `<th>${h}</th>`).join('');
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${title} - A.R. Health ERP</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            h2 { color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 10px; }
            .back-btn { background: #334155; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; }
            .back-btn:hover { background: #475569; }
            table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
            th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid #334155; font-size: 14px; }
            th { background: #0f172a; color: #38bdf8; font-weight: 600; }
            tr:hover { background: rgba(56, 189, 248, 0.05); }
            .badge { background: #065f46; color: #34d399; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2><i class="fa-solid ${icon}"></i> ${title}</h2>
            <a class="back-btn" href="/"><i class="fa-solid fa-arrow-left"></i> Back to Dashboard</a>
        </div>
        <table>
            <thead><tr>${ths}</tr></thead>
            <tbody>
                ${rows.trim() !== '' ? rows : '<tr><td colspan="10" style="text-align:center; color:#94a3b8; padding: 30px;">No records found in database yet.</td></tr>'}
            </tbody>
        </table>
    </body>
    </html>
  `;
}

function errPage(msg) {
  return `<h3>Database/Table Error:</h3><p style="color:red;">${msg}</p><br><a href="/">Back to Dashboard</a>`;
}

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});