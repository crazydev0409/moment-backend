import { EventBusFactory } from './EventBusFactory';
import { EventPublisher } from './EventPublisher';
import { ExpoNotificationHandler } from './handlers/ExpoNotificationHandler';
import { DatabaseEventHandler } from './handlers/DatabaseEventHandler';
import { EventType } from './types/Event';
import { EventBus } from './EventBus';

// Global instances
let eventSystem: {
  eventBus: EventBus;
  eventPublisher: EventPublisher;
} | null = null;

/**
 * Initialize the event system
 */
export async function initializeEventSystem(): Promise<{
  eventBus: EventBus;
  eventPublisher: EventPublisher;
}> {
  try {
    console.log('[EventSystem] Initializing event system...');
    
    // Create event bus based on configuration
    const eventBus = EventBusFactory.createFromEnvironment();
    await eventBus.connect();

    // Create event publisher
    const eventPublisher = new EventPublisher(eventBus);

    // Set up event handlers
    const expoHandler = new ExpoNotificationHandler();
    const dbHandler = new DatabaseEventHandler();

    // Subscribe Expo notification handler to relevant events
    await eventBus.subscribe(EventType.MOMENT_REQUEST_CREATED, expoHandler.handleEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_APPROVED, expoHandler.handleEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_REJECTED, expoHandler.handleEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_CANCELED, expoHandler.handleEvent);
    await eventBus.subscribe(EventType.MOMENT_REMINDER_DUE, expoHandler.handleEvent);
    await eventBus.subscribe(EventType.CONTACT_REGISTERED, expoHandler.handleEvent);

    // Removed DB-wide event storage; rely on broker retention (Kafka/EventHub)
    
    // Subscribe database handler to store user notifications
    await eventBus.subscribe(EventType.MOMENT_REQUEST_CREATED, dbHandler.handleNotificationEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_APPROVED, dbHandler.handleNotificationEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_REJECTED, dbHandler.handleNotificationEvent);
    await eventBus.subscribe(EventType.MOMENT_REQUEST_CANCELED, dbHandler.handleNotificationEvent);
    await eventBus.subscribe(EventType.MOMENT_REMINDER_DUE, dbHandler.handleNotificationEvent);
    await eventBus.subscribe(EventType.CONTACT_REGISTERED, dbHandler.handleNotificationEvent);

    console.log('[EventSystem] Event system initialized successfully');
    
    eventSystem = { eventBus, eventPublisher };
    return eventSystem;
  } catch (error) {
    console.error('[EventSystem] Failed to initialize event system:', error);
    throw error;
  }
}

/**
 * Get the current event system instance
 */
export function getEventSystem(): { eventBus: EventBus; eventPublisher: EventPublisher } {
  if (!eventSystem) {
    throw new Error('Event system not initialized. Call initializeEventSystem() first.');
  }
  return eventSystem;
}

/**
 * Shutdown the event system gracefully
 */
export async function shutdownEventSystem(): Promise<void> {
  if (eventSystem) {
    console.log('[EventSystem] Shutting down event system...');
    await eventSystem.eventBus.disconnect();
    eventSystem = null;
    console.log('[EventSystem] Event system shutdown complete');
  }
}

// Export types and classes for use throughout the application
export { EventPublisher } from './EventPublisher';
export type { EventType, BaseEvent } from './types/Event';
export type { EventBus } from './EventBus';
export { UserDeviceRepository, TokenStatus } from '../repositories/UserDeviceRepository';
