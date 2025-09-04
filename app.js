/* -------------------- STATE -------------------- */
const state = {
  products: [],
  filtered: [],
  cart: [],
  activeTab: 'all', // all | abaya | majlis
};

/* -------------------- HELPERS -------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

/* -------------------- LOAD PRODUCTS -------------------- */
(async function loadProducts() {
  try {
    const r = await fetch('products.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`Failed to fetch products.json (${r.status})`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('products.json must be an array');
    state.products = data;
  } catch (e) {
    console.error('Failed to load products.json:', e);
    state.products = []; // keep empty; you can add a fallback list here if you want
  }
  applyFilter('all');
  render();
})();

/* -------------------- FILTERING -------------------- */
function applyFilter(tab) {
  state.activeTab = tab;
  if (tab === 'all') state.filtered = state.products;
  else state.filtered = state.products.filter(p => p.category === tab);
}

/* -------------------- RENDER -------------------- */
function render() {
  renderTabs();
  renderGrid();
  renderCartIcon();
}

function renderTabs() {
  const tabs = $('#tabs');
  if (!tabs) return;
  tabs.innerHTML = `
    <button data-tab="all"   class="tab ${state.activeTab==='all'?'active':''}">All</button>
    <button data-tab="abaya" class="tab ${state.activeTab==='abaya'?'active':''}">Abaya</button>
    <button data-tab="majlis" class="tab ${state.activeTab==='majlis'?'active':''}">Majlis</button>
  `;
  $$('#tabs .tab').forEach(b=>{
    b.onclick = () => { applyFilter(b.dataset.tab); render(); };
  });
}

function renderGrid() {
  const grid = $('#grid');
  if (!grid) return;

  if (!state.filtered.length) {
    grid.innerHTML = `
      <div class="empty">
        No products found.
      </div>
    `;
    return;
  }

  grid.innerHTML = state.filtered.map(p => `
    <div class="card">
      <div class="card-media">
        <img src="${(p.images && p.images[0]) || 'assets/placeholder.svg'}" alt="${p.name_en}">
      </div>
      <div class="card-body">
        <h3 class="title">${p.name_en}</h3>
        <div class="price-line">
          <span class="price">${money(p.price)}</span>
          ${p.compare_at ? `<span class="compare">${money(p.compare_at)}</span>` : ''}
        </div>
        <div class="actions">
          <button class="btn" data-id="${p.id}">Add to cart</button>
        </div>
      </div>
    </div>
  `).join('');

  $$('#grid .btn').forEach(btn=>{
    btn.onclick = () => addToCart(btn.getAttribute('data-id'));
  });
}

function renderCartIcon() {
  const count = state.cart.reduce((a,c)=>a+c.qty,0);
  const badge = $('#cartCount');
  if (badge) badge.textContent = String(count);
}

/* -------------------- CART -------------------- */
function addToCart(id) {
  const p = state.products.find(x=>x.id===id);
  if (!p) return;
  const existing = state.cart.find(x=>x.id===id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1, name: p.name_en, price: p.price });
  renderCartIcon();
  openCart();
}

function openCart() {
  const panel = $('#cartPanel');
  if (!panel) return;
  panel.classList.add('open');

  if (!state.cart.length) {
    panel.innerHTML = `
      <div class="cart">
        <h3>Cart</h3>
        <p>Your cart is empty.</p>
        <button id="closeCart" class="btn outline">Close</button>
      </div>`;
    $('#closeCart').onclick = () => panel.classList.remove('open');
    return;
  }

  const itemsHtml = state.cart.map(it=>{
    const p = state.products.find(x=>x.id===it.id);
    return `
      <div class="cart-row">
        <div class="cart-title">${p?.name_en || it.id}</div>
        <div class="cart-qty">
          <button class="qbtn" data-action="dec" data-id="${it.id}">−</button>
          <span>${it.qty}</span>
          <button class="qbtn" data-action="inc" data-id="${it.id}">+</button>
        </div>
        <div class="cart-sub">${money((p?.price || 0) * it.qty)}</div>
      </div>
    `;
  }).join('');

  const total = state.cart.reduce((sum,it)=>{
    const p = state.products.find(x=>x.id===it.id);
    return sum + (p?.price || 0) * it.qty;
  },0);

  panel.innerHTML = `
    <div class="cart">
      <div class="cart-head">
        <h3>Cart</h3>
        <button id="closeCart" class="icon">✕</button>
      </div>
      ${itemsHtml}
      <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
      <div class="cart-actions">
        <button id="checkoutStripe" class="btn primary">Pay with Card</button>
        <button id="clearCart" class="btn outline">Clear</button>
      </div>
    </div>
  `;

  $('#closeCart').onclick = () => panel.classList.remove('open');
  $('#clearCart').onclick = () => { state.cart = []; renderCartIcon(); openCart(); };
  $$('#cartPanel .qbtn').forEach(b=>{
    const id = b.getAttribute('data-id');
    b.onclick = () => {
      const it = state.cart.find(x=>x.id===id);
      if (!it) return;
      if (b.dataset.action === 'inc') it.qty += 1;
      else it.qty = Math.max(0, it.qty - 1);
      if (it.qty === 0) state.cart = state.cart.filter(x=>x.id!==id);
      openCart();
      renderCartIcon();
    };
  });
  $('#checkoutStripe').onclick = checkoutStripe;
}

/* -------------------- STRIPE CHECKOUT -------------------- */
// Better Stripe checkout with clear errors
async function checkoutStripe() {
  if (!state.cart || state.cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const items = state.cart.map(it => ({
    id: it.id,
    qty: it.qty || 1,
    size: it.size || null,
    color: it.color || null
  }));

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (res.ok && data && data.url) {
      window.location.href = data.url;
      return;
    }

    const hint = (data && (data.hint || data.error)) || text || 'Unknown error';
    console.error('Stripe checkout failed:', { status: res.status, data });
    alert('Stripe checkout error: ' + hint);
  } catch (err) {
    console.error('Network/JS error during checkout:', err);
    alert('Stripe checkout error: network issue. Please try again.');
  }
}

/* -------------------- DOM HOOKS -------------------- */
window.addEventListener('DOMContentLoaded', () => {
  // menu/cart triggers if you have them in HTML
  const cartBtn = $('#openCart');
  if (cartBtn) cartBtn.onclick = openCart;
});
