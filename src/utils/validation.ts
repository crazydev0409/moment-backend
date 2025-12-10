/**
 * Validates if a phone number is in E.164 format
 * @param phoneNumber The phone number to validate
 * @returns boolean indicating if the phone number is valid
 */
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  if (!phoneNumber) return false;

  // E.164 format validation:
  // 1. Must start with +
  // 2. Followed by 1-3 digits for country code
  // 3. Followed by 6-12 digits for the local number
  // Total length should be between 8 and 15 characters (including +)
  const phoneRegex = /^\+[1-9]\d{0,2}\d{6,12}$/;
  return phoneRegex.test(phoneNumber) && phoneNumber.length >= 8 && phoneNumber.length <= 15;
};
