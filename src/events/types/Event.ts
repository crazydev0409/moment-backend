export interface BaseEvent {
  id: string;
  type: EventType;
  aggregateId: string; // userId, momentId, etc.
  aggregateType: AggregateType;
  version: number;
  timestamp: Date;
  payload: Record<string, any>;
  metadata: EventMetadata;
}

export interface EventMetadata {
  source: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  retryCount?: number;
  priority: EventPriority;
}

export enum EventType {
  // User Events
  USER_REGISTERED = 'user.registered',
  USER_VERIFIED = 'user.verified',
  USER_PROFILE_UPDATED = 'user.profile.updated',
  
  // Moment Events  
  MOMENT_CREATED = 'moment.created',
  MOMENT_UPDATED = 'moment.updated',
  MOMENT_DELETED = 'moment.deleted',
  MOMENT_SHARED = 'moment.shared',
  
  // Moment Request Events
  MOMENT_REQUEST_CREATED = 'moment.request.created',
  MOMENT_REQUEST_APPROVED = 'moment.request.approved',
  MOMENT_REQUEST_REJECTED = 'moment.request.rejected',
  MOMENT_REQUEST_CANCELED = 'moment.request.canceled',
  
  // Contact Events
  CONTACT_ADDED = 'contact.added',
  CONTACT_REGISTERED = 'contact.registered', // When contact joins app
  
  // Reminder Events
  MOMENT_REMINDER_DUE = 'moment.reminder.due'
}

export enum AggregateType {
  USER = 'user',
  MOMENT = 'moment', 
  CONTACT = 'contact',
  MOMENT_REQUEST = 'moment_request'
}

export enum EventPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10
}

// Specific event payload interfaces
export interface MomentCreatedPayload {
  momentId: string;
  userId: string;
  title?: string;
  startTime: Date;
  endTime: Date;
  availability: string;
}

export interface MomentRequestCreatedPayload {
  momentRequestId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  title: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
}

export interface ContactRegisteredPayload {
  contactUserId: string;
  contactOwnerId: string;
  contactName: string;
  phoneNumber: string;
}

export interface MomentReminderPayload {
  momentId: string;
  userId: string;
  title: string;
  startTime: Date;
  minutesBefore: number;
}


export type EventHandler = (event: BaseEvent) => Promise<void>;
