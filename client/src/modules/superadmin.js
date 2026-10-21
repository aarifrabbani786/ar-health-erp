async function renderSuperAdmin(container) {
    container.innerHTML = `
        <div class="light-card">
            <h2>⚙️ Super Admin Control Panel (User Access & Staff Permissions)</h2>
            <p style="font-size:12px; color:#64748b; margin-bottom:15px;">New User ID create karein, Module Permissions select karein, aur Active / Deactivate status control karein.</p>
            
            <div class="form-grid">
                <div class="form-group"><label>New Username ID *</label><input type="text" id="nuUser" class="form-control" placeholder="e.g. staff1"></div>
                <div class="form-group"><label>Password *</label><input type="password" id="nuPass" class="form-control" placeholder="••••••••"></div>
                <div class="form-group"><label>Full Name *</label><input type="text" id="nuName" class="form-control" placeholder="Staff Name"></div>
                <div class="form-group">
                    <label>Role / Access Level</label>
                    <select id="nuRole" class="form-control">
                        <option value="Staff">Staff / Billing Operator</option>
                        <option value="Super Admin">Super Admin (Full Access)</option>
                    </select>
                </div>
            </div>

            <!-- MODULE PERMISSION CHECKBOXES -->
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:8px;">SELECT MODULE PERMISSIONS FOR THIS USER:</label>
                <div style="display:flex; gap:15px; flex-wrap:wrap; font-size:12.5px;">
                    <label style="cursor:pointer;"><input type="checkbox" id="perm_pos" checked> 🛒 POS Billing</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="perm_returns" checked> 🔄 Sales Return</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="perm_medicines"> 💊 Stock Master (CRUD)</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="perm_admin"> ⚙️ Super Admin Settings</label>
                </div>
            </div>

            <button onclick="createNewSystemUser()" class="btn-primary">+ Register User ID & Set Permissions</button>

            <h3 style="margin-top:25px; font-size:14px; color:#0f172a;">Authorized Staff Users & Deactivation Access</h3>
            <div id="users-table-box">Loading Users...</div>
        </div>
    `;

    await loadCloudUsers();
}

async function loadCloudUsers() {
    const tableBox = document.getElementById('users-table-box');
    if (!tableBox) return;

    let users = [];
    try {
        let res = await fetch('/api/users');
        if (res.ok) {
            users = await res.json();
            localStorage.setItem('erp_users', JSON.stringify(users));
        } else {
            users = JSON.parse(localStorage.getItem('erp_users')) || [];
        }
    } catch (err) {
        users = JSON.parse(localStorage.getItem('erp_users')) || [];
    }

    if (!users || users.length === 0) {
        users = JSON.parse(localStorage.getItem('erp_users')) || [
            { username: 'admin', pass: 'admin123', name: 'DRx. Aarif Rabbani', role: 'Super Admin', status: 'Active' }
        ];
    }

    tableBox.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Password</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action Controls</th>
                </tr>
            </thead>
            <tbody>${users.map((u, i) => `
                <tr>
                    <td><b>${u.username}</b></td>
                    <td>${u.pass || u.password}</td>
                    <td>${u.name || 'N/A'}</td>
                    <td>${u.role || 'Staff'}</td>
                    <td>
                        <span style="padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700; ${u.status === 'Deactivated' ? 'background:#fee2e2; color:#ef4444;' : 'background:#dcfce7; color:#16a34a;'}">
                            ${u.status || 'Active'}
                        </span>
                    </td>
                    <td>
                        <button onclick="updateSystemUserPass('${u.username}')" class="btn-primary" style="padding:4px 8px; font-size:11px;">Update Pass</button>
                        ${u.role !== 'Super Admin' ? `
                            <button onclick="toggleUserStatus('${u.username}', '${u.status === 'Deactivated' ? 'Active' : 'Deactivated'}')" 
                                    class="${u.status === 'Deactivated' ? 'btn-success' : 'btn-danger'}" 
                                    style="padding:4px 8px; font-size:11px; margin-left:5px;">
                                ${u.status === 'Deactivated' ? 'Activate' : 'Deactivate'}
                            </button>
                        ` : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

async function createNewSystemUser() {
    let username = document.getElementById('nuUser').value.trim();
    let pass = document.getElementById('nuPass').value.trim();
    let name = document.getElementById('nuName').value.trim();
    let role = document.getElementById('nuRole').value;

    let permissions = {
        pos: document.getElementById('perm_pos').checked,
        returns: document.getElementById('perm_returns').checked,
        medicines: document.getElementById('perm_medicines').checked,
        admin: document.getElementById('perm_admin').checked
    };

    if (!username || !pass) { 
        alert('Username aur Password mandatory hai!'); 
        return; 
    }

    let newUser = { username, pass, name: name || username, role, status: 'Active', permissions };

    let users = JSON.parse(localStorage.getItem('erp_users')) || [];
    let existingIndex = users.findIndex(x => x.username === username);
    if(existingIndex >= 0) users[existingIndex] = newUser;
    else users.push(newUser);

    localStorage.setItem('erp_users', JSON.stringify(users));

    try {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });
        alert('User User ID successfully created and synced with Cloud Server!');
    } catch (e) {
        alert('User ID created locally!');
    }

    document.getElementById('nuUser').value = '';
    document.getElementById('nuPass').value = '';
    document.getElementById('nuName').value = '';
    await loadCloudUsers();
}

async function toggleUserStatus(username, newStatus) {
    let users = JSON.parse(localStorage.getItem('erp_users')) || [];
    let u = users.find(x => x.username === username);
    if (u) {
        u.status = newStatus;
        localStorage.setItem('erp_users', JSON.stringify(users));

        try {
            await fetch('/api/users/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, status: newStatus })
            });
        } catch(e) {}

        alert(`User '${username}' account status changed to '${newStatus}'!`);
        await loadCloudUsers();
    }
}

async function updateSystemUserPass(username) {
    let newP = prompt(`Enter New Password for ${username}:`);
    if (newP && newP.trim() !== '') {
        let users = JSON.parse(localStorage.getItem('erp_users')) || [];
        let u = users.find(x => x.username === username);
        if(u) u.pass = newP.trim();
        localStorage.setItem('erp_users', JSON.stringify(users));

        try {
            await fetch('/api/users/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pass: newP.trim() })
            });
            alert('Password Updated!');
        } catch (e) {}

        await loadCloudUsers();
    }
}