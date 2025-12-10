import { validatePhoneNumber } from '../utils/validation';

describe('Validation Functions', () => {
  describe('validatePhoneNumber', () => {
    it('should accept valid E.164 phone numbers', () => {
      const validNumbers = ['+1234567890', '+44123456789', '+61412345678', '+8612345678901'];

      validNumbers.forEach((number) => {
        expect(validatePhoneNumber(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '1234567890', // missing +
        '+123', // too short
        'abc123', // non-numeric
        '+12345a67890', // contains letters
        '', // empty string
        '+', // only plus
        '++1234567890' // multiple plus signs
      ];

      invalidNumbers.forEach((number) => {
        expect(validatePhoneNumber(number)).toBe(false);
      });
    });
  });
});
