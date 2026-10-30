async function renderDashboard(container) {
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <h2>Executive Dashboard & Real-time Analytics</h2>
            <p style="color: #64748b;">Complete digital data and billing software workspace.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 20px;">
                <div style="background: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-left: 5px solid #0284c7;">
                    <span style="font-size: 12px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">TOTAL REVENUE</span>
                    <h2 id="total-revenue-display" style="color: #0284c7; font-size: 26px; margin-top: 8px;">Loading...</h2>
                </div>
                <div style="background: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-left: 5px solid #10b981;">
                    <span style="font-size: 12px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">REGISTERED PATIENTS</span>
                    <h2 style="color: #10b981; font-size: 26px; margin-top: 8px;">1</h2>
                </div>
                <div style="background: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-left: 5px solid #f59e0b;">
                    <span style="font-size: 12px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">ACTIVE IPD BEDS</span>
                    <h2 style="color: #f59e0b; font-size: 26px; margin-top: 8px;">0</h2>
                </div>
            </div>
        </div>
    `;

    try {
        const [billsRes, medsRes] = await Promise.all([
            fetch('/api/bills').then(res => res.json()),
            fetch('/api/medicines').then(res => res.json())
        ]);
        
        const bills = Array.isArray(billsRes) ? billsRes : (billsRes.bills || []);
        
        let totalSales = bills.reduce((sum, b) => {
            const amount = Number(b.netTotal) || Number(b.net_amount) || Number(b.total_amount) || Number(b.amount) || 0;
            return sum + amount;
        }, 0);

        const revenueEl = document.getElementById('total-revenue-display');
        if (revenueEl) {
            revenueEl.innerText = `₹${totalSales.toFixed(2)}`;
        }
    } catch (err) {
        console.error('Error fetching live dashboard metrics:', err);
        const revenueEl = document.getElementById('total-revenue-display');
        if (revenueEl) {
            revenueEl.innerText = '₹0.00 (Error)';
        }
    }
}