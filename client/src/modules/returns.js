function renderReturns(container) {
    let rets = JSON.parse(localStorage.getItem('erp_returns')) || [];
    container.innerHTML = `
        <div class="light-card">
            <h2>🔄 Sales Medicine Return Module</h2>
            <div class="form-grid">
                <div class="form-group"><label>Invoice No</label><input type="text" id="retInv" class="form-control" placeholder="e.g. INV-1001"></div>
                <div class="form-group"><label>Medicine Name</label><input type="text" id="retMed" class="form-control" placeholder="Medicine Name"></div>
                <div class="form-group"><label>Return Qty</label><input type="number" id="retQty" class="form-control" value="1" min="1"></div>
            </div>
            <button onclick="processReturnEntry()" class="btn-primary">Process Return & Restock</button>
            
            <h3 style="margin-top:20px; font-size:14px;">Return History Logs</h3>
            <table class="data-table">
                <thead><tr><th>Date</th><th>Invoice No</th><th>Medicine</th><th>Qty</th></tr></thead>
                <tbody>${rets.map(r => `<tr><td>${r.date}</td><td>${r.inv}</td><td>${r.med}</td><td>${r.qty}</td></tr>`).join('') || '<tr><td colspan="4">No return records found.</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function processReturnEntry() {
    let inv = document.getElementById('retInv').value.trim();
    let med = document.getElementById('retMed').value.trim();
    let qty = parseInt(document.getElementById('retQty').value) || 1;
    if(!inv || !med) { alert('Enter Invoice No & Medicine Name!'); return; }

    let rets = JSON.parse(localStorage.getItem('erp_returns')) || [];
    rets.push({ inv, med, qty, date: new Date().toLocaleDateString() });
    localStorage.setItem('erp_returns', JSON.stringify(rets));

    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    let m = meds.find(x => x.name.toLowerCase() === med.toLowerCase());
    if(m) {
        m.qty += qty;
        localStorage.setItem('erp_medicines', JSON.stringify(meds));
    }

    alert('Return Processed and Inventory Restocked!');
    loadModule('returns');
}