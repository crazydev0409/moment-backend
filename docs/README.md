# Moment - Moment Sharing App

Moment is a mobile application that allows users to connect seamlessly by sharing their calendar schedules, request "moments", and receive real-time notifications. The app uses a **calendar-centric model** where users own calendars, and moments belong to those calendars.

## Project Structure

```
moment/
├── src/                  # Source code
│   ├── config/           # Configuration files
│   ├── services/         # Business logic services
│   │   ├── notifications/  # Notification services (Redis + Bull)
│   │   ├── users/          # User-related services
│   │   └── prisma.ts       # Database client
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── webServer/        # Express.js web server
│       ├── auth/           # Authentication (JWT + Passport)
│       ├── controllers/    # API controllers
│       ├── routes/         # API route definitions
│       └── server.ts       # Server entry point
├── prisma/              # Prisma ORM
│   └── schema.prisma     # Database schema
├── __tests__/           # Test files
├── docs/                # Documentation
└── docker-compose.yml   # Docker configuration
```

## Tech Stack

- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching & Queues**: Redis + Bull for background jobs
- **Real-time**: Socket.IO for live notifications
- **Authentication**: JWT tokens with phone number verification (Twilio)
- **Containerization**: Docker + Docker Compose
- **Testing**: Jest with comprehensive test coverage
- **Frontend**: React Native (iOS & Android)

## Calendar-Centric Architecture

### Core Concepts

1. **Calendars**: Each user has one or more calendars (starts with a default "My Calendar")
2. **Moments**: Events belong to calendars, not directly to users
3. **Access Levels**: Three permission levels for calendar sharing
4. **Visibility**: Granular control over what information is shared

### Access Control System

- **No Access**: Calendar completely hidden from user
- **Busy Time Only**: Shows time slots are occupied, but no details (default)
- **View Details & Book**: Full event details visible + ability to request bookings

### Features

1. **Phone Authentication**: SMS-based registration and login via Twilio
2. **Contact Management**: Import and sync contacts from phone address book
3. **Calendar Management**: Create, share, and manage multiple calendars
4. **Moment Requests**: Request time slots from other users with approval workflow
5. **Multi-recipient Requests**: Send the same moment request to multiple users
6. **Real-time Notifications**: Instant notifications for calendar events and requests
7. **Working Hours**: Set calendar-specific working hours for availability
8. **Privacy Controls**: Block users, set visibility levels, control shared information

## Data Flow Architecture

### Request Flow
1. Client makes API requests to Express server
2. Authentication middleware validates JWT tokens
3. Express routes direct requests to appropriate controllers
4. Controllers delegate business logic to service layer
5. Services interact with database through Prisma ORM
6. Response data flows back through the same layers

### Notification Flow
1. Events trigger notifications in service layer
2. Notifications are queued in Redis using Bull
3. Background processors handle notifications asynchronously
4. Notifications are stored in database for persistence
5. WebSocket connections deliver real-time updates to online users
6. Offline users receive notifications when they reconnect

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- PostgreSQL (optional if using Docker)
- Redis (optional if using Docker)

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/moment.git
   cd moment
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration:
   # - DATABASE_URL for PostgreSQL
   # - JWT_SECRET (minimum 32 characters)
   # - Twilio credentials for SMS
   # - REDIS_URL for background jobs
   ```

4. Start services with Docker:
   ```bash
   docker-compose up -d postgres redis
   ```

5. Initialize database:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

### Docker Setup (Alternative)

1. Start all services:
   ```bash
   docker-compose up -d
   ```

2. Run database migrations:
   ```bash
   docker-compose exec app npx prisma migrate dev
   ```

3. View logs:
   ```bash
   docker-compose logs -f app
   ```

## API Documentation

### Interactive Documentation
- **Swagger UI**: Available at `/api-docs` when server is running
- **Comprehensive coverage**: All endpoints documented with examples

### Key Documentation Files
- **[Frontend Guide](./frontend-guide.md)**: Complete API reference for mobile developers
- **[Calendar Visibility System](./calendar_visibility_system.md)**: Detailed sharing and privacy controls
- **[Contacts API](./contacts-api.md)**: Contact import and management
- **[Multi-recipient Feature](./multi-recipient-feature.md)**: Group moment requests

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/momentRequest.test.ts

# Run tests in watch mode during development
npm test -- --watch
```

### Test Coverage
- **Unit Tests**: Service layer and utility functions
- **Integration Tests**: API endpoints and database operations
- **Mock Services**: Prisma, Twilio, and Redis for isolated testing
- **Current Status**: 56 tests passing across 8 test suites

## Current Status

### ✅ Completed Features
- Phone number authentication with SMS verification
- Calendar creation and management
- Moment creation, updating, and sharing
- Moment request workflow (create, approve, reject)
- Multi-recipient moment requests
- Contact import and synchronization
- Real-time notifications via WebSocket
- User blocking and privacy controls
- Working hours management
- Comprehensive test coverage
- Complete API documentation

### 🚧 Database Migration
- **Status**: ✅ **Complete** - Successfully migrated to calendar-centric model
- All users have default calendars
- Moments properly linked to calendars
- Access control system functional
- All tests passing

### 📋 Planned Features
- Calendar sync with external providers (Google, iCloud, Outlook)
- Multiple calendars per user
- Group calendars for teams
- Recurring events and advanced scheduling
- Calendar analytics and insights
- Advanced availability preferences

## Architecture Decisions

### Calendar-Centric Model Benefits
- **Intuitive**: Matches user mental model (like Google Calendar)
- **Scalable**: Foundation for multiple calendars per user
- **Secure**: Clear access control at calendar level
- **Flexible**: Supports various sharing scenarios

### Technology Choices
- **Prisma ORM**: Type-safe database access with excellent migration tools
- **Redis + Bull**: Reliable background job processing for notifications
- **Socket.IO**: Real-time bidirectional communication
- **JWT**: Stateless authentication with refresh token rotation
- **TypeScript**: Type safety and better developer experience

## Contributing

1. **Code Style**: Follow existing TypeScript conventions and ESLint rules
2. **Testing**: Write tests for new features, maintain coverage above 80%
3. **Documentation**: Update relevant `.md` files when adding features
4. **Database**: Use Prisma migrations for schema changes
5. **API**: Update Swagger documentation for new endpoints

### Development Workflow
1. Create feature branch from `main`
2. Implement feature with tests
3. Update documentation
4. Run full test suite: `npm test`
5. Submit pull request with detailed description

## License

This project is proprietary and confidential.

## Support

For questions or support, please contact the development team. 