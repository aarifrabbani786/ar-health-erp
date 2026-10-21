function renderMedicines(container) {
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    container.innerHTML = `
        <div class="light-card">
            <h2>💊 Stock Master Module (CRUD)</h2>
            <div class="form-grid">
                <div class="form-group"><label>Medicine Name</label><input type="text" id="mName" class="form-control"></div>
                <div class="form-group"><label>Batch No</label><input type="text" id="mBatch" class="form-control"></div>
                <div class="form-group"><label>Price (₹)</label><input type="number" id="mPrice" class="form-control"></div>
                <div class="form-group"><label>Stock Qty</label><input type="number" id="mQty" class="form-control"></div>
            </div>
            <button onclick="addNewMedicine()" class="btn-primary">+ Add Medicine Item</button>

            <table class="data-table" style="margin-top:15px;">
                <thead><tr><th>ID</th><th>Medicine</th><th>Batch</th><th>Price</th><th>Qty</th><th>Action</th></tr></thead>
                <tbody>${meds.map((m,i) => `<tr><td>#${m.id}</td><td><b>${m.name}</b></td><td>${m.batch}</td><td>₹${m.price}</td><td>${m.qty}</td><td><button onclick="deleteMedicineItem(${i})" class="btn-danger" style="padding:4px 8px;">Delete</button></td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}

function addNewMedicine() {
    let name = document.getElementById('mName').value.trim();
    let batch = document.getElementById('mBatch').value.trim();
    let price = parseFloat(document.getElementById('mPrice').value) || 0;
    let qty = parseInt(document.getElementById('mQty').value) || 0;
    if(!name) { alert('Enter medicine name!'); return; }

    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    meds.push({ id: Date.now(), name, batch, price, qty });
    localStorage.setItem('erp_medicines', JSON.stringify(meds));
    loadModule('medicines');
}

function deleteMedicineItem(i) {
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    meds.splice(i, 1);
    localStorage.setItem('erp_medicines', JSON.stringify(meds));
    loadModule('medicines');
}