// Stripe Service
// This service handles Stripe payment operations via Vercel serverless functions

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  paid: boolean;
  priceType: 'one-time' | 'yearly';
  licensePlate: string;
  sessionId: string;
}

export async function createCheckoutSession(
  priceId: string,
  licensePlate?: string
): Promise<CheckoutSessionResponse> {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId, licensePlate: licensePlate || '' }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

export async function verifyPayment(sessionId: string): Promise<VerifyPaymentResponse> {
  try {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
}
