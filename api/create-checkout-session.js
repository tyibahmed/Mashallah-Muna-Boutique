// api/create-checkout-session.js (Vercel)
import Stripe from 'stripe';
import prices from './stripe-prices.json' assert { type: 'json' };
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
export default async function handler(req, res){
  if(req.method !== 'POST'){ return res.status(405).json({ error:'Method not allowed' }); }
  try{
    const { items } = req.body || {};
    if(!Array.isArray(items) || items.length===0) return res.status(400).json({ error:'No items' });
    const line_items = items.map(it => {
      const price = prices[it.id];
      if(!price) throw new Error(`Missing price for ${it.id}`);
      return { price, quantity: Math.max(1, parseInt(it.qty||1, 10)) };
    });
    const origin = req.headers.origin || '';
    const session = await stripe.checkout.sessions.create({
      mode:'payment', line_items, allow_promotion_codes:true,
      shipping_address_collection:{ allowed_countries:['US','CA'] },
      success_url: `${origin}/?success=true`, cancel_url: `${origin}/?canceled=true`,
      billing_address_collection:'required'
    });
    res.status(200).json({ url: session.url });
  }catch(err){ console.error(err); res.status(500).json({ error:'Server error' }); }
}
