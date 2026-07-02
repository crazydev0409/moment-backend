import Stripe from 'stripe';
import { stripeSecretKey } from '../../config/config';

// null (not a throwing constructor call) when unconfigured, matching the
// twilioClient / email transporter pattern elsewhere in this codebase — callers
// check for null and throw a clear "not configured" error at the call site.
//
// No apiVersion pinned here on purpose: the installed `stripe` SDK version
// defaults to the API version it was built against.
export const stripeClient: Stripe | null = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const requireStripeClient = (): Stripe => {
  if (!stripeClient) {
    throw new Error('Stripe is not configured');
  }
  return stripeClient;
};
