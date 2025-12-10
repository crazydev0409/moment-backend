import * as cron from 'node-cron';
import { UserDeviceRepository } from '../repositories/UserDeviceRepository';
import { Expo } from 'expo-server-sdk';
import prisma from '../services/prisma';
import { getEventSystem } from '../events';

export class MaintenanceScheduler {
  private deviceRepo: UserDeviceRepository;
  private expo: Expo;
  private scheduledTasks: cron.ScheduledTask[] = [];

  constructor() {
    this.deviceRepo = new UserDeviceRepository();
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true
    });
  }

  /**
   * Start all maintenance jobs
   */
  start(): void {
    console.log('[MaintenanceScheduler] Starting maintenance jobs...');

    // Clean up stale tokens every 6 hours
    this.scheduledTasks.push(
      cron.schedule('0 */6 * * *', async () => {
        console.log('[MaintenanceScheduler] Running token cleanup job...');
        try {
          const cleanedCount = await this.deviceRepo.cleanupStaleTokens();
          console.log(`[MaintenanceScheduler] Cleaned up ${cleanedCount} stale tokens`);
        } catch (error) {
          console.error('[MaintenanceScheduler] Token cleanup failed:', error);
        }
      }, {
        name: 'token-cleanup',
        timezone: 'UTC'
      })
    );

    // Validate suspected invalid tokens every hour
    this.scheduledTasks.push(
      cron.schedule('0 * * * *', async () => {
        console.log('[MaintenanceScheduler] Running token validation job...');
        try {
          await this.validateSuspectedTokens();
        } catch (error) {
          console.error('[MaintenanceScheduler] Token validation failed:', error);
        }
      }, {
        name: 'token-validation',
        timezone: 'UTC'
      })
    );

    // Process scheduled events every minute
    this.scheduledTasks.push(
      cron.schedule('* * * * *', async () => {
        try {
          await this.processScheduledEvents();
        } catch (error) {
          console.error('[MaintenanceScheduler] Scheduled events processing failed:', error);
        }
      }, {
        name: 'scheduled-events',
        timezone: 'UTC'
      })
    );

    // Clean up old notifications every day at 2 AM
    this.scheduledTasks.push(
      cron.schedule('0 2 * * *', async () => {
        console.log('[MaintenanceScheduler] Running notification cleanup job...');
        try {
          await this.cleanupOldNotifications();
        } catch (error) {
          console.error('[MaintenanceScheduler] Notification cleanup failed:', error);
        }
      }, {
        name: 'notification-cleanup',
        timezone: 'UTC'
      })
    );

    // Clean up old event store entries every week
    this.scheduledTasks.push(
      cron.schedule('0 3 * * 0', async () => {
        console.log('[MaintenanceScheduler] Running event store cleanup job...');
        try {
          await this.cleanupOldEvents();
        } catch (error) {
          console.error('[MaintenanceScheduler] Event store cleanup failed:', error);
        }
      }, {
        name: 'event-store-cleanup',
        timezone: 'UTC'
      })
    );

    console.log(`[MaintenanceScheduler] Started ${this.scheduledTasks.length} maintenance jobs`);
  }

  /**
   * Stop all maintenance jobs
   */
  stop(): void {
    console.log('[MaintenanceScheduler] Stopping maintenance jobs...');
    
    this.scheduledTasks.forEach(task => {
      task.stop();
    });
    
    this.scheduledTasks = [];
    console.log('[MaintenanceScheduler] All maintenance jobs stopped');
  }

  /**
   * Validate suspected invalid tokens by sending test notifications
   */
  private async validateSuspectedTokens(): Promise<void> {
    const suspectedDevices = await this.deviceRepo.getSuspectedInvalidDevices();
    
    if (suspectedDevices.length === 0) {
      return;
    }

    console.log(`[TokenValidation] Validating ${suspectedDevices.length} suspected tokens...`);

    // Send silent notifications to test token validity
    const messages = suspectedDevices.map(device => ({
      to: device.expoPushToken,
      title: '', // Silent notification
      body: '',
      data: { type: 'token_validation' },
      sound: undefined,
      badge: undefined,
      priority: 'normal' as const,
      originalToken: device.expoPushToken
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      
      for (const chunk of chunks) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        
        tickets.forEach((ticket, index) => {
          const device = suspectedDevices[index];
          
          if (ticket.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') {
              this.deviceRepo.markTokenAsInvalid(device.expoPushToken, 'DeviceNotRegistered');
            } else {
              this.deviceRepo.incrementFailureCount(device.expoPushToken);
            }
          } else {
            // Token is working, mark as active
            this.deviceRepo.markTokenAsActive(device.id);
          }
        });
      }
      
      console.log(`[TokenValidation] Validated ${suspectedDevices.length} tokens`);
    } catch (error) {
      console.error('[TokenValidation] Validation failed:', error);
    }
  }

  /**
   * Process scheduled events that are due
   */
  private async processScheduledEvents(): Promise<void> {
    try {
      const dueEvents = await prisma.scheduledEvent.findMany({
        where: {
          scheduledFor: {
            lte: new Date()
          },
          status: 'pending',
          attempts: {
            lt: 3 // Max 3 attempts
          }
        },
        take: 50, // Process in batches
        orderBy: {
          scheduledFor: 'asc'
        }
      });

      if (dueEvents.length === 0) {
        return;
      }

      console.log(`[ScheduledEvents] Processing ${dueEvents.length} scheduled events...`);

      const { eventBus } = getEventSystem();

      for (const scheduledEvent of dueEvents) {
        try {
          const event = JSON.parse(scheduledEvent.eventData);
          
          // Publish the event
          await eventBus.publish(event);
          
          // Mark as fired
          await prisma.scheduledEvent.update({
            where: { id: scheduledEvent.id },
            data: { status: 'fired' }
          });
          
        } catch (error) {
          console.error(`[ScheduledEvents] Failed to process event ${scheduledEvent.id}:`, error);
          
          // Increment attempts
          await prisma.scheduledEvent.update({
            where: { id: scheduledEvent.id },
            data: { 
              attempts: { increment: 1 },
              status: scheduledEvent.attempts >= 2 ? 'failed' : 'pending'
            }
          });
        }
      }

    } catch (error) {
      console.error('[ScheduledEvents] Processing failed:', error);
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  private async cleanupOldNotifications(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`[NotificationCleanup] Deleted ${result.count} old notifications`);
  }

  /**
   * Clean up old event store entries (older than 90 days)
   */
  private async cleanupOldEvents(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await prisma.eventStore.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    console.log(`[EventStoreCleanup] Deleted ${result.count} old events`);
  }

  /**
   * Get status of all scheduled jobs
   */
  getJobStatus(): { name: string; running: boolean }[] {
    return this.scheduledTasks.map((task, index) => ({
      name: `maintenance-job-${index}`,
      running: (task as any).running || false
    }));
  }
}
