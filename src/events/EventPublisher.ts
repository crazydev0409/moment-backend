import { EventBus } from './EventBus';
import { BaseEvent, EventType, EventPriority, AggregateType } from './types/Event';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../services/prisma';

export class EventPublisher {
  constructor(private eventBus: EventBus) {}

  async publishMomentCreated(momentId: string, userId: string, momentData: any): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_CREATED,
      aggregateId: momentId,
      aggregateType: AggregateType.MOMENT,
      version: 1,
      timestamp: new Date(),
      payload: {
        momentId,
        userId,
        title: momentData.notes || 'New Moment',
        startTime: momentData.startTime,
        endTime: momentData.endTime,
        availability: momentData.availability
      },
      metadata: {
        source: 'moment-service',
        userId,
        priority: EventPriority.NORMAL
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentUpdated(momentId: string | number, userId: string, momentData: any, otherUserId?: string, momentRequestId?: string): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_UPDATED,
      aggregateId: String(momentId),
      aggregateType: AggregateType.MOMENT,
      version: 1,
      timestamp: new Date(),
      payload: {
        momentId,
        userId,
        otherUserId, // The other user involved in the meeting (if from moment request)
        momentRequestId, // Include moment request ID for navigation
        title: momentData.notes || momentData.title || 'Meeting',
        startTime: momentData.startTime,
        endTime: momentData.endTime,
        availability: momentData.availability
      },
      metadata: {
        source: 'moment-service',
        userId: otherUserId || userId, // Notify the other user if exists
        priority: EventPriority.HIGH
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentDeleted(momentId: string | number, userId: string, momentData: any, otherUserId?: string, momentRequestId?: string): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_DELETED,
      aggregateId: String(momentId),
      aggregateType: AggregateType.MOMENT,
      version: 1,
      timestamp: new Date(),
      payload: {
        momentId,
        userId,
        otherUserId, // The other user involved in the meeting (if from moment request)
        momentRequestId, // Include moment request ID for navigation
        title: momentData.notes || momentData.title || 'Meeting',
        startTime: momentData.startTime,
        endTime: momentData.endTime
      },
      metadata: {
        source: 'moment-service',
        userId: otherUserId || userId, // Notify the other user if exists
        priority: EventPriority.HIGH
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentRequestCreated(
    requestId: string, 
    senderId: string, 
    receiverId: string, 
    requestData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_REQUEST_CREATED,
      aggregateId: requestId,
      aggregateType: AggregateType.MOMENT_REQUEST,
      version: 1,
      timestamp: new Date(),
      payload: {
        momentRequestId: requestId,
        senderId,
        receiverId,
        senderName: requestData.senderName,
        title: requestData.title,
        startTime: requestData.startTime,
        endTime: requestData.endTime,
        notes: requestData.notes
      },
      metadata: {
        source: 'moment-request-service',
        userId: senderId,
        priority: EventPriority.HIGH
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentRequestApproved(
    requestId: string,
    senderId: string,
    receiverId: string,
    momentId: number,
    requestData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_REQUEST_APPROVED,
      aggregateId: requestId,
      aggregateType: AggregateType.MOMENT_REQUEST,
      version: 2,
      timestamp: new Date(),
      payload: {
        momentRequestId: requestId,
        senderId,
        receiverId,
        receiverName: requestData.receiverName,
        momentId,
        title: requestData.title,
        startTime: requestData.startTime,
        endTime: requestData.endTime
      },
      metadata: {
        source: 'moment-request-service',
        userId: receiverId,
        priority: EventPriority.HIGH
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentRequestRejected(
    requestId: string,
    senderId: string,
    receiverId: string,
    requestData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_REQUEST_REJECTED,
      aggregateId: requestId,
      aggregateType: AggregateType.MOMENT_REQUEST,
      version: 2,
      timestamp: new Date(),
      payload: {
        momentRequestId: requestId,
        senderId,
        receiverId,
        receiverName: requestData.receiverName,
        title: requestData.title,
        startTime: requestData.startTime,
        endTime: requestData.endTime
      },
      metadata: {
        source: 'moment-request-service',
        userId: receiverId,
        priority: EventPriority.NORMAL
      }
    };

    await this.eventBus.publish(event);
  }

  async publishMomentCanceled(
    requestId: string,
    notifyUserId: string,
    canceledByUserId: string,
    requestData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_REQUEST_CANCELED,
      aggregateId: requestId,
      aggregateType: AggregateType.MOMENT_REQUEST,
      version: 1,
      timestamp: new Date(),
      payload: {
        momentRequestId: requestId,
        notifyUserId,
        canceledByUserId,
        canceledByName: requestData.canceledByName,
        title: requestData.title,
        startTime: requestData.startTime,
        endTime: requestData.endTime
      },
      metadata: {
        source: 'moment-request-service',
        userId: notifyUserId,
        priority: EventPriority.HIGH
      }
    };

    await this.eventBus.publish(event);
  }

  async publishContactRegistered(
    contactUserId: string, 
    contactOwnerId: string, 
    contactData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.CONTACT_REGISTERED,
      aggregateId: contactUserId,
      aggregateType: AggregateType.CONTACT,
      version: 1,
      timestamp: new Date(),
      payload: {
        contactUserId,
        contactOwnerId,
        contactName: contactData.name,
        phoneNumber: contactData.phoneNumber
      },
      metadata: {
        source: 'user-service',
        userId: contactOwnerId,
        priority: EventPriority.NORMAL
      }
    };

    await this.eventBus.publish(event);
  }


  async scheduleMomentReminder(
    momentId: string, 
    userId: string, 
    reminderTime: Date, 
    momentData: any
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.MOMENT_REMINDER_DUE,
      aggregateId: momentId,
      aggregateType: AggregateType.MOMENT,
      version: 1,
      timestamp: reminderTime, // When to fire
      payload: {
        momentId,
        userId,
        title: momentData.title || momentData.notes || 'Moment',
        startTime: momentData.startTime,
        minutesBefore: Math.round((new Date(momentData.startTime).getTime() - reminderTime.getTime()) / (1000 * 60))
      },
      metadata: {
        source: 'reminder-service',
        userId,
        priority: EventPriority.HIGH
      }
    };

    // For scheduled events, store in database for later processing
    await this.scheduleEvent(event, reminderTime);
  }

  private async scheduleEvent(event: BaseEvent, when: Date): Promise<void> {
    try {
      await prisma.scheduledEvent.create({
        data: {
          id: event.id,
          eventData: JSON.stringify(event),
          scheduledFor: when,
          status: 'pending',
          attempts: 0
        }
      });
      
      console.log(`Scheduled event ${event.id} for ${when.toISOString()}`);
    } catch (error) {
      console.error('Failed to schedule event:', error);
      throw error;
    }
  }

  // Method to publish multiple events in batch
  async publishBatch(events: BaseEvent[]): Promise<void> {
    await this.eventBus.publishBatch(events);
  }

  // Helper method for testing
  async publishTestEvent(userId: string, data: any): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: EventType.CONTACT_REGISTERED, // Use any event type for testing
      aggregateId: userId,
      aggregateType: AggregateType.USER,
      version: 1,
      timestamp: new Date(),
      payload: data,
      metadata: {
        source: 'test',
        userId,
        priority: EventPriority.LOW
      }
    };

    await this.eventBus.publish(event);
  }
}
