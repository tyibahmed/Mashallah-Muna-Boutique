// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// NOTE: this is at the repo root: /api/stripe-prices.json
const prices = require('../../api/stripe-prices.json');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { items } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No items' }) };
    }

    const line_items = items.map((it) => {
      const price = prices[it.id];
      if (!price) throw new Error(`Missing price mapping for product id ${it.id}`);
      return { price, quantity: Math.max(1, parseInt(it.qty || 1, 10)) };
    });

    const origin =
      event.headers.origin ||
      (event.headers.referer ? new URL(event.headers.referer).origin : '');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
      billing_address_collection: 'required',
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe checkout error:', err?.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error', hint: err?.message || 'unknown' }),
    };
  }
};
