import request from 'supertest';

// Set test environment before importing anything else
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests

// Mock Bull
jest.mock('bull', () => {
  // Create a mock Bull constructor
  const mockQueue = {
    process: jest.fn(),
    add: jest.fn().mockResolvedValue({}),
    on: jest.fn()
  };
  
  return jest.fn().mockImplementation(() => mockQueue);
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      connect: jest.fn(),
      quit: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      // Add any other Redis methods that might be used
    };
  });
});

// Import the app after all the mocks are set up
import { app } from '../webServer/server';
import { twilioVerifyServiceSid } from '../config/config';

// Mock the entire twilio service module
jest.mock('../services/twilio', () => {
  return {
    twilioClient: {
      verify: {
        v2: {
          services: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue({})
          })
        }
      }
    }
  };
});

// Import after mocking
import { twilioClient } from '../services/twilio';

describe('Health Check Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    const mockServices = twilioClient.verify.v2.services as unknown as jest.Mock;
    mockServices.mockReturnValue({
      fetch: jest.fn().mockResolvedValue({})
    });
  });

  it('should return 200 OK when all services are healthy', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'moment-api',
      dependencies: {
        twilio: {
          status: 'connected',
          error: null
        }
      }
    });

    // Check memory values
    expect(response.body.details.memory).toMatchObject({
      used: {
        unit: 'MB'
      },
      total: {
        unit: 'MB'
      }
    });
    expect(typeof response.body.details.memory.used.value).toBe('number');
    expect(typeof response.body.details.memory.total.value).toBe('number');
    expect(typeof response.body.details.memory.percentage).toBe('number');

    // Verify Twilio client was called correctly
    expect(twilioClient.verify.v2.services).toHaveBeenCalledWith(twilioVerifyServiceSid);
  });

  it('should return 503 when Twilio is not available', async () => {
    // Mock Twilio error
    const mockError = new Error('Twilio service unavailable');
    const mockServices = twilioClient.verify.v2.services as unknown as jest.Mock;
    mockServices.mockReturnValue({
      fetch: jest.fn().mockRejectedValue(mockError)
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'error',
      dependencies: {
        twilio: {
          status: 'disconnected',
          error: 'Twilio service unavailable'
        }
      }
    });

    // Verify Twilio client was called correctly
    expect(twilioClient.verify.v2.services).toHaveBeenCalledWith(twilioVerifyServiceSid);
  });
});
