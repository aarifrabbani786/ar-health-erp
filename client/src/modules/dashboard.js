async function renderDashboard(container) {
    try {
        const [billsRes, medsRes] = await Promise.all([
            fetch('/api/bills').then(res => res.json()),
            fetch('/api/medicines').then(res => res.json())
        ]);
        
        const bills = Array.isArray(billsRes) ? billsRes : (billsRes.bills || []);
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes.medicines || []);

        let totalSales = bills.reduce((sum, b) => {
            const amount = Number(b.netTotal) || Number(b.net_amount) || Number(b.total_amount) || Number(b.amount) || 0;
            return sum + amount;
        }, 0);

        container.innerHTML = `
            <div class="light-card">
                <h2>Dashboard Module Overview</h2>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:20px;">
                    <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                        <span style="font-size:11px; color:#64748b; font-weight:700;">TOTAL REVENUE</span>
                        <h2 style="color:#0284c7; font-size:22px; margin-top:5px;">₹${totalSales.toFixed(2)}</h2>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }
}