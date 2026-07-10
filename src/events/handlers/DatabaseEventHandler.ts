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
    const targetUserIds = this.extractTargetUserIds(event);
    if (targetUserIds.length === 0) return;

    await Promise.all(
      targetUserIds.map(async (targetUserId) => {
        const notification = this.mapEventToNotificationRecord(event, targetUserId);
        if (!notification) return;

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
      })
    );
  };

  private mapEventToNotificationRecord(event: BaseEvent, targetUserId: string): { title: string; body: string; data: any } | null {
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

      case 'moment.request.approved': {
        // Sent to both parties now — see extractTargetUserIds. Copy is
        // written from whichever side is actually reading it, same as
        // ExpoNotificationHandler's push copy for this event.
        const isReceiver = targetUserId === event.payload.receiverId;
        return {
          title: isReceiver ? 'Meeting Confirmed' : 'Moment Request Approved',
          body: isReceiver
            ? `Your meeting "${event.payload.title || 'meeting'}" is confirmed`
            : `Your moment request was approved`,
          data: {
            momentRequestId: event.payload.momentRequestId,
            momentId: event.payload.momentId
          }
        };
      }

      case 'moment.request.rejected': {
        const isReceiver = targetUserId === event.payload.receiverId;
        return {
          title: isReceiver ? 'Meeting Declined' : 'Moment Request Declined',
          body: isReceiver
            ? `You declined "${event.payload.title || 'the meeting'}"`
            : `Your moment request was declined`,
          data: {
            momentRequestId: event.payload.momentRequestId
          }
        };
      }

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

      case 'moment.updated':
        return {
          title: 'Meeting Updated',
          body: `"${event.payload.title}" has been updated`,
          data: {
            momentId: event.payload.momentId,
            userId: event.payload.userId,
            startTime: event.payload.startTime,
            endTime: event.payload.endTime
          }
        };

      case 'moment.deleted':
        return {
          title: 'Meeting Canceled',
          body: `"${event.payload.title}" has been canceled`,
          data: {
            momentId: event.payload.momentId,
            userId: event.payload.userId
          }
        };

      default:
        return null;
    }
  }

  private extractTargetUserIds(event: BaseEvent): string[] {
    switch (event.type) {
      case 'moment.request.created':
        return [event.payload.receiverId].filter((id): id is string => !!id);
      case 'moment.request.approved':
      case 'moment.request.rejected':
        // Both parties — same reasoning as ExpoNotificationHandler and the
        // socket routing in socket.ts.
        return [event.payload.senderId, event.payload.receiverId].filter((id): id is string => !!id);
      case 'contact.registered':
        return [event.payload.contactOwnerId].filter((id): id is string => !!id);
      case 'moment.reminder.due':
        return [event.payload.userId].filter((id): id is string => !!id);
      case 'moment.updated':
      case 'moment.deleted':
        return [event.payload.otherUserId || event.metadata.userId].filter((id): id is string => !!id);
      default:
        return [event.metadata.userId].filter((id): id is string => !!id);
    }
  }
}
