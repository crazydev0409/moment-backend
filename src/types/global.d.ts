/**
 * Global type definitions for the Moment application
 */

// Extend Express Request
declare namespace Express {
  interface Request {
    user?: import('./auth').JwtPayload;
  }
}
