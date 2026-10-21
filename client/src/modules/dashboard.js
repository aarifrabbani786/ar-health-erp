function renderDashboard(container) {
    let bills = JSON.parse(localStorage.getItem('erp_bills')) || [];
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    let totalSales = bills.reduce((sum, b) => sum + b.netTotal, 0);

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
                <tbody>${bills.slice(-5).reverse().map(b => `<tr><td><b>${b.invNo}</b></td><td>${b.date}</td><td>${b.cust}</td><td>${b.mob}</td><td style="color:#16a34a; font-weight:bold;">₹${b.netTotal}</td></tr>`).join('') || '<tr><td colspan="5">No bills generated yet</td></tr>'}</tbody>
            </table>
        </div>
    `;
}