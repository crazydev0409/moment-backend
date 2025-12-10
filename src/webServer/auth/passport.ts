// auth/passport.js
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { jwtSecret, jwtRefreshSecret } from '../../config/config';
import { JwtPayload } from '../../types';
import prisma from '../../services/prisma';
import crypto from 'crypto';

// JWT Strategy for access tokens
const strategy = new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
  },
  async (jwtPayload: JwtPayload, done: (error: any, user?: false | JwtPayload) => void) => {
    try {
      // Find user in database with Prisma
      const user = await prisma.user.findUnique({
        where: { phoneNumber: jwtPayload.phoneNumber }
      });

      if (!user) {
        return done(null, false);
      }
      if (!user.verified) {
        return done(null, false);
      }
      return done(null, { id: user.id, phoneNumber: jwtPayload.phoneNumber });
    } catch (error) {
      return done(error, false);
    }
  }
);

passport.use(strategy);

// Helper function to hash tokens
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// JWT Strategy for refresh tokens
// This will be used once we implement the database
passport.use(
  'jwt-refresh',
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: jwtRefreshSecret
    },
    async (payload: any, done: any) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub }
        });

        if (!user) return done(null, false);

        // Verify that this refresh token is still in the DB
        const tokenHash = hashToken(payload.jti); // jti is the token ID
        const record = await prisma.refreshToken.findFirst({
          where: {
            token: tokenHash,
            userId: user.id,
            expiresAt: { gt: new Date() }
          }
        });

        if (!record) return done(null, false);

        done(null, user);
      } catch (error) {
        done(error, false);
      }
    }
  )
);

export default passport;
