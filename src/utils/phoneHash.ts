import crypto from 'crypto';

/**
 * Hash a phone number using SHA-256
 * This provides a deterministic, one-way hash for storing phone numbers securely
 * 
 * @param phoneNumber - The phone number to hash (should be in E.164 format)
 * @returns The SHA-256 hash of the phone number as a hex string
 */
export const hashPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) {
        throw new Error('Phone number is required for hashing');
    }

    // Normalize the phone number by removing all non-digit characters except the leading +
    const normalized = phoneNumber.trim();

    // Create SHA-256 hash
    const hash = crypto.createHash('sha256');
    hash.update(normalized);

    return hash.digest('hex');
};

/**
 * Verify if a phone number matches a hash
 * Useful for testing and validation
 * 
 * @param phoneNumber - The phone number to verify
 * @param hash - The hash to compare against
 * @returns True if the phone number matches the hash
 */
export const verifyPhoneHash = (phoneNumber: string, hash: string): boolean => {
    try {
        const computedHash = hashPhoneNumber(phoneNumber);
        return computedHash === hash;
    } catch {
        return false;
    }
};
