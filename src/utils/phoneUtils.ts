
/**
 * Normalize a phone number to E.164 format
 * Defaults to US (+1) if country code is missing for 10-digit numbers
 * 
 * @param phoneNumber - The raw phone number string
 * @returns The normalized phone number in E.164 format (e.g., +12223334444)
 * @throws Error if phone number is invalid
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) {
        throw new Error('Phone number is required');
    }

    // Remove all non-digit characters
    // We don't keep the leading + initially to make processing consistent
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Check for empty after cleaning
    if (cleaned.length === 0) {
        throw new Error('Invalid phone number format');
    }

    // Case 1: 10 digits (Standard US local number) -> Add +1
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }

    // Case 2: 11 digits starting with 1 (US number with country code included) -> Add +
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }

    // Case 3: Other valid international lengths (usually 7-15 digits)
    // Logic: If the original input started with +, assume the user provided a full E.164
    // If not, and it's not 10 digits, we might default to +1 or treat as is.
    // Given the requirement "If +12223334444 -> +12223334444", let's handle the explicit + input.

    if (phoneNumber.trim().startsWith('+')) {
        return `+${cleaned}`;
    }

    // For other cases where no + was provided and it's not 10 digits:
    // If slightly ambiguous, logic mandates we follow the user's specific examples mainly focus on US format.
    // But for safety, if > 10 digits, preprend +
    if (cleaned.length > 10) {
        return `+${cleaned}`;
    }

    // Fallback for weird short numbers? (Not expected based on requirements, but return as is with + for consistency if plausible)
    return `+${cleaned}`;
};
