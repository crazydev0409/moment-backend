import { bytesToMB } from '../utils/memory';

describe('Utility Functions', () => {
  describe('bytesToMB', () => {
    it('should correctly convert bytes to MB', () => {
      const bytes = 1024 * 1024; // 1MB in bytes
      expect(bytesToMB(bytes)).toBe(1.0);
    });

    it('should round to 2 decimal places', () => {
      const bytes = 1024 * 1024 * 1.23456; // ~1.23MB
      expect(bytesToMB(bytes)).toBe(1.23);
    });

    it('should handle zero bytes', () => {
      expect(bytesToMB(0)).toBe(0.0);
    });

    it('should handle large numbers', () => {
      const bytes = 1024 * 1024 * 1024; // 1GB in bytes
      expect(bytesToMB(bytes)).toBe(1024.0);
    });
  });
});
