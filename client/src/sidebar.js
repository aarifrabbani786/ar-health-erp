document.addEventListener("DOMContentLoaded", () => {
    const sidebarContainer = document.getElementById("sidebar-container") || document.querySelector(".sidebar");
    
    if (!sidebarContainer) return;

    // Sabhi possible keys check kar lo taaki role miss na ho
    const userRole = localStorage.getItem("role_name") || localStorage.getItem("userRole") || localStorage.getItem("role") || "Staff";

    let menuItems = [];

    if (userRole === "Super Admin") {
        menuItems = [
            { name: "Dashboard", href: "dashboard.html", icon: "📊" },
            { name: "Stores Management", href: "stores.html", icon: "🏢" },
            { name: "Inventory Control", href: "inventory.html", icon: "📦" },
            { name: "POS Billing", href: "pos.html", icon: "🛒" },
            { name: "Sales Returns", href: "sales-returns.html", icon: "🔄" },
            { name: "Customer Ledger", href: "ledger.html", icon: "📖" },
            { name: "System Settings", href: "settings.html", icon: "⚙️" }
        ];
    } else if (userRole === "Admin") {
        menuItems = [
            { name: "Dashboard", href: "dashboard.html", icon: "📊" },
            { name: "Inventory Control", href: "inventory.html", icon: "📦" },
            { name: "POS Billing", href: "pos.html", icon: "🛒" },
            { name: "Sales Returns", href: "sales-returns.html", icon: "🔄" },
            { name: "Purchase Logs", href: "purchases.html", icon: "📝" },
            { name: "Customer Ledger", href: "ledger.html", icon: "📖" },
            { name: "Staff Management", href: "staff.html", icon: "👥" }
        ];
    } else {
        // Staff Role
        menuItems = [
            { name: "POS Billing", href: "pos.html", icon: "🛒" },
            { name: "Sales Returns", href: "sales-returns.html", icon: "🔄" },
            { name: "Product Search", href: "products.html", icon: "🔍" }
        ];
    }

    let htmlContent = `
        <div class="sidebar-brand" style="padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h3 style="color: #fff; margin: 0;">A.R. HEALTH ERP</h3>
            <span class="badge" style="background: #3b82f6; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff;">${userRole}</span>
        </div>
        <ul class="sidebar-menu" style="list-style: none; padding: 20px 0; margin: 0;">
    `;

    menuItems.forEach(item => {
        htmlContent += `
            <li style="margin-bottom: 10px;">
                <a href="${item.href}" style="display: flex; align-items: center; padding: 12px 20px; color: #cbd5e1; text-decoration: none; transition: 0.2s;">
                    <span style="margin-right: 12px; font-size: 18px;">${item.icon}</span>
                    <span>${item.name}</span>
                </a>
            </li>
        `;
    });

    htmlContent += `
        </ul>
        <div style="padding: 20px; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.1);">
            <button id="system-logout-btn" style="width: 100%; padding: 10px; background: #ef4444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Logout System
            </button>
        </div>
    `;

    sidebarContainer.innerHTML = htmlContent;

    // Badge update in navbar if present
    const badge = document.getElementById("user-profile-badge");
    if (badge) badge.innerText = userRole;

    const logoutBtn = document.getElementById("system-logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "index.html";
        });
    }
});