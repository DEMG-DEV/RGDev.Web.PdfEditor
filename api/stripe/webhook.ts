import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecret || !webhookSecret) {
    console.error('Faltan claves de Stripe en variables de entorno.');
    return res.status(500).json({ error: 'Configuración incompleta de Stripe en el servidor.' });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2024-11-20.acacia' as any,
  });

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ error: 'Falta cabecera stripe-signature.' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Error al verificar firma de webhook de Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Si Supabase está configurado con service role key, sincronizamos la base de datos
  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id || session.metadata?.userId;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          const planTier = session.metadata?.planTier || 'pro_monthly';

          if (userId) {
            await supabase
              .from('profiles')
              .update({
                is_pro: true,
                plan_tier: planTier,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const status = subscription.status;
          const isActive = status === 'active' || status === 'trialing';

          await supabase
            .from('profiles')
            .update({
              is_pro: isActive,
              subscription_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          await supabase
            .from('profiles')
            .update({
              is_pro: false,
              plan_tier: 'free',
              subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;

          await supabase
            .from('profiles')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);
          break;
        }

        default:
          // Otros eventos no requieren acción
          break;
      }
    } catch (dbErr) {
      console.error('Error al actualizar Supabase desde webhook:', dbErr);
      return res.status(500).json({ error: 'Error al actualizar base de datos.' });
    }
  }

  return res.status(200).json({ received: true });
}
