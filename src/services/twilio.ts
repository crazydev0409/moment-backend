import twilio from 'twilio';
import { twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid } from '../config/config';

// Initialize Twilio client
export const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// TODO: Fix return types with proper Twilio types
export const verifyPhoneNumber = async (phoneNumber: string): Promise<any> => {
  return twilioClient.verify.v2
    .services(twilioVerifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: 'sms' });
};

export const checkVerification = async (phoneNumber: string, code: string): Promise<any> => {
  return twilioClient.verify.v2.services(twilioVerifyServiceSid).verificationChecks.create({ to: phoneNumber, code });
};
