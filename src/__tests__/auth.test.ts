import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/config';
import { JwtPayload } from '../types';

// Mock passport
jest.mock('passport', () => ({
  authenticate: jest.fn((strategy, options, callback) => {
    return (req: Request, _res: Response, _next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return callback(null, false);
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        return callback(null, decoded);
      } catch (error) {
        return callback(null, false);
      }
    };
  }),
  initialize: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next())
}));

const findUniqueMock = jest.fn();
jest.mock('../services/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

// Import after mocking
import { authenticate } from '../webServer/sso';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    (nextFunction as jest.Mock).mockClear();
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue({ deletedAt: null });
  });

  it('should return 401 when no token is provided', async () => {
    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Missing Authorization header'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when token format is invalid', async () => {
    mockRequest.headers = {
      authorization: 'Invalid Token'
    };

    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid auth scheme'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid.token.here'
    };

    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid or expired token'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next() with valid token', async () => {
    const validUser = { id: '123', phoneNumber: '+1234567890' };
    const token = jwt.sign(validUser, jwtSecret);
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };
    mockRequest.user = undefined;

    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user).toEqual(expect.objectContaining(validUser));
  });

  it('should handle expired tokens', async () => {
    const validUser = { id: '123', phoneNumber: '+1234567890' };
    const token = jwt.sign(validUser, jwtSecret, { expiresIn: '0s' });
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };

    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid or expired token'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when the account has been deleted', async () => {
    const validUser = { id: '123', phoneNumber: '+1234567890' };
    const token = jwt.sign(validUser, jwtSecret);
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };
    findUniqueMock.mockResolvedValue({ deletedAt: new Date() });

    await authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Account no longer exists'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
