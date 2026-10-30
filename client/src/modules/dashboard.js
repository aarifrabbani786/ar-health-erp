async function renderDashboard(container) {
    let bills = [];
    let meds = [];
    
    try {
        // Backend API se live bills aur medicines fetch karein
        const [billsRes, medsRes] = await Promise.all([
            fetch('/api/bills').then(res => res.json()),
            fetch('/api/medicines').then(res => res.json())
        ]);
        bills = Array.isArray(billsRes) ? billsRes : (billsRes.bills || []);
        meds = Array.isArray(medsRes) ? medsRes : (medsRes.medicines || []);
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }

let totalSales = bills.reduce((sum, b) => {
    const amount = Number(b.netTotal) || Number(b.net_amount) || Number(b.total_amount) || Number(b.amount) || 0;
    return sum + amount;
}, 0);
    container.innerHTML = `
        <div class="light-card">
            <h2>📊 Dashboard Module Overview</h2>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:20px;">
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#64748b; font-weight:700;">TOTAL REVENUE</span>
                    <h2 style="color:#0284c7; font-size:22px; margin-top:5px;">₹${totalSales.toFixed(2)}</h2>
                </div>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#64748b; font-weight:700;">TOTAL BILLS GENERATED</span>
                    <h2 style="color:#16a34a; font-size:22px; margin-top:5px;">${bills.length}</h2>
                </div>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#64748b; font-weight:700;">MEDICINES IN STOCK</span>
                    <h2 style="color:#4f46e5; font-size:22px; margin-top:5px;">${meds.length}</h2>
                </div>
            </div>

            <h3 style="font-size:14px; margin-bottom:10px;">Recent Invoices Log</h3>
            <table class="data-table">
                <thead><tr><th>Invoice No</th><th>Date</th><th>Patient Name</th><th>Mobile</th><th>Amount</th></tr></thead>
                <tbody>${bills.slice(-5).reverse().map(b => `<tr><td><b>${b.invNo || b.invoice_no}</b></td><td>${b.date}</td><td>${b.cust || b.patient_name}</td><td>${b.mob || b.mobile}</td><td style="color:#16a34a; font-weight:bold;">₹${b.netTotal || b.net_amount || b.total_amount}</td></tr>`).join('') || '<tr><td colspan="5">No bills generated yet</td></tr>'}</tbody>
            </table>
        </div>
    `;
}