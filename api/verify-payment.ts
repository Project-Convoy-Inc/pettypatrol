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

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing required field: sessionId' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  
  if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    return res.status(500).json({ error: 'Stripe API key not configured' });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    const isPaid = session.payment_status === 'paid';
    const priceType = session.metadata?.priceType || 'one-time';
    const licensePlate = session.metadata?.licensePlate || '';

    return res.status(200).json({
      success: isPaid,
      paid: isPaid,
      priceType,
      licensePlate,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: error.message || 'Invalid session ID' });
    }
    
    return res.status(500).json({ error: 'Failed to verify payment. Please try again.' });
  }
}
