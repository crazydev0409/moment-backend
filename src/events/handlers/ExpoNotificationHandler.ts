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
  private deviceRepo: UserDeviceRepository;

  constructor() {
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
    // Push notifications are currently disabled as we are not collecting Expo push tokens.
    // This handler stays in place for future re-implementation or alternative notification channels.
    return Promise.resolve();
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
