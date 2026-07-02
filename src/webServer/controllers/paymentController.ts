import { CustomRequestHandler } from '../../types/express';
import { PaymentService } from '../../services/payments/paymentService';

const paymentService = new PaymentService();

export const createSetupIntent: CustomRequestHandler = async (req, res) => {
  try {
    const result = await paymentService.createSetupIntent(req.user!.id);
    return res.json(result);
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create setup intent',
    });
  }
};

export const listPaymentMethods: CustomRequestHandler = async (req, res) => {
  try {
    const methods = await paymentService.listPaymentMethods(req.user!.id);
    return res.json({
      paymentMethods: methods.map((m) => ({
        id: m.id,
        brand: m.card?.brand,
        last4: m.card?.last4,
        expMonth: m.card?.exp_month,
        expYear: m.card?.exp_year,
      })),
    });
  } catch (error) {
    console.error('Error listing payment methods:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to list payment methods',
    });
  }
};

export const deletePaymentMethod: CustomRequestHandler = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }
    await paymentService.detachPaymentMethod(req.user!.id, paymentMethodId);
    return res.json({ message: 'Payment method removed' });
  } catch (error) {
    console.error('Error removing payment method:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to remove payment method',
    });
  }
};

export const getConnectStatus: CustomRequestHandler = async (req, res) => {
  try {
    const status = await paymentService.getConnectStatus(req.user!.id);
    return res.json(status);
  } catch (error) {
    console.error('Error getting connect status:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get payout setup status',
    });
  }
};

export const createConnectOnboardingLink: CustomRequestHandler = async (req, res) => {
  try {
    const result = await paymentService.createOnboardingLink(req.user!.id);
    return res.json(result);
  } catch (error) {
    console.error('Error creating connect onboarding link:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start payout setup',
    });
  }
};

export const createConnectDashboardLink: CustomRequestHandler = async (req, res) => {
  try {
    const result = await paymentService.createDashboardLoginLink(req.user!.id);
    return res.json(result);
  } catch (error) {
    console.error('Error creating connect dashboard link:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to open payout dashboard',
    });
  }
};

export const getBalance: CustomRequestHandler = async (req, res) => {
  try {
    const balance = await paymentService.getBalanceForUser(req.user!.id);
    return res.json(balance);
  } catch (error) {
    console.error('Error getting balance:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get balance',
    });
  }
};

export const listPayoutHistory: CustomRequestHandler = async (req, res) => {
  try {
    const payouts = await paymentService.listPayouts(req.user!.id);
    return res.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        amountCents: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date,
      })),
    });
  } catch (error) {
    console.error('Error listing payouts:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to list payouts',
    });
  }
};

export const createHookBookingCheckout: CustomRequestHandler = async (req, res) => {
  try {
    const payerId = req.user!.id;
    const {
      hookId,
      receiverId,
      startTime,
      endTime,
      title,
      notes,
      meetingType,
      locationType,
      locationLabel,
      locationAddress,
      locationLatitude,
      locationLongitude,
    } = req.body;

    if (!hookId || !receiverId || !startTime || !endTime || !title) {
      return res.status(400).json({
        error: 'hookId, receiverId, startTime, endTime, and title are required',
      });
    }

    const result = await paymentService.createBookingCheckout(payerId, {
      hookId,
      receiverId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      title,
      notes,
      meetingType,
      locationType,
      locationLabel,
      locationAddress,
      locationLatitude,
      locationLongitude,
    });

    return res.json(result);
  } catch (error) {
    console.error('Error creating hook booking checkout:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start checkout',
    });
  }
};
