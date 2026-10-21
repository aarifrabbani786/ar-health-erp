async function renderSuperAdmin(container) {
    container.innerHTML = `
        <div class="light-card">
            <h2>⚙️ Super Admin Control Panel (Cloud User Sync)</h2>
            <div class="form-grid">
                <div class="form-group"><label>New Username ID</label><input type="text" id="nuUser" class="form-control" placeholder="e.g. staff1"></div>
                <div class="form-group"><label>Password</label><input type="password" id="nuPass" class="form-control" placeholder="••••••••"></div>
                <div class="form-group"><label>Full Name</label><input type="text" id="nuName" class="form-control" placeholder="Staff Name"></div>
                <div class="form-group"><label>Role</label><input type="text" id="nuRole" class="form-control" value="Billing Operator"></div>
            </div>
            <button onclick="createNewSystemUser()" class="btn-primary">+ Register User ID (Upload to Cloud Server)</button>

            <h3 style="margin-top:20px; font-size:14px;">Authorized Cloud System Users</h3>
            <div id="users-table-box">Loading users from cloud server...</div>
        </div>
    `;

    await loadCloudUsers();
}

// Fetch Users directly from Cloud Server Database
async function loadCloudUsers() {
    const tableBox = document.getElementById('users-table-box');
    if (!tableBox) return;

    try {
        let res = await fetch('/api/users');
        if (res.ok) {
            let users = await res.json();
            localStorage.setItem('erp_users', JSON.stringify(users)); // Sync local cache

            tableBox.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>Username</th><th>Password</th><th>Name</th><th>Role</th><th>Action</th></tr></thead>
                    <tbody>${users.map((u, i) => `
                        <tr>
                            <td><b>${u.username}</b></td>
                            <td>${u.pass || u.password}</td>
                            <td>${u.name || 'N/A'}</td>
                            <td>${u.role || 'Staff'}</td>
                            <td><button onclick="updateSystemUserPass('${u.username}')" class="btn-primary" style="padding:4px 8px; font-size:11px;">Update Password</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            `;
        } else {
            tableBox.innerHTML = '<p style="color:red;">Cloud server response error.</p>';
        }
    } catch (err) {
        tableBox.innerHTML = '<p style="color:orange;">Cloud Server Offline. Showing cached users.</p>';
    }
}

// Save New User to Cloud Server DB
async function createNewSystemUser() {
    let username = document.getElementById('nuUser').value.trim();
    let pass = document.getElementById('nuPass').value.trim();
    let name = document.getElementById('nuName').value.trim();
    let role = document.getElementById('nuRole').value.trim();

    if (!username || !pass) { 
        alert('Enter username ID and password!'); 
        return; 
    }

    try {
        let res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pass, name, role })
        });

        if (res.ok) {
            alert('User Successfully Uploaded to Cloud Server! Ab kisi bhi system se login ho jayega.');
            document.getElementById('nuUser').value = '';
            document.getElementById('nuPass').value = '';
            document.getElementById('nuName').value = '';
            await loadCloudUsers();
        } else {
            alert('Failed to save user on Cloud Server.');
        }
    } catch (e) {
        alert('Server Connection Error! Check network.');
    }
}

// Update Password directly on Cloud Server
async function updateSystemUserPass(username) {
    let newP = prompt(`Enter New Password for ${username}:`);
    if (newP && newP.trim() !== '') {
        try {
            let res = await fetch('/api/users/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pass: newP.trim() })
            });

            if (res.ok) {
                alert('Password Updated on Cloud Server!');
                await loadCloudUsers();
            } else {
                alert('Cloud update failed.');
            }
        } catch (e) {
            alert('Error updating password on Cloud.');
        }
    }
}