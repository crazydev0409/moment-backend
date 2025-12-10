/**
 * Global type definitions for the Moment application
 */

import { PrismaClient } from '@prisma/client';
import { TwilioService } from '../services/twilio';
import { PrismaService } from '../services/prisma';
import { NotificationType, NotificationService } from '../services/notifications/notificationService';
import { NotificationProcessor } from '../services/notifications/notificationProcessor';

// Extend NodeJS namespace to include custom globals
declare global {
  // Global variables
  var prismaService: PrismaService;
  var twilioService: TwilioService;
  var notificationProcessor: NotificationProcessor;
  var notificationService: NotificationService;

  // Log levels
  type LogLevel = 'debug' | 'info' | 'warn' | 'error';
}

// Singleton pattern type definition
type Singleton<T> = {
  getInstance(): T;
};

// Extend Express Request
declare namespace Express {
  interface Request {
    startTime?: number;
    user?: import('./auth').JwtPayload;
  }
}

// Extend PrismaClient to include Notification model
declare module '@prisma/client' {
  interface PrismaClient {
    notification: {
      create: (args: { data: { 
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: any;
        isRead: boolean;
        isDelivered: boolean;
        createdAt: Date;
        updatedAt: Date;
        readAt?: Date | null;
        deliveredAt?: Date | null;
      } }) => Promise<any>;
      findMany: (args: any) => Promise<any[]>;
      count: (args: any) => Promise<number>;
      updateMany: (args: any) => Promise<{ count: number }>;
    }
  }
}
