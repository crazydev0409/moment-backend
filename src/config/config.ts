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

// Only validate environment variables in production
if (!isDevelopment) {
  // Validate required environment variables
  if (!twilioAccountSid || twilioAccountSid.length !== 34 || !twilioAccountSid.startsWith('AC')) {
    console.error(
      `${ModuleName} Invalid or missing TWILIO_ACCOUNT_SID. It should be a 34-character string starting with 'AC'`
    );
    process.exit(1);
  }

  if (!twilioAuthToken || twilioAuthToken.length !== 32) {
    console.error(`${ModuleName} Invalid or missing TWILIO_AUTH_TOKEN. It should be a 32-character string`);
    process.exit(1);
  }

  if (!twilioPhoneNumber || !validateE164(twilioPhoneNumber)) {
    console.error(
      `${ModuleName} Invalid or missing TWILIO_PHONE_NUMBER. It should be in E.164 format (e.g., +1234567890)`
    );
    process.exit(1);
  }

  if (!twilioVerifyServiceSid || !twilioVerifyServiceSid.startsWith('VA')) {
    console.error(`${ModuleName} Invalid or missing TWILIO_VERIFY_SERVICE_SID. It should start with 'VA'`);
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(`${ModuleName} Invalid or missing JWT_SECRET. It should be at least 32 characters long`);
    process.exit(1);
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error(`${ModuleName} Invalid or missing JWT_REFRESH_SECRET. It should be at least 32 characters long`);
    process.exit(1);
  }
}
