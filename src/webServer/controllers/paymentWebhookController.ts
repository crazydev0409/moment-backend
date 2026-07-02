import { CustomRequestHandler } from '../../types/express';
import { requireStripeClient } from '../../services/payments/stripeClient';
import { PaymentService } from '../../services/payments/paymentService';
import { stripeWebhookSecret } from '../../config/config';

const paymentService = new PaymentService();

/**
 * Stripe webhook receiver. Mounted directly on `app` in server.ts with
 * `express.raw()` BEFORE the global `express.json()` — signature verification
 * needs the exact raw request bytes, not the parsed body. No auth middleware:
 * the signature check below *is* the authentication.
 */
export const handleStripeWebhook: CustomRequestHandler = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' });
  }

  let event;
  try {
    const stripe = requireStripeClient();
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Error verifying Stripe webhook signature:', error);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    await paymentService.handleWebhookEvent(event);
    return res.json({ received: true });
  } catch (error) {
    console.error(`Error handling Stripe webhook event ${event.type}:`, error);
    // Still 200 — we don't want Stripe endlessly retrying an event we've
    // already logged; the important state (Payment rows) is idempotent to
    // reprocess and this failure has been surfaced in logs.
    return res.status(200).json({ received: true, processingError: true });
  }
};
