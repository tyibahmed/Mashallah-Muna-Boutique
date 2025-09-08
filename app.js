/* =========================
   MASHALLAH MUNA BOUTIQUE
   Complete app.js
   ========================= */

/* ---------- Utilities ---------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const money = (n) => `$${Number(n).toFixed(2)}`;

/* ---------- Global state ---------- */
const state = {
  products: [],
  filtered: [],
  cart: [],
  activeTab: 'all', // all | abaya | majlis (from products.json)
};

/* ---------- Initial load ---------- */
(async function init() {
  try {
    const r = await fetch('products.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('products.json must be an array');
    state.products = data;
  } catch (e) {
    console.error('Failed to load products:', e);
    state.products = [];
  }

  // initial filter + render
  applyFilter('all');
  renderTabs();
  wireHeaderDrawers();   // menu + search + overlay behaviors
  renderGrid();
  renderCartIcon();
  handleStripeReturn();  // ?success=true / ?canceled=true
})();

/* ---------- Filtering ---------- */
function applyFilter(tab) {
  state.activeTab = tab;
  const inlineQ = ($('#search')?.value || '').trim().toLowerCase();
  const list = tab === 'all' ? state.products : state.products.filter(p => p.category === tab);
  state.filtered = inlineQ ? list.filter(p => p.name_en.toLowerCase().includes(inlineQ)) : list;
}

/* ---------- Tabs ---------- */
function renderTabs() {
  const el = $('#tabs'); if (!el) return;
  el.innerHTML = `
    <button class="tab ${state.activeTab==='all'?'active':''}" data-tab="all">All</button>
    <button class="tab ${state.activeTab==='abaya'?'active':''}" data-tab="abaya">Abayas</button>
    <button class="tab ${state.activeTab==='majlis'?'active':''}" data-tab="majlis">Arabic Majlis</button>
  `;
  $$('#tabs .tab').forEach(b => b.onclick = () => { applyFilter(b.dataset.tab); renderGrid(); });

  // inline search (in the controls row)
  const inlineSearch = $('#search');
  if (inlineSearch && !inlineSearch._wired) {
    inlineSearch._wired = true;
    inlineSearch.addEventListener('input', () => { applyFilter(state.activeTab); renderGrid(); });
  }
}

/* ---------- Grid + Cards ---------- */
function renderGrid() {
  const grid = $('#grid'); if (!grid) return;

  if (!state.filtered.length) {
    grid.innerHTML = `<div class="empty" style="opacity:.8;padding:16px">No products found.</div>`;
    return;
  }

  grid.innerHTML = state.filtered.map(p => {
    const imgs = Array.isArray(p.images) ? p.images : [];
    const first = imgs[0] || 'assets/placeholder.svg';
    const soldOut = typeof p.stock === 'number' && p.stock <= 0;

    return `
      <article class="card" data-id="${p.id}">
        <div class="card-media" data-click="view">
          <img class="gallery-img" src="${first}" alt="${p.name_en}" data-idx="0">
          ${soldOut ? `<div class="soldout">Sold out</div>` : ``}
          ${imgs.length > 1 ? `
            <button class="gal-btn prev" type="button" aria-label="Previous image">‹</button>
            <button class="gal-btn next" type="button" aria-label="Next image">›</button>
            <div class="dots">
              ${imgs.map((_, i) => `<span class="dot ${i===0?'on':''}" data-dot="${i}"></span>`).join('')}
            </div>
          ` : ``}
        </div>
        <div class="card-body">
          <h3 class="title" data-click="view">${p.name_en}</h3>
          <div class="price-line">
            <span class="price">${money(p.price)}</span>
            ${p.compare_at ? `<span class="compare">${money(p.compare_at)}</span>` : ''}
          </div>
          <div class="actions">
            <button class="btn add" type="button" data-id="${p.id}" ${soldOut?'disabled':''}>
              ${soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // delegated listeners: add, quick view, gallery
  grid.onclick = (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    const id   = card.dataset.id;
    const p    = state.products.find(x => x.id === id);

    if (e.target.closest('.btn.add')) { addToCart(id); return; }
    if (e.target.closest('[data-click="view"]')) { openQuickView(id); return; }

    // gallery
    if (!p || !p.images || p.images.length < 2) return;
    const img = card.querySelector('.gallery-img');
    let idx = parseInt(img.dataset.idx || '0', 10);

    if (e.target.closest('.gal-btn.prev')) idx = (idx - 1 + p.images.length) % p.images.length;
    else if (e.target.closest('.gal-btn.next')) idx = (idx + 1) % p.images.length;
    else if (e.target.closest('.dot')) idx = parseInt(e.target.dataset.dot, 10);
    else return;

    img.src = p.images[idx];
    img.dataset.idx = String(idx);
    card.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i === idx));
  };
}

/* ---------- Quick View ---------- */
function openQuickView(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  $('#qvImg').src = (p.images && p.images[0]) || 'assets/placeholder.svg';
  $('#qvTitle').textContent = p.name_en;
  $('#qvPrice').textContent = p.compare_at ? `${money(p.price)}  (was ${money(p.compare_at)})` : money(p.price);
  $('#qvDesc').textContent  = p.description_en || '';
  $('#qvAdd').onclick = () => { addToCart(id); closeQuickView(); };
  $('#quickView').classList.remove('hidden');
}
function closeQuickView() { $('#quickView')?.classList.add('hidden'); }
$('#qvClose')?.addEventListener('click', closeQuickView);
$('#quickView')?.addEventListener('click', e => { if (e.target.id === 'quickView') closeQuickView(); });

/* ---------- Cart ---------- */
function renderCartIcon() {
  const n = state.cart.reduce((a, c) => a + c.qty, 0);
  const badge = $('#cartCount'); if (badge) badge.textContent = String(n);
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  // respect stock if provided
  if (typeof p.stock === 'number') {
    const inCart = state.cart.find(x => x.id === id)?.qty || 0;
    if (inCart >= p.stock) { alert('This item is out of stock.'); return; }
  }
  const ex = state.cart.find(x => x.id === id);
  if (ex) ex.qty += 1;
  else state.cart.push({ id, qty: 1, name: p.name_en, price: p.price });
  renderCartIcon();
  openCart();
}

function openCart() {
  const panel = $('#cartPanel'); if (!panel) return;

  if (!state.cart.length) {
    panel.innerHTML = `
      <div class="cart">
        <div class="cart-head">
          <h3>Cart</h3>
          <button id="closeCartX" class="icon-btn" aria-label="Close">✕</button>
        </div>
        <p style="padding:16px">Your cart is empty.</p>
      </div>`;
    panel.classList.add('open');
    $('#closeCartX').onclick = () => panel.classList.remove('open');
    return;
  }

  const rows = state.cart.map(it => {
    const p = state.products.find(x => x.id === it.id);
    return `
      <div class="cart-row">
        <div class="cart-title">${p?.name_en || it.id}</div>
        <div class="cart-qty">
          <button class="qbtn" data-action="dec" data-id="${it.id}" aria-label="Decrease">−</button>
          <span>${it.qty}</span>
          <button class="qbtn" data-action="inc" data-id="${it.id}" aria-label="Increase">+</button>
        </div>
        <div class="cart-sub">${money((p?.price || 0) * it.qty)}</div>
      </div>
    `;
  }).join('');

  const total = state.cart.reduce((s, it) => {
    const p = state.products.find(x => x.id === it.id);
    return s + (p?.price || 0) * it.qty;
  }, 0);

  panel.innerHTML = `
    <div class="cart">
      <div class="cart-head">
        <h3>Cart</h3>
        <button id="closeCartX" class="icon-btn" aria-label="Close">✕</button>
      </div>
      ${rows}
      <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
      <div style="padding:16px; display:flex; gap:10px;">
        <button id="checkoutStripe" class="btn primary" style="flex:1">Pay with Card</button>
        <button id="clearCart" class="btn" style="flex:1">Clear</button>
      </div>
    </div>`;

  panel.classList.add('open');

  // wire controls
  $('#closeCartX').onclick = () => panel.classList.remove('open');
  $('#clearCart').onclick = () => { state.cart = []; renderCartIcon(); openCart(); };
  $$('#cartPanel .qbtn').forEach(b => {
    const id = b.dataset.id;
    b.onclick = () => {
      const it = state.cart.find(x => x.id === id); if (!it) return;
      if (b.dataset.action === 'inc') it.qty += 1; else it.qty = Math.max(0, it.qty - 1);
      if (it.qty === 0) state.cart = state.cart.filter(x => x.id !== id);
      openCart(); renderCartIcon();
    };
  });
  $('#checkoutStripe').onclick = checkoutStripe;
}

$('#openCart')?.addEventListener('click', openCart);

/* ---------- Stripe Checkout ---------- */
async function checkoutStripe() {
  if (!state.cart || state.cart.length === 0) { alert('Your cart is empty.'); return; }
  const items = state.cart.map(it => ({ id: it.id, qty: it.qty }));

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    if (res.ok && data.url) {
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

/* After redirect back from Stripe */
function handleStripeReturn() {
  const url = new URL(location.href);
  if (url.searchParams.get('success') === 'true') {
    state.cart = [];
    renderCartIcon();
    history.replaceState({}, '', '/');
    alert('Thank you! Your order was received.');
  } else if (url.searchParams.get('canceled') === 'true') {
    history.replaceState({}, '', '/');
    alert('Checkout was canceled. You can try again anytime.');
  }
}

/* ---------- Header drawers (menu + search + overlay) ---------- */
function wireHeaderDrawers() {
  const overlay    = $('#overlay');

  // MENU
  const sideMenu   = $('#sideMenu');
  const openMenuBt = $('#openMenu');
  const closeMenuBt= $('#closeMenu');

  function openMenuDrawer() {
    sideMenu?.classList.remove('hidden');
    overlay?.classList.remove('hidden');
    requestAnimationFrame(() => sideMenu?.classList.add('open'));
  }
  function closeMenuDrawer() {
    sideMenu?.classList.remove('open');
    overlay?.classList.add('hidden');
    setTimeout(() => sideMenu?.classList.add('hidden'), 250);
  }
  openMenuBt?.addEventListener('click', openMenuDrawer);
  closeMenuBt?.addEventListener('click', closeMenuDrawer);

  // SEARCH DRAWER
  const searchBar   = $('#searchBar');
  const searchInput = $('#searchInput');
  const openSearch  = $('#openSearch');
  const closeSearch = $('#closeSearch');

  function openSearchBar() {
    searchBar?.classList.remove('hidden');
    overlay?.classList.remove('hidden');
    setTimeout(() => searchInput?.focus(), 30);
  }
  function hideSearchBar() {
    searchBar?.classList.add('hidden');
    overlay?.classList.add('hidden');
  }
  openSearch?.addEventListener('click', openSearchBar);
  closeSearch?.addEventListener('click', hideSearchBar);

  // live filtering from drawer input
  if (searchInput && !searchInput._wired) {
    searchInput._wired = true;
    searchInput.addEventListener('input', () => {
      const q = (searchInput.value || '').trim().toLowerCase();
      const list = state.activeTab === 'all' ? state.products : state.products.filter(p => p.category === state.activeTab);
      state.filtered = q ? list.filter(p => p.name_en.toLowerCase().includes(q)) : list;
      renderGrid();
    });
  }

  // Overlay + ESC closes everything
  overlay?.addEventListener('click', () => {
    closeMenuDrawer();
    hideSearchBar();
    $('#cartPanel')?.classList.remove('open');
    closeQuickView();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenuDrawer();
      hideSearchBar();
      $('#cartPanel')?.classList.remove('open');
      closeQuickView();
    }
  });
}
