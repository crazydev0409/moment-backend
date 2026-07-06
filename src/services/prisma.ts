import { PrismaClient } from '@prisma/client';

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
}

// Create a singleton instance
const prismaService = PrismaService.getInstance();
const prisma = prismaService.getClient();

export default prisma;
