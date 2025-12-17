import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, licensePlate } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Missing required field: priceId' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  
  if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    return res.status(500).json({ error: 'Stripe API key not configured' });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Get origin from request headers or use a default
    const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:5173';
    const baseUrl = origin.replace(/\/$/, '');

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: priceId.includes('yearly') || priceId.includes('subscription') ? 'subscription' : 'payment',
      success_url: `${baseUrl}/check-reports?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/check-reports?canceled=true`,
      metadata: {
        licensePlate: licensePlate || '',
        priceType: priceId.includes('yearly') || priceId.includes('subscription') ? 'yearly' : 'one-time',
      },
    });

    return res.status(200).json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: error.message || 'Invalid Stripe request' });
    }
    
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
}

