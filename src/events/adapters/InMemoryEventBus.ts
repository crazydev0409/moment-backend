import { EventBus } from '../EventBus';
import { EventHandler } from '../types/Event';
import { BaseEvent, EventType } from '../types/Event';

export class InMemoryEventBus implements EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private patternHandlers: Map<string, EventHandler[]> = new Map();
  private events: BaseEvent[] = []; // For testing verification
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log('[InMemoryEventBus] Connected');
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
    this.patternHandlers.clear();
    this.events.length = 0;
    this.connected = false;
    console.log('[InMemoryEventBus] Disconnected');
  }

  async publish(event: BaseEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('EventBus not connected');
    }

    this.events.push(event); // Store for test verification
    
    // Call specific event handlers
    const handlers = this.handlers.get(event.type as EventType) || [];
    
    // Call pattern handlers
    for (const [pattern, patternHandlers] of this.patternHandlers.entries()) {
      if (this.matchesPattern(event.type, pattern)) {
        handlers.push(...patternHandlers);
      }
    }

    // Execute all handlers
    if (handlers.length > 0) {
      await Promise.all(handlers.map(handler => handler(event)));
    }
  }

  async publishBatch(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async subscribe(eventType: EventType, handler: EventHandler): Promise<void> {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    console.log(`[InMemoryEventBus] Subscribed to ${eventType}`);
  }

  async subscribeToPattern(pattern: string, handler: EventHandler): Promise<void> {
    if (!this.patternHandlers.has(pattern)) {
      this.patternHandlers.set(pattern, []);
    }
    this.patternHandlers.get(pattern)!.push(handler);
    console.log(`[InMemoryEventBus] Subscribed to pattern ${pattern}`);
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }

  // Testing helpers
  getPublishedEvents(): BaseEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  getEventsByType(eventType: EventType): BaseEvent[] {
    return this.events.filter(event => event.type === eventType);
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return eventType === pattern;
  }
}
