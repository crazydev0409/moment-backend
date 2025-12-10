import { BaseEvent, EventType, EventHandler } from './types/Event';

export type { EventHandler };

export interface EventBus {
  publish(event: BaseEvent): Promise<void>;
  publishBatch(events: BaseEvent[]): Promise<void>;
  subscribe(eventType: EventType, handler: EventHandler): Promise<void>;
  subscribeToPattern(pattern: string, handler: EventHandler): Promise<void>;
  
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export interface EventBusConfig {
  adapter: 'kafka' | 'memory' | 'bull-redis';
  kafka?: KafkaEventBusConfig;
  bullRedis?: BullRedisConfig;
}

export interface KafkaEventBusConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'aws' | 'oauthbearer';
    username: string;
    password: string;
  };
}

export interface BullRedisConfig {
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  redisDb?: number;
  defaultJobOptions?: {
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
    removeOnComplete?: boolean;
  };
}
