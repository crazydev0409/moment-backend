import express from 'express';
import * as paymentController from '../controllers/paymentController';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /api/payments/setup-intent:
 *   post:
 *     summary: Create a SetupIntent for saving a card to the current user
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: SetupIntent + ephemeral key details for the mobile PaymentSheet
 */
router.post('/setup-intent', asHandler(paymentController.createSetupIntent));

/**
 * @swagger
 * /api/payments/payment-methods:
 *   get:
 *     summary: List the current user's saved cards
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of saved payment methods
 */
router.get('/payment-methods', asHandler(paymentController.listPaymentMethods));

/**
 * @swagger
 * /api/payments/payment-methods/{paymentMethodId}:
 *   delete:
 *     summary: Remove a saved card
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method removed
 */
router.delete('/payment-methods/:paymentMethodId', asHandler(paymentController.deletePaymentMethod));

/**
 * @swagger
 * /api/payments/connect-status:
 *   get:
 *     summary: Get the current user's Stripe Connect payout onboarding status
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Connect account status
 */
router.get('/connect-status', asHandler(paymentController.getConnectStatus));

/**
 * @swagger
 * /api/payments/connect/onboarding-link:
 *   post:
 *     summary: Get a Stripe-hosted onboarding link to set up payouts
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: URL to open in a browser to complete onboarding
 */
router.post('/connect/onboarding-link', asHandler(paymentController.createConnectOnboardingLink));

/**
 * @swagger
 * /api/payments/connect/dashboard-link:
 *   post:
 *     summary: Get a link to the user's Stripe Express dashboard
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: URL to the Stripe Express dashboard
 */
router.post('/connect/dashboard-link', asHandler(paymentController.createConnectDashboardLink));

/**
 * @swagger
 * /api/payments/balance:
 *   get:
 *     summary: Get the current user's live Stripe Connect balance
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Available and pending balance
 */
router.get('/balance', asHandler(paymentController.getBalance));

/**
 * @swagger
 * /api/payments/payouts:
 *   get:
 *     summary: List the current user's recent Stripe payouts
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Recent payouts
 */
router.get('/payouts', asHandler(paymentController.listPayoutHistory));

/**
 * @swagger
 * /api/payments/hook-bookings:
 *   post:
 *     summary: Start a paid-Hook booking checkout (creates the moment request + an authorization hold)
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hookId, receiverId, startTime, endTime, title]
 *             properties:
 *               hookId:
 *                 type: string
 *               receiverId:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: MomentRequest id + PaymentSheet client secret
 *       400:
 *         description: Invalid request, or the host hasn't finished payout setup
 */
router.post('/hook-bookings', asHandler(paymentController.createHookBookingCheckout));

export default router;
