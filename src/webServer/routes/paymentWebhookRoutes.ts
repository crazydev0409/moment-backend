import express from 'express';
import * as paymentWebhookController from '../controllers/paymentWebhookController';
import { asHandler } from '../../types/express';

// No `authenticate` here on purpose — Stripe calls this directly, and the
// webhook signature check (in the controller) is the authentication. Mounted
// with express.raw() directly on `app` in server.ts, not nested under the
// normal /api router, since it needs the raw body before JSON parsing runs.
const router = express.Router();

router.post('/', asHandler(paymentWebhookController.handleStripeWebhook));

export default router;
