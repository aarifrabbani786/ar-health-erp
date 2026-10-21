let currentCart = [];

function renderPOS(container) {
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    let bills = JSON.parse(localStorage.getItem('erp_bills')) || [];
    let nextInv = 'INV-' + (ar01 + bills.length);
    let medOpts = meds.map(m => `<option value="${m.name}">${m.name} (${m.batch}) - Stock: ${m.qty}</option>`).join('');

    container.innerHTML = `
        <div class="light-card">
            <h2>🛒 sale Billing Module Counter</h2>
            <div class="form-grid">
                <div class="form-group"><label>Serial Invoice No</label><input type="text" id="posInv" class="form-control" value="${nextInv}" readonly></div>
                <div class="form-group"><label>10-Digit Mobile Lock *</label><input type="text" id="posMob" class="form-control" maxlength="10" placeholder="10-digit mobile"></div>
                <div class="form-group"><label>Patient Name *</label><input type="text" id="posCust" class="form-control" placeholder="Patient Name"></div>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px; align-items:flex-end;">
                <div style="flex:2;"><label style="font-size:11px; font-weight:700; color:#64748b;">SELECT MEDICINE</label><select id="posMed" class="form-control" onchange="autoFillPrice()"><option value="">-- Choose Medicine --</option>${medOpts}</select></div>
                <div style="width:100px;"><label style="font-size:11px; font-weight:700; color:#64748b;">QTY</label><input type="number" id="posQty" class="form-control" value="1" min="1"></div>
                <div style="width:100px;"><label style="font-size:11px; font-weight:700; color:#64748b;">PRICE</label><input type="number" id="posPrice" class="form-control" placeholder="Price" readonly></div>
                <button onclick="addPOSItem()" class="btn-primary" style="height:38px;">+ Add Item</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody id="posCartTable"><tr><td colspan="4">Cart is empty</td></tr></tbody>
            </table>
            <div style="margin-top:15px; text-align:right;">
                <button onclick="checkoutPOSBill()" class="btn-success">Save & Complete Bill</button>
            </div>
        </div>
    `;
    currentCart = [];
}

function autoFillPrice() {
    let mName = document.getElementById('posMed').value;
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    let f = meds.find(x => x.name === mName);
    if(f) document.getElementById('posPrice').value = f.price;
}

function addPOSItem() {
    let name = document.getElementById('posMed').value;
    let qty = parseInt(document.getElementById('posQty').value) || 1;
    let price = parseFloat(document.getElementById('posPrice').value) || 0;
    if(!name) { alert('Select a medicine!'); return; }

    currentCart.push({ name, qty, price, total: qty * price });
    let tbody = document.getElementById('posCartTable');
    tbody.innerHTML = currentCart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price}</td><td>₹${i.total}</td></tr>`).join('');
}

function checkoutPOSBill() {
    let invNo = document.getElementById('posInv').value;
    let mob = document.getElementById('posMob').value.trim();
    let cust = document.getElementById('posCust').value.trim();

    if(mob.length !== 10) { alert('Mobile number MUST be exactly 10 digits!'); return; }
    if(!cust || currentCart.length === 0) { alert('Enter patient name and add items!'); return; }

    let netTotal = currentCart.reduce((s,i) => s + i.total, 0);
    let bills = JSON.parse(localStorage.getItem('erp_bills')) || [];
    bills.push({ invNo, mob, cust, items: [...currentCart], netTotal, date: new Date().toLocaleDateString() });
    localStorage.setItem('erp_bills', JSON.stringify(bills));

    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    currentCart.forEach(item => {
        let m = meds.find(x => x.name === item.name);
        if(m) m.qty = Math.max(0, m.qty - item.qty);
    });
    localStorage.setItem('erp_medicines', JSON.stringify(meds));

    alert('Bill Generated Successfully!');
    loadModule('pos');
}