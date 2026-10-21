let currentCart = [];

function renderSales(container) {
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [
        { id: 1, name: 'Paracetamol 500mg', batch: 'BAT-9081', hsn: '3004', exp: '2027-12', price: 15.00, gst: 12, qty: 100 },
        { id: 2, name: 'Amoxicillin 250mg', batch: 'BAT-4412', hsn: '3004', exp: '2026-08', price: 45.00, gst: 12, qty: 50 }
    ];
    let bills = JSON.parse(localStorage.getItem('erp_bills')) || [];
    
    // Auto Serial Invoice Generation (ar01, ar02, ar03...)
    let nextNum = bills.length + 1;
    let nextInv = 'ar' + (nextNum < 10 ? '0' + nextNum : nextNum);
    let todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let medOpts = meds.map(m => `<option value="${m.name}">${m.name} | Batch: ${m.batch} | Exp: ${m.exp} | Stock: ${m.qty}</option>`).join('');

    container.innerHTML = `
        <div class="light-card" style="background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 22px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
                <h2 style="margin: 0; color: #0284c7; font-size: 20px;">🛒 Sales Billing Counter</h2>
                <button onclick="openQuickAddMedicineModal()" class="btn-primary" style="background: #4f46e5; padding: 8px 14px;">+ Quick Add New Stock Item</button>
            </div>

            <!-- PATIENT & DOCTOR INFO BAR -->
            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 15px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #cbd5e1;">
                <div class="form-group"><label>Invoice Serial No</label><input type="text" id="salesInv" class="form-control" value="${nextInv}" readonly style="background:#e2e8f0; font-weight:bold; color:#0284c7;"></div>
                <div class="form-group"><label>Billing Date (System Locked)</label><input type="text" id="salesDate" class="form-control" value="${todayDate}" readonly style="background:#e2e8f0; font-weight:600;"></div>
                <div class="form-group"><label>10-Digit Mobile No *</label><input type="text" id="salesMob" class="form-control" maxlength="10" placeholder="10-digit mobile" onkeypress="handleEnterKey(event, 'salesCust')"></div>
                <div class="form-group"><label>Patient Name *</label><input type="text" id="salesCust" class="form-control" placeholder="Patient Full Name" onkeypress="handleEnterKey(event, 'salesDoc')"></div>
                <div class="form-group"><label>Doctor Name</label><input type="text" id="salesDoc" class="form-control" placeholder="Dr. Name" onkeypress="handleEnterKey(event, 'salesMed')"></div>
            </div>

            <!-- MEDICINE SEARCH & SELECTION BAR -->
            <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #cbd5e1;">
                <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 6px;">SEARCH MEDICINE ITEM</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
                    <div style="flex: 2; min-width: 220px;">
                        <select id="salesMed" class="form-control" onchange="autoFillMedDetails()">
                            <option value="">-- Search & Select Medicine --</option>
                            ${medOpts}
                        </select>
                    </div>
                    <div style="width: 100px;"><label style="font-size: 10px; font-weight:700;">BATCH</label><input type="text" id="salesBatch" class="form-control" readonly placeholder="Batch"></div>
                    <div style="width: 90px;"><label style="font-size: 10px; font-weight:700;">HSN</label><input type="text" id="salesHSN" class="form-control" readonly placeholder="HSN"></div>
                    <div style="width: 90px;"><label style="font-size: 10px; font-weight:700;">EXPIRY</label><input type="text" id="salesExp" class="form-control" readonly placeholder="Exp"></div>
                    <div style="width: 90px;"><label style="font-size: 10px; font-weight:700;">MRP (₹)</label><input type="number" id="salesPrice" class="form-control" readonly placeholder="MRP"></div>
                    <div style="width: 80px;"><label style="font-size: 10px; font-weight:700;">QTY</label><input type="number" id="salesQty" class="form-control" value="1" min="1" onkeypress="handleEnterKey(event, 'add-item-btn')"></div>
                    <button id="add-item-btn" onclick="addSalesItem()" class="btn-primary" style="height: 38px;">+ Add Item</button>
                </div>
            </div>

            <!-- CART ITEMS TABLE WITH EDIT CONTROLS -->
            <table class="data-table" style="margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>Batch / HSN</th>
                        <th>Expiry</th>
                        <th>MRP</th>
                        <th>Qty</th>
                        <th>GST %</th>
                        <th>Total Amount</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="salesCartTable">
                    <tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">No items added to billing cart.</td></tr>
                </tbody>
            </table>

            <!-- BOTTOM FINANCIAL & DISCOUNT BAR -->
            <div style="background: #0f172a; color: #ffffff; padding: 20px; border-radius: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: center;">
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; font-weight: 700; display: block;">DISCOUNT TYPE</label>
                        <select id="discType" class="form-control" style="width: 110px; background: #1e293b; color: #fff; border-color: #334155;" onchange="calculateCartTotals()">
                            <option value="flat">Flat ₹</option>
                            <option value="percent">Percentage %</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; font-weight: 700; display: block;">DISCOUNT VALUE</label>
                        <input type="number" id="discValue" class="form-control" value="0" style="width: 110px; background: #1e293b; color: #fff; border-color: #334155;" oninput="calculateCartTotals()">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; font-weight: 700; display: block;">PAYMENT MODE</label>
                        <select id="payMode" class="form-control" style="width: 130px; background: #1e293b; color: #38bdf8; font-weight: bold; border-color: #334155;">
                            <option value="Cash">💵 Cash</option>
                            <option value="UPI / QR">📱 UPI / QR</option>
                            <option value="Card">💳 Card</option>
                            <option value="Credit">📜 Credit / Udhar</option>
                        </select>
                    </div>
                </div>

                <div style="text-align: right;">
                    <div style="font-size: 12px; color: #cbd5e1;">Gross Total: <span id="lblGross">₹0.00</span> | Discount: <span id="lblDisc">₹0.00</span> | GST: <span id="lblGST">₹0.00</span></div>
                    <div style="font-size: 24px; font-weight: 900; color: #38bdf8; margin-top: 2px;">Net Payable: <span id="lblNet">₹0.00</span></div>
                    <div style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="checkoutSalesBill(true)" class="btn-success" style="padding: 10px 20px;">🖨️ Save & Print Bill</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- QUICK ADD MEDICINE MODAL -->
        <div id="quickMedModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:99999; align-items:center; justify-content:center;">
            <div style="background:#fff; padding:25px; border-radius:12px; width:100%; max-width:450px;">
                <h3 style="margin-bottom:15px; color:#0f172a;">+ Quick Add New Medicine Stock</h3>
                <div class="form-group"><label>Medicine Name</label><input type="text" id="qmName" class="form-control"></div>
                <div class="form-group"><label>Batch No</label><input type="text" id="qmBatch" class="form-control"></div>
                <div class="form-group"><label>HSN Code</label><input type="text" id="qmHSN" class="form-control" value="3004"></div>
                <div class="form-group"><label>Expiry (MM/YY)</label><input type="text" id="qmExp" class="form-control" placeholder="12/28"></div>
                <div class="form-group"><label>MRP Price (₹)</label><input type="number" id="qmPrice" class="form-control"></div>
                <div class="form-group"><label>Stock Quantity</label><input type="number" id="qmQty" class="form-control" value="50"></div>
                <div style="margin-top:15px; text-align:right;">
                    <button onclick="closeQuickMedModal()" class="btn-danger">Cancel</button>
                    <button onclick="saveQuickMedicine()" class="btn-primary" style="margin-left:10px;">Save Item</button>
                </div>
            </div>
        </div>
    `;

    currentCart = [];
}

function handleEnterKey(e, nextId) {
    if (e.key === 'Enter') {
        e.preventDefault();
        let target = document.getElementById(nextId);
        if (target) {
            if (target.tagName === 'BUTTON') target.click();
            else target.focus();
        }
    }
}

function autoFillMedDetails() {
    let name = document.getElementById('salesMed').value;
    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    let f = meds.find(x => x.name === name);
    if (f) {
        document.getElementById('salesBatch').value = f.batch || 'N/A';
        document.getElementById('salesHSN').value = f.hsn || '3004';
        document.getElementById('salesExp').value = f.exp || 'N/A';
        document.getElementById('salesPrice').value = f.price || 0;
    }
}

function addSalesItem() {
    let name = document.getElementById('salesMed').value;
    let batch = document.getElementById('salesBatch').value;
    let hsn = document.getElementById('salesHSN').value;
    let exp = document.getElementById('salesExp').value;
    let price = parseFloat(document.getElementById('salesPrice').value) || 0;
    let qty = parseInt(document.getElementById('salesQty').value) || 1;

    if (!name) { alert('Select a medicine item first!'); return; }

    let existing = currentCart.find(i => i.name === name);
    if (existing) {
        existing.qty += qty;
        existing.total = existing.qty * existing.price;
    } else {
        currentCart.push({ name, batch, hsn, exp, price, qty, gst: 12, total: price * qty });
    }

    renderCartTable();
}

function updateCartQty(index, delta) {
    currentCart[index].qty += delta;
    if (currentCart[index].qty <= 0) {
        currentCart.splice(index, 1);
    } else {
        currentCart[index].total = currentCart[index].qty * currentCart[index].price;
    }
    renderCartTable();
}

function removeCartItem(index) {
    currentCart.splice(index, 1);
    renderCartTable();
}

function renderCartTable() {
    let tbody = document.getElementById('salesCartTable');
    if (currentCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">No items added to billing cart.</td></tr>`;
    } else {
        tbody.innerHTML = currentCart.map((item, idx) => `
            <tr>
                <td><b>${item.name}</b></td>
                <td>${item.batch} / ${item.hsn}</td>
                <td>${item.exp}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>
                    <button onclick="updateCartQty(${idx}, -1)" class="btn-danger" style="padding:2px 6px;">-</button>
                    <span style="font-weight:bold; margin:0 8px;">${item.qty}</span>
                    <button onclick="updateCartQty(${idx}, 1)" class="btn-primary" style="padding:2px 6px;">+</button>
                </td>
                <td>${item.gst}%</td>
                <td style="font-weight:bold; color:#16a34a;">₹${item.total.toFixed(2)}</td>
                <td><button onclick="removeCartItem(${idx})" class="btn-danger" style="padding:4px 8px; font-size:11px;">Remove</button></td>
            </tr>
        `).join('');
    }
    calculateCartTotals();
}

function calculateCartTotals() {
    let gross = currentCart.reduce((s, i) => s + i.total, 0);
    let discType = document.getElementById('discType').value;
    let discVal = parseFloat(document.getElementById('discValue').value) || 0;

    let discountAmount = 0;
    if (discType === 'flat') discountAmount = discVal;
    else discountAmount = (gross * discVal) / 100;

    discountAmount = Math.min(discountAmount, gross);
    let afterDisc = gross - discountAmount;
    let gstAmount = (afterDisc * 12) / 112; 
    let netPayable = afterDisc;

    document.getElementById('lblGross').innerText = '₹' + gross.toFixed(2);
    document.getElementById('lblDisc').innerText = '₹' + discountAmount.toFixed(2);
    document.getElementById('lblGST').innerText = '₹' + gstAmount.toFixed(2);
    document.getElementById('lblNet').innerText = '₹' + netPayable.toFixed(2);
}

function checkoutSalesBill(printRequired) {
    let invNo = document.getElementById('salesInv').value;
    let date = document.getElementById('salesDate').value;
    let mob = document.getElementById('salesMob').value.trim();
    let cust = document.getElementById('salesCust').value.trim();
    let doc = document.getElementById('salesDoc').value.trim() || 'Self / Local Dr.';
    let payMode = document.getElementById('payMode').value;

    if (mob.length !== 10) { alert('Mobile number MUST be exactly 10 digits!'); return; }
    if (!cust) { alert('Enter patient name!'); return; }
    if (currentCart.length === 0) { alert('Add at least one item to cart!'); return; }

    let gross = currentCart.reduce((s, i) => s + i.total, 0);
    let discType = document.getElementById('discType').value;
    let discVal = parseFloat(document.getElementById('discValue').value) || 0;
    let discountAmount = discType === 'flat' ? discVal : (gross * discVal) / 100;
    let netTotal = gross - discountAmount;

    let billData = {
        invNo, date, mob, cust, doc, payMode, items: [...currentCart], gross, discountAmount, netTotal
    };

    let bills = JSON.parse(localStorage.getItem('erp_bills')) || [];
    bills.push(billData);
    localStorage.setItem('erp_bills', JSON.stringify(bills));

    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    currentCart.forEach(item => {
        let m = meds.find(x => x.name === item.name);
        if (m) m.qty = Math.max(0, m.qty - item.qty);
    });
    localStorage.setItem('erp_medicines', JSON.stringify(meds));

    if (printRequired) {
        printInvoiceReceipt(billData);
    } else {
        alert('Bill Generated Successfully!');
        renderSales(document.getElementById('module-workspace'));
    }
}

function printInvoiceReceipt(b) {
    let printWin = window.open('', '_blank');
    printWin.document.write(`
        <html>
        <head>
            <title>Invoice - ${b.invNo}</title>
            <style>
                body { font-family: monospace; padding: 20px; width: 300px; margin: auto; }
                h2 { text-align: center; margin-bottom: 2px; }
                .center { text-align: center; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                th, td { text-align: left; padding: 4px 0; border-bottom: 1px dashed #ccc; }
                .total-line { border-top: 1px solid #000; font-weight: bold; margin-top: 10px; padding-top: 5px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h2>A.R. PHARMA</h2>
            <div class="center">Maharajganj, UP | DL No: UP-2026-MED-98765</div>
            <div class="center">-----------------------------------</div>
            <div style="font-size:11px;">
                <div><b>Inv No:</b> ${b.invNo} | <b>Date:</b> ${b.date}</div>
                <div><b>Patient:</b> ${b.cust} (${b.mob})</div>
                <div><b>Doctor:</b> ${b.doc}</div>
            </div>
            <table>
                <thead><tr><th>Item</th><th>Qty</th><th>MRP</th><th>Total</th></tr></thead>
                <tbody>
                    ${b.items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price}</td><td>₹${i.total}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="total-line">
                <div>Gross Total: ₹${b.gross.toFixed(2)}</div>
                <div>Discount: ₹${b.discountAmount.toFixed(2)}</div>
                <div style="font-size:14px; margin-top:4px;">Net Payable: ₹${b.netTotal.toFixed(2)} (${b.payMode})</div>
            </div>
            <div class="center" style="margin-top:15px;">Thank You! Get Well Soon.</div>
        </body>
        </html>
    `);
    printWin.document.close();
    renderSales(document.getElementById('module-workspace'));
}

function openQuickAddMedicineModal() {
    document.getElementById('quickMedModal').style.display = 'flex';
}
function closeQuickMedModal() {
    document.getElementById('quickMedModal').style.display = 'none';
}

function saveQuickMedicine() {
    let name = document.getElementById('qmName').value.trim();
    let batch = document.getElementById('qmBatch').value.trim();
    let hsn = document.getElementById('qmHSN').value.trim();
    let exp = document.getElementById('qmExp').value.trim();
    let price = parseFloat(document.getElementById('qmPrice').value) || 0;
    let qty = parseInt(document.getElementById('qmQty').value) || 50;

    if (!name || !price) { alert('Enter Medicine Name and Price!'); return; }

    let meds = JSON.parse(localStorage.getItem('erp_medicines')) || [];
    meds.push({ id: Date.now(), name, batch, hsn, exp, price, qty });
    localStorage.setItem('erp_medicines', JSON.stringify(meds));

    alert('New Medicine Added to Stock!');
    closeQuickMedModal();
    renderSales(document.getElementById('module-workspace'));
}