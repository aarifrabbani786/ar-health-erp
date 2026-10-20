function renderSidebar(userRole) {
    const sidebarHtml = `
    <div style="width: 260px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; min-height: 100vh; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 4px 0 15px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
            <div style="background: #3b82f6; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white;">AR</div>
            <div>
                <h2 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0;">A.R. Health ERP</h2>
                <span style="font-size: 11px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 8px; border-radius: 20px; font-weight: 600;">
                    ${userRole || 'Staff'}
                </span>
            </div>
        </div>

        <hr style="border: none; height: 1px; background: #334155; margin-bottom: 20px;">

        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
            <li><a href="/index.html" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #cbd5e1; text-decoration: none; border-radius: 8px; font-size: 14px; transition: 0.2s; background: rgba(255,255,255,0.03);">🛒 POS Billing</a></li>
            <li><a href="/sales-returns.html" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #cbd5e1; text-decoration: none; border-radius: 8px; font-size: 14px; transition: 0.2s;">🔄 Sales Returns</a></li>

            ${(userRole === 'Admin' || userRole === 'Super Admin') ? `
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 6px 10px;">Management</div>
                <li><a href="/admin/products-view" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #cbd5e1; text-decoration: none; border-radius: 8px; font-size: 14px;">📦 Inventory & Stock</a></li>
                <li><a href="/admin/purchases" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #cbd5e1; text-decoration: none; border-radius: 8px; font-size: 14px;">🛍️ Purchases</a></li>
                <li><a href="/admin/ledger-view" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #cbd5e1; text-decoration: none; border-radius: 8px; font-size: 14px;">📖 Customer Ledger</a></li>
            ` : ''}

            ${userRole === 'Super Admin' ? `
                <div style="font-size: 10px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 6px 10px;">Super Control</div>
                <li><a href="/super-admin/tenants" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: #93c5fd; text-decoration: none; border-radius: 8px; font-size: 14px;">🏢 Stores Tenants</a></li>
            ` : ''}
        </ul>

        <div style="margin-top: 40px; border-top: 1px solid #334155; padding-top: 20px;">
            <button onclick="localStorage.clear(); window.location.href='/login.html';" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s;">
                🚪 Logout System
            </button>
        </div>
    </div>
    `;

    const container = document.getElementById('sidebar-container');
    if (container) {
        container.innerHTML = sidebarHtml;
    }
}