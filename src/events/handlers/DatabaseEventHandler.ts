import { EventHandler, BaseEvent } from '../types/Event';
import prisma from '../../services/prisma';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseEventHandler {
  // Handler for storing all events in the event store
  handleEvent: EventHandler = async (event: BaseEvent) => {
    try {
      await prisma.eventStore.create({
        data: {
          id: uuidv4(),
          eventType: event.type,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          version: event.version,
          eventData: JSON.stringify(event),
          metadata: event.metadata as any,
          timestamp: event.timestamp,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to store event in database:', error);
      // Don't throw - event storage failure shouldn't break the event flow
    }
  };

  // Handler for storing user notifications in the notification table
  handleNotificationEvent: EventHandler = async (event: BaseEvent) => {
    const notification = this.mapEventToNotificationRecord(event);
    if (!notification) return;

    const targetUserId = this.extractTargetUserId(event);
    if (!targetUserId) return;

    try {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          userId: targetUserId,
          type: event.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          isRead: false,
          isDelivered: true,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          deliveredAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to store notification in database:', error);
    }
  };

  private mapEventToNotificationRecord(event: BaseEvent): { title: string; body: string; data: any } | null {
    switch (event.type) {
      case 'moment.request.created':
        return {
          title: 'New Moment Request',
          body: `${event.payload.senderName} invited you to "${event.payload.title}"`,
          data: {
            momentRequestId: event.payload.momentRequestId,
            senderName: event.payload.senderName,
            title: event.payload.title
          }
        };

      case 'moment.request.approved':
        return {
          title: 'Moment Request Approved',
          body: `Your moment request was approved`,
          data: {
            momentRequestId: event.payload.momentRequestId,
            momentId: event.payload.momentId
          }
        };

      case 'moment.request.rejected':
        return {
          title: 'Moment Request Declined',
          body: `Your moment request was declined`,
          data: {
            momentRequestId: event.payload.momentRequestId
          }
        };

      case 'moment.reminder.due':
        return {
          title: 'Moment Reminder',
          body: `"${event.payload.title}" is starting soon`,
          data: {
            momentId: event.payload.momentId,
            startTime: event.payload.startTime
          }
        };

      case 'contact.registered':
        return {
          title: 'Contact Joined Moment',
          body: `${event.payload.contactName} just joined Moment!`,
          data: {
            contactUserId: event.payload.contactUserId,
            contactName: event.payload.contactName
          }
        };

      default:
        return null;
    }
  }

  private extractTargetUserId(event: BaseEvent): string | null {
    switch (event.type) {
      case 'moment.request.created':
        return event.payload.receiverId;
      case 'moment.request.approved':
      case 'moment.request.rejected':
        return event.payload.senderId;
      case 'contact.registered':
        return event.payload.contactOwnerId;
      case 'moment.reminder.due':
        return event.payload.userId;
      default:
        return event.metadata.userId || null;
    }
  }
}
