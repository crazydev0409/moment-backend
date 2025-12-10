# Configuration Guide

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Database Configuration
```env
DATABASE_URL="postgresql://username:password@localhost:5432/moment"
```

### JWT Configuration
```env
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-key"
```

### Twilio Configuration
```env
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_FROM_PHONE_NUMBER="your-twilio-phone-number"
```

### Event Bus Configuration
```env
# Choose adapter: memory (development) or kafka (production)
EVENT_BUS_ADAPTER="memory"
EVENT_RETRY_ATTEMPTS="3"
```

### Kafka Configuration (Production Only)
Only needed if `EVENT_BUS_ADAPTER=kafka`:

```env
KAFKA_CLIENT_ID="moment-app"
KAFKA_BROKERS="localhost:9092"
KAFKA_GROUP_ID="moment-consumers"
KAFKA_SSL="false"

# For SASL authentication (optional):
# KAFKA_SASL_MECHANISM="plain"
# KAFKA_SASL_USERNAME="your-username"
# KAFKA_SASL_PASSWORD="your-password"
```

### Expo Push Notifications
```env
EXPO_ACCESS_TOKEN="your-expo-access-token"
```

### Server Configuration
```env
PORT="3000"
NODE_ENV="development"
```

## Event Bus Adapters

### Memory Adapter (Development)
- No external dependencies
- Events processed in-memory
- Perfect for development and testing
- All events lost on server restart

### Kafka Adapter (Production)
- Reliable event streaming
- Horizontal scaling support
- Persistent event storage
- Fault tolerance

## Push Notification Setup

### Expo Setup
1. Create an Expo account at [expo.dev](https://expo.dev)
2. Generate an access token in your Expo dashboard
3. Add the token to your `.env` file as `EXPO_ACCESS_TOKEN`

### Client Integration
Your React Native app should:
1. Register for push notifications on app start
2. Send the Expo push token to `/api/devices/register`
3. Update token periodically via `/api/devices/activity`

## Database Migration

After updating the schema, run:
```bash
npx prisma migrate dev
npx prisma generate
```

## Development vs Production

### Development Setup
```env
EVENT_BUS_ADAPTER="memory"
NODE_ENV="development"
```

### Production Setup
```env
EVENT_BUS_ADAPTER="kafka"
NODE_ENV="production"
KAFKA_BROKERS="your-kafka-brokers"
EXPO_ACCESS_TOKEN="your-production-expo-token"
```

## Testing

For testing, the event system automatically uses the in-memory adapter with helper methods for event verification.

## Monitoring

The server logs provide information about:
- Event publishing success/failure
- Push notification delivery status
- Background job execution
- Token validation results

Check logs for patterns like:
- `[EventSystem]` - Event bus operations
- `[MaintenanceScheduler]` - Background job execution
- `[ExpoNotificationHandler]` - Push notification delivery
- `[TokenValidation]` - Token health checks
