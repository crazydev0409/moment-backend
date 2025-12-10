import { PrismaClient } from '@prisma/client';

/**
 * Creates a mock Prisma client for development/testing
 */
function _mockPrismaClient(): PrismaClient {
  // Return a minimal mock implementation of PrismaClient
  return new PrismaClient();
}

/**
 * Singleton PrismaClient implementation
 */
export class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
  }

  /**
   * Get the singleton instance of PrismaService
   */
  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  /**
   * Get the PrismaClient instance
   */
  public getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Connect to the database
   */
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
    } catch (error) {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.error('Failed to connect to the database:', error);
        // In development, log the error but continue
      } else {
        console.error('Database connection failed:', error);
        process.exit(1);
      }
    }
  }

  /**
   * Disconnect from the database
   */
  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Create a singleton instance
const prismaService = PrismaService.getInstance();
const prisma = prismaService.getClient();

// Add to global for reuse (if needed)
declare global {
  // eslint-disable-next-line no-var
  var prismaService: PrismaService;
}

// Register globally only in development to prevent memory leaks in production
if (process.env.NODE_ENV === 'development') {
  global.prismaService = prismaService;
}

export default prisma;
