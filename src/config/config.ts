import * as dotenv from 'dotenv';

const ModuleName = '[config]';

// Load environment variables
dotenv.config();

// Check if we're in development mode
export const isDevelopment = process.env.NODE_ENV !== 'production';

// Validate phone number format
const validateE164 = (phoneNumber: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

// --- Twilio Setup ---
export const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
export const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
export const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
export const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

// --- JWT Secrets ---
export const jwtSecret = process.env.JWT_SECRET || 'development_jwt_secret_at_least_32_chars_long';
export const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'development_jwt_refresh_secret_at_least_32_chars';
export const calendarEncryptionSecret =
  process.env.CALENDAR_ENCRYPTION_SECRET || jwtSecret;
export const googleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
export const googleOauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
export const microsoftOauthClientId = process.env.MICROSOFT_OAUTH_CLIENT_ID || '';
export const microsoftOauthClientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '';
export const microsoftOauthTenantId = process.env.MICROSOFT_OAUTH_TENANT_ID || 'common';
export const appDeepLinkScheme = process.env.APP_DEEP_LINK_SCHEME || 'catch';

// --- SMTP (used for email verification, e.g. change-email flow) ---
export const smtpHost = process.env.SMTP_HOST || '';
export const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
export const smtpSecure = process.env.SMTP_SECURE === 'true';
export const smtpUser = process.env.SMTP_USER || '';
export const smtpPassword = process.env.SMTP_PASSWORD || '';
export const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;

// --- Stripe (payments for paid Hooks + Connect payouts) ---
export const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
// Platform cut on paid-Hook bookings, in basis points (1000 = 10%). Defaults to 0.
export const stripePlatformFeeBps = parseInt(process.env.STRIPE_PLATFORM_FEE_BPS || '0', 10);

// --- Demo / Review Account ---
// Used to let Google Play / App Store reviewers bypass phone OTP.
// Set DEMO_PHONE_NUMBER and DEMO_OTP_CODE in env; defaults target a non-dialable test number.
export const demoPhoneNumber = process.env.DEMO_PHONE_NUMBER || '+15005550006';
export const demoOtpCode = process.env.DEMO_OTP_CODE || '000000';

// Only validate environment variables in production
if (!isDevelopment) {
  // Validate required environment variables
  if (!twilioAccountSid || twilioAccountSid.length !== 34 || !twilioAccountSid.startsWith('AC')) {
    console.warn(
      `${ModuleName} Invalid or missing TWILIO_ACCOUNT_SID. It should be a 34-character string starting with 'AC'`
    );
  }

  if (!twilioAuthToken || twilioAuthToken.length !== 32) {
    console.warn(`${ModuleName} Invalid or missing TWILIO_AUTH_TOKEN. It should be a 32-character string`);
  }

  if (!twilioPhoneNumber || !validateE164(twilioPhoneNumber)) {
    console.warn(
      `${ModuleName} Invalid or missing TWILIO_PHONE_NUMBER. It should be in E.164 format (e.g., +1234567890)`
    );
  }

  if (!twilioVerifyServiceSid || !twilioVerifyServiceSid.startsWith('VA')) {
    console.warn(`${ModuleName} Invalid or missing TWILIO_VERIFY_SERVICE_SID. It should start with 'VA'`);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.warn(`${ModuleName} Invalid or missing JWT_SECRET. It should be at least 32 characters long`);
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    console.warn(`${ModuleName} Invalid or missing JWT_REFRESH_SECRET. It should be at least 32 characters long`);
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.warn(`${ModuleName} SMTP is not fully configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD). The change-email flow will fail until this is set.`);
  }

  if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
    console.warn(`${ModuleName} Invalid or missing STRIPE_SECRET_KEY. It should start with 'sk_'. Payments will fail until this is set.`);
  }

  if (!stripeWebhookSecret || !stripeWebhookSecret.startsWith('whsec_')) {
    console.warn(`${ModuleName} Invalid or missing STRIPE_WEBHOOK_SECRET. It should start with 'whsec_'. Payment status updates will not work until this is set.`);
  }

  if (!process.env.CALENDAR_ENCRYPTION_SECRET || process.env.CALENDAR_ENCRYPTION_SECRET.length < 32) {
    console.warn(`${ModuleName} Invalid or missing CALENDAR_ENCRYPTION_SECRET. It should be at least 32 characters long`);
  }
}
