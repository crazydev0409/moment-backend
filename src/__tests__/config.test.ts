/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/explicit-function-return-type */
// Mock process.exit before any imports
const mockExit = jest.fn();
process.exit = mockExit as never;

// Mock dotenv config
const mockConfig = jest.fn();
jest.mock('dotenv', () => ({
  config: mockConfig
}));

// Mock environment variables
const mockEnv = {
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_AUTH_TOKEN: '00000000000000000000000000000000',
  TWILIO_VERIFY_SERVICE_SID: 'VA00000000000000000000000000000000',
  TWILIO_PHONE_NUMBER: '+1234567890',
  JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_chars',
  JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_at_least_32_chars',
  NODE_ENV: 'production' // Set to production to trigger validation
};

// Set up mock return value
mockConfig.mockReturnValue({ parsed: mockEnv });

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Set environment variables for this test
    process.env = { ...originalEnv, ...mockEnv };
    mockExit.mockClear();
    mockConfig.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load environment variables', () => {
    require('../config/config');
    expect(mockConfig).toHaveBeenCalled();
  });

  it('should have Twilio account SID', () => {
    const { twilioAccountSid } = require('../config/config');
    expect(twilioAccountSid).toBe(mockEnv.TWILIO_ACCOUNT_SID);
  });

  it('should have Twilio auth token', () => {
    const { twilioAuthToken } = require('../config/config');
    expect(twilioAuthToken).toBe(mockEnv.TWILIO_AUTH_TOKEN);
  });

  it('should have Twilio verify service SID', () => {
    const { twilioVerifyServiceSid } = require('../config/config');
    expect(twilioVerifyServiceSid).toBe(mockEnv.TWILIO_VERIFY_SERVICE_SID);
  });

  it('should have JWT secret', () => {
    const { jwtSecret } = require('../config/config');
    expect(jwtSecret).toBe(mockEnv.JWT_SECRET);
  });

  it('should determine development environment', () => {
    const { isDevelopment } = require('../config/config');
    expect(isDevelopment).toBe(false); // Since NODE_ENV is 'production'
  });

  describe('Error Handling', () => {
    // For these tests, we need to create a test function that will load the config
    // with modified environment variables and check if process.exit is called
    const testConfigValidation = (modifyEnv: () => void) => {
      // Clear the module cache to force a reload
      jest.resetModules();

      // Start with production environment
      process.env = { ...originalEnv, ...mockEnv };

      // Apply the environment modification
      modifyEnv();

      // Try to load the config module, which should trigger validation
      try {
        require('../config/config');
      } catch (e) {
        // Ignore any errors, we're just checking if process.exit was called
      }
    };

    it('should exit when Twilio account SID is missing', () => {
      testConfigValidation(() => {
        delete process.env.TWILIO_ACCOUNT_SID;
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when Twilio account SID format is invalid', () => {
      testConfigValidation(() => {
        process.env.TWILIO_ACCOUNT_SID = 'invalid';
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when Twilio auth token is missing', () => {
      testConfigValidation(() => {
        delete process.env.TWILIO_AUTH_TOKEN;
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when Twilio auth token length is invalid', () => {
      testConfigValidation(() => {
        process.env.TWILIO_AUTH_TOKEN = 'invalid';
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when Twilio verify service SID is missing', () => {
      testConfigValidation(() => {
        delete process.env.TWILIO_VERIFY_SERVICE_SID;
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when JWT secret is missing', () => {
      testConfigValidation(() => {
        delete process.env.JWT_SECRET;
      });
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
