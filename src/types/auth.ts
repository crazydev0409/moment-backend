import { JwtPayload as JwtPayloadBase } from 'jsonwebtoken';

export interface JwtPayload extends JwtPayloadBase {
  id: string;
  phoneNumber: string;
}

export interface User {
  id: string;
  otp: string;
  verified: boolean;
}

// Extend Express Request type
declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}
