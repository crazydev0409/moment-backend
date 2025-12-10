import { Prisma } from '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient {
    momentRequest: Prisma.MomentRequestDelegate<Prisma.RejectOnNotFound | Prisma.RejectPerOperation>;
    blockedContact: Prisma.BlockedContactDelegate<Prisma.RejectOnNotFound | Prisma.RejectPerOperation>;
    contact: Prisma.ContactDelegate<Prisma.RejectOnNotFound | Prisma.RejectPerOperation>;
  }
} 