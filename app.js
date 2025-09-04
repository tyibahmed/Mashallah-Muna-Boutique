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

    // Try to parse JSON either way
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* keep raw text if not JSON */ }

    if (res.ok && data && data.url) {
      window.location.href = data.url; // success: go to Stripe Checkout
      return;
    }

    // Not OK – show meaningful hint if present
    const hint = (data && (data.hint || data.error)) || text || 'Unknown error';
    console.error('Stripe checkout failed:', { status: res.status, data });
    alert('Stripe checkout error: ' + hint);
  } catch (err) {
    console.error('Network/JS error during checkout:', err);
    alert('Stripe checkout error: network issue. Please try again.');
  }
}
