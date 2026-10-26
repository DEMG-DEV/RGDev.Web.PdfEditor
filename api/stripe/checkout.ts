import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return res.status(500).json({
      error: 'STRIPE_SECRET_KEY no está configurada en las variables de entorno de Vercel.',
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2024-11-20.acacia' as any,
  });

  try {
    const { priceId, planTier, returnUrl, userId, userEmail, customerId } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ error: 'Se requiere priceId para crear el checkout.' });
    }

    const appUrl = returnUrl || process.env.VITE_APP_URL || 'http://localhost:5173';

    // Parámetros de la sesión de Stripe Checkout
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${appUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      metadata: {
        userId: userId || '',
        planTier: planTier || 'pro_monthly',
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    if (userId) {
      sessionParams.client_reference_id = userId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error al crear sesión de Stripe Checkout:', error);
    return res.status(500).json({
      error: error.message || 'Error interno al comunicarse con Stripe.',
    });
  }
}
