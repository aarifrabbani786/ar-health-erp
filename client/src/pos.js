let cart = [];
const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('itemSearch');
    const searchResults = document.getElementById('searchResults');

    // Live Search Event
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 1) {
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
            const products = await res.json();

            if (products && products.length > 0) {
                searchResults.innerHTML = products.map(item => `
                    <div class="search-item-row" onclick='addToCart(${JSON.stringify(item)})'>
                        <div>
                            <strong>${item.name}</strong> 
                            <span class="badge-batch">Batch: ${item.batch_number || 'N/A'}</span>
                        </div>
                        <div>
                            <span>MRP: ₹${item.mrp || item.price}</span> | 
                            <strong>Stock: ${item.stock_quantity || item.stock}</strong>
                        </div>
                    </div>
                `).join('');
                searchResults.classList.remove('hidden');
            } else {
                searchResults.innerHTML = `<div class="search-item-row" style="color:#888;">No medicine found</div>`;
                searchResults.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            searchInput.focus();
        } else if (e.key === 'F1') {
            e.preventDefault();
            resetCart();
        } else if (e.key === 'F4') {
            e.preventDefault();
            document.getElementById('custName').focus();
        } else if (e.key === 'F12') {
            e.preventDefault();
            processCheckout();
        }
    });
});

function addToCart(product) {
    const existing = cart.find(p => p.id === product.id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            batch: product.batch_number || 'N/A',
            exp: product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A',
            qty: 1,
            mrp: product.mrp || product.price,
            rate: product.price || product.mrp
        });
    }
    document.getElementById('searchResults').classList.add('hidden');
    document.getElementById('itemSearch').value = '';
    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cartItems');
    if (cart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: #888;">Cart is empty. Search medicine to add.</td></tr>`;
        calculateTotals();
        return;
    }

    tbody.innerHTML = cart.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.name}</strong></td>
            <td><span class="badge-batch">${item.batch}</span></td>
            <td>${item.exp}</td>
            <td><input type="number" class="qty-input" value="${item.qty}" min="1" onchange="updateQty(${item.id}, this.value)"></td>
            <td>₹${item.mrp}</td>
            <td>₹${item.rate}</td>
            <td><strong>₹${(item.qty * item.rate).toFixed(2)}</strong></td>
            <td><button class="btn-delete" onclick="removeFromCart(${item.id})">❌</button></td>
        </tr>
    `).join('');

    calculateTotals();
}

function updateQty(id, newQty) {
    const item = cart.find(p => p.id === id);
    if (item) {
        item.qty = parseInt(newQty) || 1;
        renderCart();
    }
}

function removeFromCart(id) {
    cart = cart.filter(p => p.id !== id);
    renderCart();
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
    const discInput = parseFloat(document.getElementById('discInput').value) || 0;
    const grandTotal = Math.max(0, subtotal - discInput);

    document.getElementById('subTotal').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('discAmount').innerText = `₹${discInput.toFixed(2)}`;
    document.getElementById('grandTotal').innerText = `₹${grandTotal.toFixed(2)}`;
}

function resetCart() {
    cart = [];
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    document.getElementById('discInput').value = '0';
    renderCart();
}

async function processCheckout() {
    if (cart.length === 0) {
        alert('Cart khali hai! Pehle medicine add karein.');
        return;
    }

    const payload = {
        customer_name: document.getElementById('custName').value || 'Walk-in Customer',
        customer_phone: document.getElementById('custPhone').value || '',
        payment_mode: document.getElementById('payMode').value,
        discount: parseFloat(document.getElementById('discInput').value) || 0,
        items: cart
    };

    try {
        const res = await fetch(`${API_BASE}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            alert('Bill successfully settle ho gaya hai!');
            resetCart();
        } else {
            alert('Error processing bill: ' + (data.message || 'Server error'));
        }
    } catch (err) {
        console.error('Checkout error:', err);
        alert('Backend Server se connection fail ho gaya!');
    }
}