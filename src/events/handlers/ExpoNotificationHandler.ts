import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt, ExpoPushSuccessTicket } from 'expo-server-sdk';
import { EventHandler, BaseEvent } from '../types/Event';
import { UserDeviceRepository } from '../../repositories/UserDeviceRepository';
import { EventType } from '../types/Event';

interface PushNotification {
  title: string;
  body: string;
  data: Record<string, any>;
  imageUrl?: string;
}

export class ExpoNotificationHandler {
  private expo: Expo;
  private deviceRepo: UserDeviceRepository;

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true
    });
    this.deviceRepo = new UserDeviceRepository();
  }

  // Event handler for all notification-worthy events
  handleEvent: EventHandler = async (event: BaseEvent) => {
    const notification = this.mapEventToNotification(event);
    if (!notification) return;

    const targetUserId = this.extractTargetUserId(event);
    if (!targetUserId) return;

    await this.sendNotificationToUser(targetUserId, notification);
  };

  async sendNotificationToUser(userId: string, notification: PushNotification): Promise<void> {
    try {
      // Get healthy devices only
      const devices = await this.deviceRepo.getHealthyDevicesForUser(userId);
      const expoPushTokens = devices
        .map(d => d.expoPushToken)
        .filter(token => Expo.isExpoPushToken(token));

      if (expoPushTokens.length === 0) {
        console.log(`No healthy Expo push tokens for user ${userId}`);
        return;
      }

      // Get unread count once for all messages
      const unreadCount = await this.deviceRepo.getUnreadNotificationCount(userId);
      
      // Create messages with token tracking
      const messages: (ExpoPushMessage & { originalToken: string })[] = expoPushTokens.map(token => {
        const message: ExpoPushMessage & { originalToken: string } = {
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        priority: 'high',
        badge: unreadCount,
          originalToken: token, // Track which token this message is for
          // Enable background notification delivery on Android
          channelId: 'default', // Android channel for background notifications
        };
        
        // Add categoryId for interactive notifications (moment requests)
        if (notification.data?.categoryId) {
          message.categoryId = notification.data.categoryId;
        }
        
        return message;
      });

      // Send in chunks and track results
      const chunks = this.expo.chunkPushNotifications(messages);
      const ticketPromises: Promise<{ tickets: ExpoPushTicket[], tokens: string[] }>[] = [];

      for (const chunk of chunks) {
        const chunkTokens = chunk.map(msg => (msg as any).originalToken);
        
        ticketPromises.push(
          this.expo.sendPushNotificationsAsync(chunk).then(tickets => ({
            tickets,
            tokens: chunkTokens
          }))
        );
      }

      // Process all results
      const results = await Promise.allSettled(ticketPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          await this.processTickets(result.value.tickets, result.value.tokens);
        } else {
          console.error('Failed to send notification chunk:', result.reason);
        }
      }

      console.log(`Expo notification sent to ${devices.length} devices for user ${userId}`);

    } catch (error) {
      console.error('Failed to send Expo notification:', error);
      throw error;
    }
  }

  private async processTickets(tickets: ExpoPushTicket[], tokens: string[]): Promise<void> {
    const receiptIds: string[] = [];
    const invalidTokens: string[] = [];

    tickets.forEach((ticket, index) => {
      const token = tokens[index];
      
      if (ticket.status === 'error') {
        console.error(`Push ticket error for token ${token}:`, ticket.message);
        
        // Handle immediate errors
        if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(token);
        } else {
          // Increment failure count for other errors
          this.deviceRepo.incrementFailureCount(token);
        }
      } else {
        // Ticket succeeded, collect receipt ID for later verification
        receiptIds.push(ticket.id);
      }
    });

    // Mark immediately invalid tokens
    for (const token of invalidTokens) {
      await this.deviceRepo.markTokenAsInvalid(token, 'DeviceNotRegistered');
    }

    // Schedule receipt checking for successful tickets
    if (receiptIds.length > 0) {
      setTimeout(() => this.checkReceipts(receiptIds, tokens), 15 * 60 * 1000); // Check after 15 minutes
    }
  }

  private async checkReceipts(receiptIds: string[], originalTokens: string[]): Promise<void> {
    try {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(receiptIds);
      
      Object.entries(receipts).forEach(([receiptId, receipt]) => {
        if (receipt.status === 'error') {
          // Find the token that corresponds to this receipt
          const tokenIndex = receiptIds.indexOf(receiptId);
          const token = originalTokens[tokenIndex];
          
          if (token) {
            if (receipt.details?.error === 'DeviceNotRegistered') {
              this.deviceRepo.markTokenAsInvalid(token, 'DeviceNotRegistered');
            } else {
              this.deviceRepo.incrementFailureCount(token);
            }
          }
        }
        // If receipt.status === 'ok', the notification was delivered successfully
      });
      
    } catch (error) {
      console.error('Error checking push receipts:', error);
    }
  }

  private mapEventToNotification(event: BaseEvent): PushNotification | null {
    switch (event.type) {
      case EventType.MOMENT_REQUEST_CREATED:
        return {
          title: 'New Moment Request',
          body: `${event.payload.senderName} invited you to "${event.payload.title}"`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            senderName: event.payload.senderName,
            title: event.payload.title,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime,
            // Include action buttons for accept/reject
            categoryId: 'MOMENT_REQUEST',
            actions: [
              { action: 'accept', title: 'Accept', requestId: event.payload.momentRequestId },
              { action: 'reject', title: 'Reject', requestId: event.payload.momentRequestId }
            ]
          }
        };

      case EventType.MOMENT_REQUEST_APPROVED:
        return {
          title: 'Moment Request Approved',
          body: `${event.payload.receiverName} approved your moment request`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            momentId: event.payload.momentId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      case EventType.MOMENT_REQUEST_REJECTED:
        return {
          title: 'Moment Request Declined',
          body: `Your moment request was declined`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      case EventType.MOMENT_REQUEST_CANCELED:
        return {
          title: 'Meeting Canceled',
          body: `${event.payload.canceledByName} canceled the meeting`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      case EventType.MOMENT_REMINDER_DUE:
        return {
          title: 'Moment Reminder',
          body: `"${event.payload.title}" is starting in ${event.payload.minutesBefore} minutes`,
          data: {
            eventType: event.type,
            momentId: event.payload.momentId,
            startTime: event.payload.startTime
          }
        };

      case EventType.CONTACT_REGISTERED:
        return {
          title: 'Contact Joined Moment',
          body: `${event.payload.contactName} just joined Moment!`,
          data: {
            eventType: event.type,
            contactUserId: event.payload.contactUserId,
            contactName: event.payload.contactName
          }
        };

      case EventType.MOMENT_UPDATED:
        return {
          title: 'Meeting Updated',
          body: `"${event.payload.title}" has been updated`,
          data: {
            eventType: event.type,
            momentId: event.payload.momentId,
            momentRequestId: event.payload.momentRequestId,
            userId: event.payload.userId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      case EventType.MOMENT_DELETED:
        return {
          title: 'Meeting Canceled',
          body: `"${event.payload.title}" has been canceled`,
          data: {
            eventType: event.type,
            momentId: event.payload.momentId,
            momentRequestId: event.payload.momentRequestId,
            userId: event.payload.userId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      default:
        return null; // Not all events need notifications
    }
  }

  private extractTargetUserId(event: BaseEvent): string | null {
    // Extract the user who should receive the notification
    switch (event.type) {
      case EventType.MOMENT_REQUEST_CREATED:
        return event.payload.receiverId;
      case EventType.MOMENT_REQUEST_APPROVED:
      case EventType.MOMENT_REQUEST_REJECTED:
        return event.payload.senderId;
      case EventType.MOMENT_REQUEST_CANCELED:
        return event.payload.notifyUserId;
      case EventType.CONTACT_REGISTERED:
        return event.payload.contactOwnerId;
      case EventType.MOMENT_REMINDER_DUE:
        return event.payload.userId;
      case EventType.MOMENT_UPDATED:
      case EventType.MOMENT_DELETED:
        return event.payload.otherUserId || event.metadata.userId || null;
      default:
        return event.metadata.userId || null;
    }
  }
}
