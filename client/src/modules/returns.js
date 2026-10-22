window.renderReturns = function(container) {
    let invoices = JSON.parse(localStorage.getItem('erp_invoices')) || [];
    let selectedInvoice = null;

    container.innerHTML = `
        <div class="light-card">
            <h2>🔄 Sales Medicine Return Module</h2>
            <p style="font-size:12px; color:#94a3b8; margin-bottom:18px;">Invoice Number is Compulsory to Auto-Fetch Bill Details for Quantity Return.</p>

            <div style="display:flex; gap:12px; max-width:500px; margin-bottom:20px;">
                <input type="text" id="searchInvNo" class="form-control" placeholder="Enter Invoice No (e.g. ar01) *" style="text-transform:lowercase;">
                <button class="btn-primary" onclick="searchInvoiceForReturn()" style="white-space:nowrap;">🔍 Fetch Invoice</button>
            </div>

            <div id="invoiceDetailsArea" style="display:none;">
                <div style="background:rgba(30,41,59,0.5); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2); margin-bottom:18px;" id="invHeaderSummary">
                </div>

                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Medicine Item</th>
                            <th>Batch</th>
                            <th>Original Sold Qty</th>
                            <th>MRP (₹)</th>
                            <th>Return Qty</th>
                            <th>Refund Amount</th>
                        </tr>
                    </thead>
                    <tbody id="returnItemsTableBody">
                    </tbody>
                </table>

                <div style="margin-top:20px; text-align:right;">
                    <button class="btn-success" onclick="processReturnSubmit()" style="padding:10px 24px; font-size:14px;">✅ Complete Return & Restore Stock</button>
                </div>
            </div>
        </div>
    `;

    window.searchInvoiceForReturn = function() {
        let invInput = document.getElementById('searchInvNo').value.trim().toLowerCase();
        if(!invInput) {
            alert('Invoice Number compulsory hai!');
            return;
        }

        selectedInvoice = invoices.find(inv => inv.invoiceNo.toLowerCase() === invInput);

        if(!selectedInvoice) {
            alert('Invoice Number ' + invInput + ' nahi mila!');
            document.getElementById('invoiceDetailsArea').style.display = 'none';
            return;
        }

        document.getElementById('invoiceDetailsArea').style.display = 'block';
        document.getElementById('invHeaderSummary').innerHTML = `
            <div style="display:flex; justify-content:space-between; color:#38bdf8; font-weight:700; font-size:14px;">
                <span>Invoice: ${selectedInvoice.invoiceNo}</span>
                <span>Date: ${selectedInvoice.date}</span>
            </div>
            <div style="margin-top:6px; font-size:13px; color:#cbd5e1;">
                <b>Patient:</b> ${selectedInvoice.patientName} | <b>Mobile:</b> ${selectedInvoice.mobile} | <b>Doctor:</b> ${selectedInvoice.doctorName || 'N/A'}
            </div>
        `;

        let tbody = document.getElementById('returnItemsTableBody');
        tbody.innerHTML = selectedInvoice.items.map((item, idx) => `
            <tr>
                <td><b>${item.name}</b></td>
                <td>${item.batch}</td>
                <td>${item.qty}</td>
                <td>₹${item.mrp.toFixed(2)}</td>
                <td>
                    <input type="number" id="retQty_${idx}" class="form-control" value="0" min="0" max="${item.qty}" style="width:90px;" oninput="calculateReturnRefund(${idx}, ${item.mrp})">
                </td>
                <td id="refundAmt_${idx}">₹0.00</td>
            </tr>
        `).join('');
    };

    window.calculateReturnRefund = function(idx, mrp) {
        let qty = parseInt(document.getElementById(`retQty_${idx}`).value) || 0;
        let refund = qty * mrp;
        document.getElementById(`refundAmt_${idx}`).innerText = `₹${refund.toFixed(2)}`;
    };

    window.processReturnSubmit = function() {
        if(!selectedInvoice) return;

        let totalRefund = 0;
        let stockList = JSON.parse(localStorage.getItem('erp_medicines')) || [];

        selectedInvoice.items.forEach((item, idx) => {
            let retQty = parseInt(document.getElementById(`retQty_${idx}`).value) || 0;
            if(retQty > 0) {
                totalRefund += retQty * item.mrp;
                let stIdx = stockList.findIndex(s => s.name === item.name && s.batch === item.batch);
                if(stIdx >= 0) {
                    stockList[stIdx].stock += retQty;
                }
            }
        });

        if(totalRefund === 0) {
            alert('Kam se kam ek item ki return quantity 1 ya usse zyada select karein!');
            return;
        }

        localStorage.setItem('erp_medicines', JSON.stringify(stockList));
        alert(`Return successfully processed! Total Refund Amount: ₹${totalRefund.toFixed(2)}. Stock restored.`);
        renderReturns(container);
    };
};