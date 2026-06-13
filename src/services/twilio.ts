import twilio from 'twilio';
import { twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid } from '../config/config';

// Initialize Twilio client (null if credentials are not configured)
export const twilioClient = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

export const verifyPhoneNumber = async (phoneNumber: string): Promise<any> => {
  if (!twilioClient) throw new Error('Twilio is not configured');
  return twilioClient.verify.v2
    .services(twilioVerifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: 'sms' });
};

export const checkVerification = async (phoneNumber: string, code: string): Promise<any> => {
  if (!twilioClient) throw new Error('Twilio is not configured');
  return twilioClient.verify.v2.services(twilioVerifyServiceSid).verificationChecks.create({ to: phoneNumber, code });
};
