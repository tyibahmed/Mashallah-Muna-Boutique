/* -------------------- STATE -------------------- */
const state = { products: [], filtered: [], cart: [], activeTab: 'all' };

/* -------------------- HELPERS -------------------- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const money = n => `$${Number(n).toFixed(2)}`;

/* -------------------- LOAD PRODUCTS -------------------- */
(async function(){
  try {
    const r = await fetch('products.json', { cache: 'no-store' });
    if(!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('products.json must be an array');
    state.products = data;
  } catch (e) {
    console.error('Failed to load products:', e);
    state.products = [];
  }
  applyFilter('all');
  render();
})();

/* -------------------- FILTER + SEARCH -------------------- */
function applyFilter(tab){
  state.activeTab = tab;
  const q = ($('#search')?.value || '').trim().toLowerCase();
  const list = tab === 'all' ? state.products : state.products.filter(p=>p.category===tab);
  state.filtered = q ? list.filter(p => p.name_en.toLowerCase().includes(q)) : list;
}

/* -------------------- RENDER -------------------- */
function render(){
  renderTabs();
  renderGrid();
  renderCartIcon();
}

function renderTabs(){
  const el = $('#tabs'); if(!el) return;
  el.innerHTML = `
    <button class="tab ${state.activeTab==='all'?'active':''}" data-tab="all">All</button>
    <button class="tab ${state.activeTab==='abaya'?'active':''}" data-tab="abaya">Abayas</button>
    <button class="tab ${state.activeTab==='majlis'?'active':''}" data-tab="majlis">Arabic Majlis</button>
  `;
  $$('#tabs .tab').forEach(b => b.onclick = () => { applyFilter(b.dataset.tab); render(); });
  const s = $('#search');
  if (s && !s._wired) { s._wired = true; s.addEventListener('input', () => { applyFilter(state.activeTab); render(); }); }
}

function renderGrid(){
  const grid = $('#grid'); if(!grid) return;
  if(!state.filtered.length){ grid.innerHTML = `<div class="empty">No products found.</div>`; return; }

  grid.innerHTML = state.filtered.map(p=>{
    const imgs = Array.isArray(p.images) ? p.images : [];
    const first = imgs[0] || 'assets/placeholder.svg';
    return `
      <div class="card" data-id="${p.id}">
        <div class="card-media" data-click="view">
          <img class="gallery-img" src="${first}" alt="${p.name_en}" data-idx="0">
          ${imgs.length>1 ? `
            <button class="gal-btn prev" type="button" aria-label="Prev">‹</button>
            <button class="gal-btn next" type="button" aria-label="Next">›</button>
            <div class="dots">
              ${imgs.map((_,i)=>`<span class="dot ${i===0?'on':''}" data-dot="${i}"></span>`).join('')}
            </div>` : ``}
        </div>
        <div class="card-body">
          <h3 class="title" data-click="view">${p.name_en}</h3>
          <div class="price-line">
            <span class="price">${money(p.price)}</span>
            ${p.compare_at ? `<span class="compare">${money(p.compare_at)}</span>`:''}
          </div>
          <div class="actions">
            <button class="btn add" type="button" data-id="${p.id}">Add to cart</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // One delegated listener: add-to-cart, quick view, gallery
  grid.onclick = (e) => {
    const card = e.target.closest('.card'); if(!card) return;
    const id = card.dataset.id;
    const prod = state.products.find(p=>p.id===id);

    if(e.target.closest('.btn.add')) { addToCart(id); return; }
    if(e.target.closest('[data-click="view"]')) { openQuickView(id); return; }

    if(!prod || !prod.images || prod.images.length<2) return;
    const img = card.querySelector('.gallery-img');
    let idx = parseInt(img.dataset.idx || '0', 10);

    if(e.target.closest('.gal-btn.prev')) idx = (idx - 1 + prod.images.length) % prod.images.length;
    else if(e.target.closest('.gal-btn.next')) idx = (idx + 1) % prod.images.length;
    else if(e.target.closest('.dot')) idx = parseInt(e.target.dataset.dot, 10);
    else return;

    img.src = prod.images[idx];
    img.dataset.idx = String(idx);
    card.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('on', i===idx));
  };
}

function renderCartIcon(){
  const n = state.cart.reduce((a,c)=>a+c.qty,0);
  const badge = $('#cartCount'); if(badge) badge.textContent = String(n);
}

/* -------------------- QUICK VIEW -------------------- */
function openQuickView(id){
  const p = state.products.find(x=>x.id===id); if(!p) return;
  $('#qvImg').src   = (p.images && p.images[0]) || 'assets/placeholder.svg';
  $('#qvTitle').textContent = p.name_en;
  $('#qvPrice').textContent = p.compare_at ? `${money(p.price)}  (was ${money(p.compare_at)})` : money(p.price);
  $('#qvDesc').textContent  = p.description_en || '';
  $('#qvAdd').onclick = ()=>{ addToCart(id); closeQuickView(); };
  $('#quickView').classList.remove('hidden');
}
function closeQuickView(){ $('#quickView').classList.add('hidden'); }
$('#qvClose')?.addEventListener('click', closeQuickView);
$('#quickView')?.addEventListener('click', e => { if(e.target.id==='quickView') closeQuickView(); });

/* -------------------- CART -------------------- */
function addToCart(id){
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const ex = state.cart.find(x=>x.id===id);
  if(ex) ex.qty += 1; else state.cart.push({ id, qty:1, name:p.name_en, price:p.price });
  renderCartIcon(); openCart();
}
function openCart(){
  const panel = $('#cartPanel'); if(!panel) return;
  panel.classList.add('open');

  if(!state.cart.length){
    panel.innerHTML = `
      <div class="cart">
        <div class="cart-head"><h3>Cart</h3></div>
        <p style="padding:16px">Your cart is empty.</p>
      </div>`;
    return;
  }
  const rows = state.cart.map(it=>{
    const p = state.products.find(x=>x.id===it.id);
    return `
      <div class="cart-row">
        <div class="cart-title">${p?.name_en || it.id}</div>
        <div class="cart-qty">
          <button class="qbtn" data-action="dec" data-id="${it.id}">−</button>
          <span>${it.qty}</span>
          <button class="qbtn" data-action="inc" data-id="${it.id}">+</button>
        </div>
        <div class="cart-sub">${money((p?.price||0)*it.qty)}</div>
      </div>`;
  }).join('');
  const total = state.cart.reduce((s,it)=>{
    const p = state.products.find(x=>x.id===it.id);
    return s + (p?.price||0) * it.qty;
  },0);
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
  $('#closeCartX').onclick = ()=>panel.classList.remove('open');
  $('#clearCart').onclick = ()=>{ state.cart=[]; renderCartIcon(); openCart(); };
  $$('#cartPanel .qbtn').forEach(b=>{
    const id = b.getAttribute('data-id');
    b.onclick = ()=>{
      const it = state.cart.find(x=>x.id===id); if(!it) return;
      if(b.dataset.action==='inc') it.qty+=1; else it.qty=Math.max(0,it.qty-1);
      if(it.qty===0) state.cart = state.cart.filter(x=>x.id!==id);
      openCart(); renderCartIcon();
    };
  });
  $('#checkoutStripe').onclick = checkoutStripe;
}

/* -------------------- STRIPE CHECKOUT -------------------- */
async function checkoutStripe(){
  if(!state.cart || state.cart.length===0){ alert('Your cart is empty.'); return; }
  const items = state.cart.map(it => ({ id: it.id, qty: it.qty }));

  try{
    const res = await fetch('/api/create-checkout-session', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ items })
    });
    const text = await res.text(); let data={}; try{ data=JSON.parse(text);}catch{}
    if(res.ok && data.url){ window.location.href = data.url; return; }
    const hint = (data && (data.hint || data.error)) || text || 'Unknown error';
    console.error('Stripe checkout failed:', { status: res.status, data }); alert('Stripe checkout error: '+hint);
  }catch(err){ console.error(err); alert('Stripe checkout error: network issue.'); }
}

/* Header buttons */
$('#openCart')?.addEventListener('click', openCart);
