import express from 'express';
import * as paymentController from '../controllers/paymentController';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';

const router = express.Router();

router.use(authenticate);

router.post('/setup-intent', asHandler(paymentController.createSetupIntent));

router.get('/payment-methods', asHandler(paymentController.listPaymentMethods));

router.delete('/payment-methods/:paymentMethodId', asHandler(paymentController.deletePaymentMethod));

router.get('/connect-status', asHandler(paymentController.getConnectStatus));

router.post('/connect/onboarding-link', asHandler(paymentController.createConnectOnboardingLink));

router.post('/connect/dashboard-link', asHandler(paymentController.createConnectDashboardLink));

router.get('/balance', asHandler(paymentController.getBalance));

router.get('/payouts', asHandler(paymentController.listPayoutHistory));

router.post('/hook-bookings', asHandler(paymentController.createHookBookingCheckout));

export default router;
