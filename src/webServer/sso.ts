import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

// Use the same secret you used in generateAndReturnTokens
const jwtSecret = process.env.JWT_SECRET as string;

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  }

  // Support both "Bearer <token>" and "JWT <token>"
  const [scheme, token] = authHeader.split(' ');

  if (!token || !/^Bearer$/i.test(scheme) && !/^JWT$/i.test(scheme)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid auth scheme' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // attach decoded payload to req.user
    req.user = decoded;

    return next();
  } catch (err) {
    console.error('JWT verify error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
