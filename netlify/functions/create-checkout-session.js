// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');

// Fail fast if the env var is missing
const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error('Missing STRIPE_SECRET_KEY env var');
}
const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

const prices = require('../../api/stripe-prices.json');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // Validate env on runtime as well
    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error', hint: 'STRIPE_SECRET_KEY not set' }),
      };
    }

    const { items } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No items' }) };
    }

    const line_items = items.map((it) => {
      const price = prices[it.id];
      if (!price) throw new Error(`Missing price mapping for product ${it.id}`);
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
      billing_address_collection: 'required',
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err?.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error', hint: err?.message || 'unknown' }),
    };
  }
};
