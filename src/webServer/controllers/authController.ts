import { RequestHandler as _RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import { jwtSecret, jwtRefreshSecret } from '../../config/config';
import { verifyPhoneNumber, checkVerification } from '../../services/twilio';
import { validatePhoneNumber } from '../../utils/validation';
import prisma from '../../services/prisma';
import crypto from 'crypto';
import { JwtPayload } from 'jsonwebtoken';
import { CustomRequestHandler } from '../../types/express';

// Helper function to hash tokens
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Register a new user and send verification code
 */
export const register: CustomRequestHandler = async (req, res) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)'
      });
    }
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { phoneNumber }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber,
          verified: false
        }
      });
    }

    generateAndReturnTokens(user, res);

  } catch (error) {
    console.error('Error in register endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateOtp: CustomRequestHandler = async (req, res) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)'
      });
    }

    const verification = await verifyPhoneNumber(phoneNumber);
    return res.json({
      message: 'OTP sent successfully',
      status: verification.status,
      expiresIn: 600
    });
  } catch (twilioError: any) {
    console.error('Twilio Error:', twilioError);

    // Handle specific Twilio errors
    if (twilioError.code === 60200) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    } else if (twilioError.code === 60203) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    } else if (twilioError.code === 60212) {
      return res.status(400).json({ error: 'Phone number blocked' });
    } else {
      return res.status(500).json({ error: 'Failed to send verification code. Please try again later.' });
    }
  }
}

/**
 * Verify a user's phone number with the provided code
 */
export const verify: CustomRequestHandler = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body as {
      phoneNumber?: string;
      code?: string;
    };

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }



    try {
      // Check verification code with Twilio Verify
      const verification = await checkVerification(phoneNumber, code);

      if (verification.status === 'approved') {
        return res.status(200).json({ message: 'Phone number verified successfully' });
      }
    } catch (twilioError: any) {
      console.error('Twilio Error:', twilioError);

      if (twilioError.code === 60200) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      } else if (twilioError.code === 60202) {
        return res.status(400).json({ error: 'Invalid verification code' });
      } else if (twilioError.code === 60203) {
        return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
      } else {
        return res.status(500).json({ error: 'Failed to verify code. Please try again later.' });
      }
    }
  } catch (error) {
    console.error('Error in verify endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to generate tokens and return them
async function generateAndReturnTokens(user: any, res: any): Promise<any> {
  // Generate access token
  const accessToken = jwt.sign({ id: user.id, phoneNumber: user.phoneNumber }, jwtSecret, { expiresIn: '10000d' });

  // Generate refresh token
  const refreshTokenId = crypto.randomUUID();
  const refreshToken = jwt.sign({ id: user.id, phoneNumber: user.phoneNumber, jti: refreshTokenId }, jwtRefreshSecret, {
    expiresIn: '30d',
    subject: user.id
  });

  // Store refresh token hash in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      token: hashToken(refreshToken),
      userId: user.id,
      expiresAt
    }
  });

  return res.json({
    message: 'Authentication successful',
    isVerifiedUser: user.verified,
    accessToken,
    refreshToken,
    expiresIn: '1 hour'
  });
}

/**
 * Refresh access token using refresh token
 */
export const refreshToken: CustomRequestHandler = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    try {
      const decoded = jwt.verify(token, jwtRefreshSecret) as JwtPayload & { jti: string };

      // Check if token exists in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: {
          id: decoded.jti
        },
        include: {
          user: true
        }
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new access token
      const accessToken = jwt.sign({ id: decoded.id, phoneNumber: decoded.phoneNumber }, jwtSecret, {
        expiresIn: '1h'
      });

      // SECURITY FIX: Generate new refresh token (Token Rotation)
      const newRefreshTokenId = crypto.randomUUID();
      const newRefreshToken = jwt.sign(
        { id: decoded.id, phoneNumber: decoded.phoneNumber, jti: newRefreshTokenId },
        jwtRefreshSecret,
        { expiresIn: '30d', subject: decoded.id }
      );

      // ATOMIC OPERATION: Replace old refresh token with new one
      await prisma.$transaction(async (tx) => {
        // Delete old token
        await tx.refreshToken.delete({ where: { id: decoded.jti } });

        // Create new token
        await tx.refreshToken.create({
          data: {
            id: newRefreshTokenId,
            token: hashToken(newRefreshToken),
            userId: storedToken.user.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          }
        });
      });

      return res.json({
        accessToken,
        refreshToken: newRefreshToken, // ✅ Return NEW refresh token
        expiresIn: '1 hour'
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  } catch (error) {
    console.error('Error in refresh token endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout user by revoking refresh token
 */
export const logout: CustomRequestHandler = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
      // Verify and decode the token to get the token ID (jti)
      const decoded = jwt.verify(token, jwtRefreshSecret) as JwtPayload & { jti: string };

      // Delete the token from the database
      await prisma.refreshToken
        .delete({
          where: {
            id: decoded.jti
          }
        })
        .catch(() => {
          // Ignore errors if token doesn't exist
        });

      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      // Even if token is invalid, we'll return success
      // since the end result is the same - user is logged out
      return res.json({ message: 'Logged out successfully' });
    }
  } catch (error) {
    console.error('Error in logout endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Error handler for auth routes
export const errorHandler = (err: any, req: any, res: any, _next: any): void => {
  console.error('Auth error:', err);
  res.status(500).json({ error: 'Authentication error' });
};
