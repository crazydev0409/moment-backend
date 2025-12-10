import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { EventBus, KafkaEventBusConfig } from '../EventBus';
import { EventHandler } from '../types/Event';
import { BaseEvent, EventType } from '../types/Event';

export class KafkaEventBus implements EventBus {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private patternHandlers: Map<string, EventHandler[]> = new Map();
  private connected = false;

  constructor(private config: KafkaEventBusConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl as any, // Type assertion for complex SASL configuration
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      
      // Subscribe to all moment-related topics
      await this.consumer.subscribe({ topics: ['moment.user.created', 'moment.moment.created', 'moment.moment_request.created'] });
      
      // Start consuming
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this)
      });

      this.connected = true;
      console.log('[KafkaEventBus] Connected successfully');
    } catch (error) {
      console.error('[KafkaEventBus] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      await this.producer.disconnect();
      this.connected = false;
      console.log('[KafkaEventBus] Disconnected');
    } catch (error) {
      console.error('[KafkaEventBus] Disconnect error:', error);
    }
  }

  async publish(event: BaseEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('KafkaEventBus not connected');
    }

    const topic = this.getTopicForEvent(event);
    
    try {
      await this.producer.send({
        topic,
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.type,
            eventId: event.id,
            aggregateType: event.aggregateType,
            timestamp: event.timestamp.getTime().toString()
          }
        }]
      });
    } catch (error) {
      console.error('[KafkaEventBus] Publish failed:', error);
      throw error;
    }
  }

  async publishBatch(events: BaseEvent[]): Promise<void> {
    if (!this.connected) {
      throw new Error('KafkaEventBus not connected');
    }

    const topicMessages = new Map<string, any[]>();
    
    events.forEach(event => {
      const topic = this.getTopicForEvent(event);
      if (!topicMessages.has(topic)) {
        topicMessages.set(topic, []);
      }
      
      topicMessages.get(topic)!.push({
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.type,
          eventId: event.id,
          aggregateType: event.aggregateType,
          timestamp: event.timestamp.getTime().toString()
        }
      });
    });

    try {
      await this.producer.sendBatch({
        topicMessages: Array.from(topicMessages.entries()).map(([topic, messages]) => ({
          topic,
          messages
        }))
      });
    } catch (error) {
      console.error('[KafkaEventBus] Batch publish failed:', error);
      throw error;
    }
  }

  async subscribe(eventType: EventType, handler: EventHandler): Promise<void> {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    console.log(`[KafkaEventBus] Subscribed to ${eventType}`);
  }

  async subscribeToPattern(pattern: string, handler: EventHandler): Promise<void> {
    if (!this.patternHandlers.has(pattern)) {
      this.patternHandlers.set(pattern, []);
    }
    this.patternHandlers.get(pattern)!.push(handler);
    console.log(`[KafkaEventBus] Subscribed to pattern ${pattern}`);
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    try {
      const event: BaseEvent = JSON.parse(payload.message.value!.toString());
      const handlers = this.handlers.get(event.type as EventType) || [];
      
      // Add pattern handlers
      for (const [pattern, patternHandlers] of this.patternHandlers.entries()) {
        if (this.matchesPattern(event.type, pattern)) {
          handlers.push(...patternHandlers);
        }
      }
      
      if (handlers.length > 0) {
        await Promise.all(handlers.map(handler => handler(event)));
      }
    } catch (error) {
      console.error('[KafkaEventBus] Error handling message:', error);
      // Implement dead letter queue or retry logic here
    }
  }

  private getTopicForEvent(event: BaseEvent): string {
    // Topic naming strategy: moment.{aggregateType}.{eventCategory}
    const eventParts = event.type.split('.');
    const category = eventParts[eventParts.length - 1]; // e.g., 'created', 'updated'
    return `moment.${event.aggregateType}.${category}`;
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
