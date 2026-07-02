import Stripe from 'stripe';
import prisma from '../prisma';
import { requireStripeClient } from './stripeClient';
import { stripePlatformFeeBps, appDeepLinkScheme } from '../../config/config';
import { UserService } from '../users/userService';

// Ephemeral Keys must be pinned to a specific Stripe API version so the mobile
// SDK (which may bundle a different version than this server's default) can
// still use them. Kept as one named constant so it's obvious where to bump it
// if the `stripe` package is ever upgraded to a materially newer API version.
const MOBILE_API_VERSION = '2026-06-24.dahlia';

const ABANDONED_CHECKOUT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const STALE_AUTHORIZATION_TIMEOUT_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (Stripe caps holds at ~7 days)

type BookingCheckoutInput = {
  hookId: string;
  receiverId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  notes?: string;
  meetingType?: string;
  locationType?: 'remote' | 'onsite';
  locationLabel?: string;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
};

export class PaymentService {
  // --- Customers / saved cards ---

  async ensureCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true, name: true, email: true },
    });
    if (!user) throw new Error('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const stripe = requireStripeClient();
    const customer = await stripe.customers.create({
      name: user.name || undefined,
      email: user.email || undefined,
      metadata: { userId: user.id },
    });

    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async createSetupIntent(userId: string): Promise<{
    clientSecret: string;
    customerId: string;
    ephemeralKeySecret: string;
  }> {
    const stripe = requireStripeClient();
    const customerId = await this.ensureCustomer(userId);

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: MOBILE_API_VERSION },
    );
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
    });

    return {
      clientSecret: setupIntent.client_secret!,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret!,
    };
  }

  async listPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return [];

    const stripe = requireStripeClient();
    const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' });
    return methods.data;
  }

  async detachPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) {
      throw new Error('No saved payment methods');
    }

    const stripe = requireStripeClient();
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (method.customer !== user.stripeCustomerId) {
      throw new Error('This payment method does not belong to you');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
  }

  // --- Connect (host payouts) ---

  async ensureConnectAccount(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeConnectAccountId: true, email: true },
    });
    if (!user) throw new Error('User not found');
    if (user.stripeConnectAccountId) return user.stripeConnectAccountId;

    const stripe = requireStripeClient();
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email || undefined,
      metadata: { userId: user.id },
    });

    await prisma.user.update({ where: { id: userId }, data: { stripeConnectAccountId: account.id } });
    return account.id;
  }

  async createOnboardingLink(userId: string): Promise<{ url: string }> {
    const stripe = requireStripeClient();
    const accountId = await this.ensureConnectAccount(userId);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: `${appDeepLinkScheme}://payout-details?onboarding=return`,
      refresh_url: `${appDeepLinkScheme}://payout-details?onboarding=refresh`,
    });

    return { url: accountLink.url };
  }

  async createDashboardLoginLink(userId: string): Promise<{ url: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeConnectAccountId: true } });
    if (!user?.stripeConnectAccountId) {
      throw new Error('Payouts have not been set up yet');
    }

    const stripe = requireStripeClient();
    const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
    return { url: loginLink.url };
  }

  async getConnectStatus(userId: string): Promise<{
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
      },
    });
    if (!user) throw new Error('User not found');

    return {
      connected: Boolean(user.stripeConnectAccountId),
      chargesEnabled: user.stripeConnectChargesEnabled,
      payoutsEnabled: user.stripeConnectPayoutsEnabled,
      detailsSubmitted: user.stripeConnectDetailsSubmitted,
    };
  }

  async getBalanceForUser(userId: string): Promise<{ availableCents: number; pendingCents: number; currency: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeConnectAccountId: true } });
    if (!user?.stripeConnectAccountId) {
      throw new Error('Payouts have not been set up yet');
    }

    const stripe = requireStripeClient();
    const balance = await stripe.balance.retrieve({}, { stripeAccount: user.stripeConnectAccountId });
    const sum = (entries: { amount: number }[]) => entries.reduce((total, entry) => total + entry.amount, 0);

    return {
      availableCents: sum(balance.available),
      pendingCents: sum(balance.pending),
      currency: balance.available[0]?.currency || 'usd',
    };
  }

  async listPayouts(userId: string): Promise<Stripe.Payout[]> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeConnectAccountId: true } });
    if (!user?.stripeConnectAccountId) return [];

    const stripe = requireStripeClient();
    const payouts = await stripe.payouts.list({ limit: 20 }, { stripeAccount: user.stripeConnectAccountId });
    return payouts.data;
  }

  // --- Paid Hook booking checkout ---

  /**
   * Creates the MomentRequest (via the existing, unchanged booking validation
   * in UserService) and an authorization-only PaymentIntent for it. If the
   * Stripe leg fails after the MomentRequest was created, the MomentRequest is
   * deleted as a compensating action rather than left behind as a phantom
   * pending request — see plan notes on why this isn't one atomic transaction.
   */
  async createBookingCheckout(
    payerId: string,
    data: BookingCheckoutInput,
  ): Promise<{ momentRequestId: string; clientSecret: string; customerId: string; ephemeralKeySecret: string }> {
    const hook = await prisma.hook.findUnique({ where: { id: data.hookId } });
    if (!hook) {
      throw new Error('Hook not found');
    }
    if (!hook.isPaid || !hook.priceCents) {
      throw new Error('This hook is not a paid hook');
    }
    if (hook.ownerId !== data.receiverId) {
      throw new Error('Hook does not belong to the receiver');
    }

    const owner = await prisma.user.findUnique({
      where: { id: hook.ownerId },
      select: { id: true, stripeConnectAccountId: true, stripeConnectChargesEnabled: true },
    });
    if (!owner?.stripeConnectAccountId || !owner.stripeConnectChargesEnabled) {
      throw new Error("This host hasn't finished payout setup yet, so this hook can't be booked right now");
    }

    // All input validation is done — only require Stripe to be configured
    // once we're actually about to call it.
    const stripe = requireStripeClient();
    const customerId = await this.ensureCustomer(payerId);

    const userService = new UserService();
    const momentRequest = await userService.createMomentRequest(payerId, data.receiverId, {
      startTime: data.startTime,
      endTime: data.endTime,
      title: data.title,
      notes: data.notes,
      meetingType: data.meetingType,
      locationType: data.locationType,
      locationLabel: data.locationLabel,
      locationAddress: data.locationAddress,
      locationLatitude: data.locationLatitude,
      locationLongitude: data.locationLongitude,
      hookId: data.hookId,
    });

    try {
      const applicationFeeCents = Math.round((hook.priceCents * stripePlatformFeeBps) / 10000);

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: MOBILE_API_VERSION },
      );

      const paymentIntent = await stripe.paymentIntents.create({
        amount: hook.priceCents,
        currency: hook.currency.toLowerCase(),
        customer: customerId,
        capture_method: 'manual',
        setup_future_usage: 'on_session',
        transfer_data: { destination: owner.stripeConnectAccountId },
        application_fee_amount: applicationFeeCents || undefined,
        metadata: {
          momentRequestId: momentRequest.id,
          hookId: hook.id,
          payerId,
          payeeId: owner.id,
        },
      });

      await prisma.payment.create({
        data: {
          momentRequestId: momentRequest.id,
          payerId,
          payeeId: owner.id,
          amountCents: hook.priceCents,
          applicationFeeCents,
          currency: hook.currency,
          status: 'requires_payment',
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      return {
        momentRequestId: momentRequest.id,
        clientSecret: paymentIntent.client_secret!,
        customerId,
        ephemeralKeySecret: ephemeralKey.secret!,
      };
    } catch (error) {
      await prisma.momentRequest.delete({ where: { id: momentRequest.id } }).catch((cleanupError) => {
        console.error(
          `[PaymentService] Failed to clean up orphaned MomentRequest ${momentRequest.id} after a Stripe error:`,
          cleanupError,
        );
      });
      throw error;
    }
  }

  /** Called from respondToMomentRequest when a host approves a paid booking. */
  async captureForApprovedRequest(momentRequestId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({ where: { momentRequestId } });
    if (!payment || payment.status === 'captured') {
      return; // free booking, or already captured (idempotent re-approval)
    }

    const stripe = requireStripeClient();
    try {
      const intent = await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'captured',
          capturedAt: new Date(),
          stripeChargeId: typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id,
        },
      });
    } catch (error) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failureReason: error instanceof Error ? error.message : 'Capture failed' },
      });
      throw new Error('Payment could not be captured, so the booking was not approved. The payer may need to try a different card.');
    }
  }

  /** Called from respondToMomentRequest when a host rejects a paid booking. */
  async cancelForRejectedRequest(momentRequestId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({ where: { momentRequestId } });
    if (!payment || payment.status === 'canceled' || payment.status === 'captured') {
      return;
    }

    const stripe = requireStripeClient();
    try {
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    } catch (error) {
      // Already canceled/succeeded on Stripe's side, or some other terminal state —
      // don't let this block the rejection itself.
      console.error(`[PaymentService] Failed to cancel PaymentIntent ${payment.stripePaymentIntentId}:`, error);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'canceled', canceledAt: new Date() },
    });
  }

  /**
   * Cron target (see MaintenanceScheduler): releases payment holds that were
   * never resolved by a human — either the payer abandoned checkout before a
   * card was even authorized, or the host never responded before the ~7-day
   * Stripe hold limit approaches.
   */
  async expireStalePayments(): Promise<void> {
    const abandonedCutoff = new Date(Date.now() - ABANDONED_CHECKOUT_TIMEOUT_MS);
    const staleHoldCutoff = new Date(Date.now() - STALE_AUTHORIZATION_TIMEOUT_MS);

    const abandoned = await prisma.payment.findMany({
      where: { status: 'requires_payment', createdAt: { lt: abandonedCutoff } },
    });
    const staleAuthorized = await prisma.payment.findMany({
      where: { status: 'authorized', createdAt: { lt: staleHoldCutoff } },
    });

    for (const payment of [...abandoned, ...staleAuthorized]) {
      try {
        await this.cancelForRejectedRequest(payment.momentRequestId);
        await prisma.momentRequest.updateMany({
          where: { id: payment.momentRequestId, status: 'pending' },
          data: { status: 'rejected' },
        });
      } catch (error) {
        console.error(`[PaymentService] expireStalePayments failed for payment ${payment.id}:`, error);
      }
    }
  }

  /**
   * Stripe redelivers webhook events, so every branch here must be safe to
   * apply more than once — all of them are (re-setting the same status is a
   * no-op in effect).
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id, status: 'requires_payment' },
          data: { status: 'authorized' },
        });
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: {
            status: 'captured',
            capturedAt: new Date(),
            stripeChargeId: typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id,
          },
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: { status: 'failed', failureReason: intent.last_payment_error?.message || 'Payment failed' },
        });
        const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
        if (payment) {
          await prisma.momentRequest.updateMany({
            where: { id: payment.momentRequestId, status: 'pending' },
            data: { status: 'rejected' },
          });
        }
        break;
      }
      case 'payment_intent.canceled': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: { status: 'canceled', canceledAt: new Date() },
        });
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await prisma.user.updateMany({
          where: { stripeConnectAccountId: account.id },
          data: {
            stripeConnectChargesEnabled: Boolean(account.charges_enabled),
            stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
            stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
          },
        });
        break;
      }
      default:
        break;
    }
  }
}
