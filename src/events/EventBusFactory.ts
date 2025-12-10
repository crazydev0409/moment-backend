import { EventBus, EventBusConfig } from './EventBus';
import { InMemoryEventBus } from './adapters/InMemoryEventBus';
import { KafkaEventBus } from './adapters/KafkaEventBus';

export type EventBackend = 'kafka' | 'memory' | 'bull-redis';

export class EventBusFactory {
  static create(config: EventBusConfig): EventBus {
    switch (config.adapter) {
      case 'kafka':
        if (!config.kafka) {
          throw new Error('Kafka configuration required for kafka adapter');
        }
        return new KafkaEventBus(config.kafka);
        
      case 'memory':
        return new InMemoryEventBus();
        
      case 'bull-redis':
        // TODO: Implement Bull/Redis adapter if needed for migration
        throw new Error('Bull/Redis adapter not implemented yet');
        
      default:
        throw new Error(`Unsupported event bus adapter: ${config.adapter}`);
    }
  }

  static createFromEnvironment(): EventBus {
    const adapter = (process.env.EVENT_BUS_ADAPTER || 'memory') as EventBackend;
    
    const config: EventBusConfig = {
      adapter,
      kafka: adapter === 'kafka' ? {
        clientId: process.env.KAFKA_CLIENT_ID || 'moment-app',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        groupId: process.env.KAFKA_GROUP_ID || 'moment-consumers',
        ssl: process.env.KAFKA_SSL === 'true',
        sasl: process.env.KAFKA_SASL_MECHANISM ? {
          mechanism: process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'aws' | 'oauthbearer',
          username: process.env.KAFKA_SASL_USERNAME!,
          password: process.env.KAFKA_SASL_PASSWORD!
        } : undefined
      } : undefined,
      bullRedis: adapter === 'bull-redis' ? {
        redisUrl: process.env.REDIS_URL,
        redisHost: process.env.REDIS_HOST,
        redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
        redisPassword: process.env.REDIS_PASSWORD,
        redisDb: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
        defaultJobOptions: {
          attempts: parseInt(process.env.EVENT_RETRY_ATTEMPTS || '3'),
          backoff: {
            type: 'exponential',
            delay: 1000
          },
          removeOnComplete: true
        }
      } : undefined
    };

    return this.create(config);
  }
}
