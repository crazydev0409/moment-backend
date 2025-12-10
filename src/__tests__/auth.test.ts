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
  });

  it('should return 401 when no token is provided', () => {
    authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when token format is invalid', () => {
    mockRequest.headers = {
      authorization: 'Invalid Token'
    };

    authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid.token.here'
    };

    authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next() with valid token', () => {
    const validUser = { id: '123', phoneNumber: '+1234567890' };
    const token = jwt.sign(validUser, jwtSecret);
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };
    mockRequest.user = undefined;

    authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user).toEqual(expect.objectContaining(validUser));
  });

  it('should handle expired tokens', () => {
    const validUser = { id: '123', phoneNumber: '+1234567890' };
    const token = jwt.sign(validUser, jwtSecret, { expiresIn: '0s' });
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };

    authenticate(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
