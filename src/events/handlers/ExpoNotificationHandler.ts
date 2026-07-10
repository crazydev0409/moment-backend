import { EventHandler, BaseEvent } from '../types/Event';
import { UserDeviceRepository } from '../../repositories/UserDeviceRepository';
import { EventType } from '../types/Event';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

interface PushNotification {
  title: string;
  body: string;
  data: Record<string, any>;
  imageUrl?: string;
}

export class ExpoNotificationHandler {
  private deviceRepo: UserDeviceRepository;

  constructor() {
    this.deviceRepo = new UserDeviceRepository();
  }

  // Event handler for all notification-worthy events
  handleEvent: EventHandler = async (event: BaseEvent) => {
    const targetUserIds = this.extractTargetUserIds(event);
    if (targetUserIds.length === 0) return;

    await Promise.all(
      targetUserIds.map(async (userId) => {
        const notification = this.mapEventToNotification(event, userId);
        if (!notification) return;
        await this.sendNotificationToUser(userId, notification);
      })
    );
  };

  async sendNotificationToUser(userId: string, notification: PushNotification): Promise<void> {
    const devices = await this.deviceRepo.getActivePushTokensForUser(userId);
    if (devices.length === 0) return;

    const expo = new Expo();

    const messages: ExpoPushMessage[] = devices
      .filter(device => device.pushToken && Expo.isExpoPushToken(device.pushToken))
      .map(device => ({
        to: device.pushToken!,
        sound: 'default' as const,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: 'high' as const,        // Ensures delivery even in Doze mode on Android
        channelId: 'default',             // Must match the channel created in the app
        ...(notification.data.categoryId ? { categoryId: notification.data.categoryId as string } : {}),
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        receipts.forEach((receipt, i) => {
          if (receipt.status === 'error') {
            console.error(`Push notification error for token ${(chunk[i] as any).to}:`, receipt.message);
            if (receipt.details?.error === 'DeviceNotRegistered') {
              // Token is stale — mark device inactive so we stop sending to it
              const token = (chunk[i] as any).to as string;
              this.deviceRepo.deactivateDeviceByPushToken(token).catch(() => {});
            }
          }
        });
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
  }

  private mapEventToNotification(event: BaseEvent, targetUserId: string): PushNotification | null {
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

      case EventType.MOMENT_REQUEST_APPROVED: {
        // Sent to both parties now (see extractTargetUserIds) — the sender
        // always needs this, and the receiver does too whenever they didn't
        // take the approving action themselves (an auto-confirmed request:
        // the sender's own send triggered the approval, so this push is the
        // receiver's only signal a new confirmed meeting just landed).
        // Copy is written from whichever side is actually reading it.
        const isReceiver = targetUserId === event.payload.receiverId;
        return {
          title: isReceiver ? 'Meeting Confirmed' : 'Moment Request Approved',
          body: isReceiver
            ? `Your meeting "${event.payload.title || 'meeting'}" is confirmed`
            : `${event.payload.receiverName} approved your moment request`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            momentId: event.payload.momentId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };
      }

      case EventType.MOMENT_REQUEST_REJECTED: {
        const isReceiver = targetUserId === event.payload.receiverId;
        return {
          title: isReceiver ? 'Meeting Declined' : 'Moment Request Declined',
          body: isReceiver
            ? `You declined "${event.payload.title || 'the meeting'}"`
            : `Your moment request was declined`,
          data: {
            eventType: event.type,
            momentRequestId: event.payload.momentRequestId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };
      }

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

  private extractTargetUserIds(event: BaseEvent): string[] {
    // Extract the user(s) who should receive the notification
    switch (event.type) {
      case EventType.MOMENT_REQUEST_CREATED:
        // Only the receiver — the sender doesn't need a push about their
        // own action of sending the request.
        return [event.payload.receiverId].filter((id): id is string => !!id);
      case EventType.MOMENT_REQUEST_APPROVED:
      case EventType.MOMENT_REQUEST_REJECTED:
        // Both parties — same reasoning as the socket routing in socket.ts:
        // the sender always needs this, and the receiver does too whenever
        // the status changed without them directly acting (auto-confirm).
        return [event.payload.senderId, event.payload.receiverId].filter((id): id is string => !!id);
      case EventType.MOMENT_REQUEST_CANCELED:
        // Already computed as "whichever party didn't cancel" by the
        // caller (see cancelMomentRequest) — correctly one-directional.
        return [event.payload.notifyUserId].filter((id): id is string => !!id);
      case EventType.CONTACT_REGISTERED:
        return [event.payload.contactOwnerId].filter((id): id is string => !!id);
      case EventType.MOMENT_REMINDER_DUE:
        return [event.payload.userId].filter((id): id is string => !!id);
      case EventType.MOMENT_UPDATED:
      case EventType.MOMENT_DELETED:
        return [event.payload.otherUserId || event.metadata.userId].filter((id): id is string => !!id);
      default:
        return [event.metadata.userId].filter((id): id is string => !!id);
    }
  }
}
