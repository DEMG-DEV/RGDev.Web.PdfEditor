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
      error: 'STRIPE_SECRET_KEY no está configurada.',
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2024-11-20.acacia' as any,
  });

  try {
    const { customerId, returnUrl } = req.body || {};

    if (!customerId) {
      return res.status(400).json({
        error: 'Se requiere el customerId de Stripe para abrir el portal de facturación.',
      });
    }

    const appUrl = returnUrl || process.env.VITE_APP_URL || 'http://localhost:5173';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl,
    });

    return res.status(200).json({
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error('Error al abrir Stripe Customer Portal:', error);
    return res.status(500).json({
      error: error.message || 'Error al comunicarse con Stripe Billing Portal.',
    });
  }
}
