window.renderSales = function(container) {
    let salesStock = JSON.parse(localStorage.getItem('erp_medicines')) || [
        { name: 'Tab Dolo 650 mg', batch: '123', hsn: '3004', expiry: '12/28', mrp: 2, stock: 95, gst: 12 }
    ];

    let cart = [];

    container.innerHTML = `
        <div class="light-card">
            <h2>🛒 Sales Billing Counter (A.R. HEALTHCARE)</h2>
            <div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                <button class="btn-primary" onclick="openQuickAddModal()">+ Quick Add New Stock</button>
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label>Invoice Serial No</label>
                    <input type="text" id="invoiceNo" class="form-control" value="ar03" readonly style="background:#f1f5f9;">
                </div>
                <div class="form-group">
                    <label>Billing Date</label>
                    <input type="text" id="billDate" class="form-control" value="${new Date().toLocaleDateString('en-GB')}" readonly style="background:#f1f5f9;">
                </div>
                <div class="form-group">
                    <label>10-Digit Mobile No *</label>
                    <input type="text" id="custMobile" class="form-control" maxlength="10" placeholder="10-digit mobile">
                </div>
                <div class="form-group">
                    <label>Patient Name *</label>
                    <input type="text" id="custName" class="form-control" placeholder="Patient Full Name">
                </div>
                <div class="form-group">
                    <label>Doctor Name</label>
                    <input type="text" id="docName" class="form-control" placeholder="Dr. Name">
                </div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:15px;">
                <label style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Search Medicine Item</label>
                <select id="itemSelect" class="form-control" onchange="autoFillItemDetails()" style="margin-top:5px;">
                    <option value="">-- Select Medicine Item --</option>
                    ${salesStock.map((m, idx) => `<option value="${idx}">${m.name} \vert{} Batch:${m.batch} | GST: ${m.gst \vert{}\vert{} 0}\% \vert{} Stock:${m.stock}</option>`).join('')}
                </select>

                <div class="form-grid" style="margin-top:10px;">
                    <div class="form-group"><label>Batch</label><input type="text" id="itemBatch" class="form-control" readonly></div>
                    <div class="form-group"><label>HSN</label><input type="text" id="itemHsn" class="form-control" readonly></div>
                    <div class="form-group"><label>Expiry</label><input type="text" id="itemExp" class="form-control" readonly></div>
                    <div class="form-group"><label>GST %</label><input type="text" id="itemGst" class="form-control" readonly style="background:#e0f2fe; font-weight:700;"></div>
                    <div class="form-group"><label>MRP (₹)</label><input type="number" id="itemMrp" class="form-control" readonly></div>
                    <div class="form-group"><label>Qty</label><input type="number" id="itemQty" class="form-control" value="1" min="1"></div>
                    <div class="form-group" style="display:flex; align-items:flex-end;">
                        <button class="btn-success" onclick="addItemToCart()" style="width:100%;">+ Add Item</button>
                    </div>
                </div>
            </div>

            <table class="data-table">
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
                <tbody id="cartTableBody">
                    <tr><td colspan="8" style="text-align:center; color:#94a3b8;">No items added to cart.</td></tr>
                </tbody>
            </table>

            <div style="background:#0f172a; color:#fff; padding:20px; border-radius:12px; margin-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <div style="display:flex; gap:15px; align-items:center;">
                    <div>
                        <label style="font-size:11px; color:#94a3b8; display:block;">DISCOUNT TYPE</label>
                        <select id="discType" onchange="renderCartTable()" class="form-control" style="background:#1e293b; color:#fff; border-color:#334155; width:110px;">
                            <option value="Flat">Flat ₹</option>
                            <option value="Percent">% Off</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px; color:#94a3b8; display:block;">DISCOUNT VALUE</label>
                        <input type="number" id="discValue" value="0" oninput="renderCartTable()" class="form-control" style="background:#1e293b; color:#fff; border-color:#334155; width:100px;">
                    </div>
                    <div>
                        <label style="font-size:11px; color:#94a3b8; display:block;">PRINT MODE</label>
                        <select id="printMode" class="form-control" style="background:#1e293b; color:#fff; border-color:#334155; width:130px;">
                            <option value="thermal">Thermal (3 Inch)</option>
                            <option value="a4">Standard A4 Page</option>
                        </select>
                    </div>
                </div>

                <div style="text-align:right;">
                    <div style="font-size:12px; color:#94a3b8;" id="summaryText">Gross Total: ₹0.00 | GST: ₹0.00</div>
                    <div style="font-size:24px; font-weight:900; color:#38bdf8;" id="netPayableText">Net Payable: ₹0.00</div>
                    <button class="btn-success" onclick="processCloudBilling()" style="margin-top:8px; font-size:14px; padding:10px 24px;">🖨️ Save & Print Bill</button>
                </div>
            </div>
        </div>

        <!-- QUICK ADD STOCK MODAL -->
        <div id="quickStockModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:99999; justify-content:center; align-items:center;">
            <div style="background:#fff; padding:25px; border-radius:16px; width:100%; max-width:450px;">
                <h3 style="margin-bottom:15px; color:#0f172a;">+ Quick Add New Medicine Stock</h3>
                <div class="form-group"><label>Medicine Name</label><input type="text" id="mName" class="form-control"></div>
                <div class="form-group"><label>Batch No</label><input type="text" id="mBatch" class="form-control"></div>
                <div class="form-group"><label>HSN Code</label><input type="text" id="mHsn" class="form-control" value="3004"></div>
                <div class="form-group"><label>Expiry (MM/YY)</label><input type="text" id="mExp" class="form-control" placeholder="12/28"></div>
                <div class="form-group"><label>Purchase GST % (Set Specific Tax)</label><input type="number" id="mGst" class="form-control" value="12"></div>
                <div class="form-group"><label>MRP Price (₹)</label><input type="number" id="mMrp" class="form-control"></div>
                <div class="form-group"><label>Stock Quantity</label><input type="number" id="mQty" class="form-control" value="50"></div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                    <button class="btn-danger" onclick="closeQuickAddModal()">Cancel</button>
                    <button class="btn-primary" onclick="saveQuickStock()">Save Item</button>
                </div>
            </div>
        </div>
    `;

    window.openQuickAddModal = () => document.getElementById('quickStockModal').style.display = 'flex';
    window.closeQuickAddModal = () => document.getElementById('quickStockModal').style.display = 'none';

    window.saveQuickStock = () => {
        let name = document.getElementById('mName').value.trim();
        let batch = document.getElementById('mBatch').value.trim();
        let hsn = document.getElementById('mHsn').value.trim();
        let expiry = document.getElementById('mExp').value.trim();
        let gst = parseFloat(document.getElementById('mGst').value) || 0;
        let mrp = parseFloat(document.getElementById('mMrp').value) || 0;
        let stock = parseInt(document.getElementById('mQty').value) || 0;

        if(!name || !batch || !mrp) { alert('Please fill required stock fields'); return; }

        salesStock.push({ name, batch, hsn, expiry, gst, mrp, stock });
        localStorage.setItem('erp_medicines', JSON.stringify(salesStock));
        closeQuickAddModal();
        renderSales(container);
    };

    window.autoFillItemDetails = () => {
        let idx = document.getElementById('itemSelect').value;
        if(idx === "") return;
        let item = salesStock[idx];
        document.getElementById('itemBatch').value = item.batch;
        document.getElementById('itemHsn').value = item.hsn;
        document.getElementById('itemExp').value = item.expiry;
        document.getElementById('itemGst').value = item.gst || 0;
        document.getElementById('itemMrp').value = item.mrp;
    };

    window.addItemToCart = () => {
        let idx = document.getElementById('itemSelect').value;
        if(idx === "") { alert('Select item first!'); return; }
        let item = salesStock[idx];
        let qty = parseInt(document.getElementById('itemQty').value) || 1;

        cart.push({ ...item, qty, total: item.mrp * qty });
        renderCartTable();
    };

    window.renderCartTable = () => {
        let tbody = document.getElementById('cartTableBody');
        if(cart.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No items added to cart.</td></tr>`;
            document.getElementById('summaryText').innerText = "Gross Total: ₹0.00 | GST: ₹0.00";
            document.getElementById('netPayableText').innerText = "Net Payable: ₹0.00";
            return;
        }

        let gross = 0;
        let totalGst = 0;

        tbody.innerHTML = cart.map((c, i) => {
            gross += c.total;
            let itemGstAmt = (c.total * (c.gst || 0)) / 100;
            totalGst += itemGstAmt;

            return `
                <tr>
                    <td><b>${c.name}</b></td>
                    <td>${c.batch} / ${c.hsn}</td>
                    <td>${c.expiry}</td>
                    <td>₹${c.mrp.toFixed(2)}</td>
                    <td>${c.qty}</td>
                    <td><span style="background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-weight:700;">${c.gst || 0}%</span></td>
                    <td>₹${c.total.toFixed(2)}</td>
                    <td><button class="btn-danger" onclick="removeCartItem(${i})">Remove</button></td>
                </tr>
            `;
        }).join('');

        let discType = document.getElementById('discType').value;
        let discVal = parseFloat(document.getElementById('discValue').value) || 0;
        let discAmt = discType === 'Flat' ? discVal : (gross * discVal) / 100;
        let net = gross - discAmt;

        document.getElementById('summaryText').innerText = `Gross Total: ₹${gross.toFixed(2)} | Calculated GST: ₹${totalGst.toFixed(2)} | Discount: ₹${discAmt.toFixed(2)}`;
        document.getElementById('netPayableText').innerText = `Net Payable: ₹${net.toFixed(2)}`;
    };

    window.removeCartItem = (i) => {
        cart.splice(i, 1);
        renderCartTable();
    };

    window.processCloudBilling = async () => {
        let mob = document.getElementById('custMobile').value.trim();
        let name = document.getElementById('custName').value.trim();

        if(mob.length !== 10 || isNaN(mob)) { alert('Valid 10-digit Mobile Number mandatory!'); return; }
        if(!name) { alert('Patient Name is required!'); return; }
        if(cart.length === 0) { alert('Add items to cart first!'); return; }

        let mode = document.getElementById('printMode').value;
        let invNo = document.getElementById('invoiceNo').value;
        let bDate = document.getElementById('billDate').value;

        let printWindow = window.open('', '_blank');
        let printStyle = mode === 'thermal' ? 'width:300px; font-size:11px;' : 'width:100%; max-width:800px; font-size:13px;';

        printWindow.document.write(`
            <html>
            <head>
                <title>Print Invoice - ${invNo}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding:15px; margin:0; auto; ${printStyle} }
                    .header { text-align:center; border-bottom:2px dashed #000; padding-bottom:10px; margin-bottom:10px; }
                    .title { font-size:16px; font-weight:bold; }
                    table { width:100%; border-collapse:collapse; margin-top:10px; }
                    th, td { border-bottom:1px solid #ddd; padding:5px; text-align:left; font-size:inherit; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">A R PHARMA AND SURGICAL AGENCY</div>
                    <div>Chairman: DRx. Aarif Rabbani</div>
                    <div>DL No: UP-2026-MED-98765 | GSTIN: 09AAAAA0000A1Z5</div>
                    <div>Maharajganj, UP</div>
                </div>
                <div><b>Inv No:</b> ${invNo} | <b>Date:</b> ${bDate}</div>
                <div><b>Patient:</b> ${name} | <b>Mobile:</b> ${mob}</div>
                <table>
                    <thead><tr><th>Item</th><th>Qty</th><th>MRP</th><th>GST</th><th>Total</th></tr></thead>
                    <tbody>
                        ${cart.map(c => `<tr><td>${c.name}</td><td>${c.qty}</td><td>₹${c.mrp}</td><td>${c.gst}\%</td><td>₹${c.total}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div style="margin-top:15px; text-align:right;">
                    <b>${document.getElementById('netPayableText').innerText}</b>
                </div>
                <div style="text-align:center; margin-top:20px; font-size:10px;">*** Thank You - Get Well Soon ***</div>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };
};