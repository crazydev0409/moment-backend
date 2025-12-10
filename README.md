# Moment API

A RESTful API for the Moment calendar sharing application, built with Express, TypeScript, and PostgreSQL with Prisma ORM.

## Project Structure

```
moment/
├── prisma/                # Prisma ORM schema and migrations
├── src/
│   ├── config/            # Configuration files
│   ├── services/          # Service layer (Twilio, Prisma, notifications)
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── webServer/         # Express server
│       ├── auth/          # Authentication middleware (Passport.js)
│       ├── controllers/   # Request handlers
│       ├── routes/        # API routes
│       └── server.ts      # Main server entry point
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user with phone number
- `POST /api/auth/verify` - Verify phone number with OTP code
- `POST /api/auth/refresh` - Refresh access token using refresh token
- `POST /api/auth/logout` - Logout and revoke refresh token

### Calendars

- `GET /api/calendars` - Get all calendars for the authenticated user
- `POST /api/calendars` - Create a new calendar
- `PUT /api/calendars/:id` - Update calendar settings
- `DELETE /api/calendars/:id` - Delete a calendar (except default)

### Moments

- `POST /api/moments` - Create a new moment in user's default calendar
- `GET /api/moments` - Get all moments for the authenticated user
- `PUT /api/moments/:id` - Update a specific moment
- `DELETE /api/moments/:id` - Delete a specific moment
- `POST /api/moments/:id/share` - Share a moment with specific contacts

### Moment Requests

- `POST /api/moment-requests` - Create a moment request
- `POST /api/moment-requests/:id/respond` - Respond to a moment request (approve/reject)
- `POST /api/moment-requests/multiple` - Send moment request to multiple recipients

### Users & Contacts

- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/contacts` - Get all contacts
- `POST /api/contacts/import` - Import contacts from phone
- `POST /api/users/block` - Block a user
- `DELETE /api/users/unblock/:userId` - Unblock a user

### Health Check

- `GET /api/health` - Check API health and dependencies

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/moment?schema=public"
   JWT_SECRET="your_jwt_secret_minimum_32_characters"
   TWILIO_ACCOUNT_SID="your_twilio_account_sid"
   TWILIO_AUTH_TOKEN="your_twilio_auth_token"
   TWILIO_VERIFY_SERVICE_SID="your_twilio_verify_service_sid"
   REDIS_URL="redis://localhost:6379"
   ```

3. Start PostgreSQL and Redis:
   ```bash
   # Using Docker
   docker-compose up -d postgres redis
   ```

4. Initialize the database:
   ```
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. Start the development server:
   ```
   npm run dev
   ```

## Authentication Flow

1. User registers with phone number
2. Verification code is sent via Twilio
3. User verifies code
4. Server issues access token and refresh token
5. Access token is used for API requests
6. Refresh token is used to get new access tokens when they expire

## Calendar-Centric Architecture

### Core Concepts

- **Calendars**: Users have one or more calendars (each user gets a default calendar)
- **Moments**: Events belong to calendars rather than directly to users
- **Access Levels**: Three levels of calendar access (no_access, busy_time, view_book)
- **Visibility**: Moment-level granular sharing through `visibleTo` array

### Database Schema

#### User
- id (UUID)
- phoneNumber (String, unique)
- verified (Boolean)
- name, avatar, timezone, bio (optional fields)
- createdAt, updatedAt (DateTime)

#### Calendar
- id (String)
- userId (UUID, foreign key)
- name (String)
- color (String, optional)
- isDefault (Boolean)
- defaultAccessLevel (Enum: no_access, busy_time, view_book)
- createdAt, updatedAt (DateTime)

#### Moment
- id (Int, auto-increment)
- calendarId (String, foreign key)
- startTime, endTime (DateTime)
- availability (String: public, private)
- notes (String, optional)
- icon (String, optional)
- allDay (Boolean)
- visibleTo (String array: user IDs with detailed access)
- createdAt, updatedAt (DateTime)

#### CalendarShare
- id (String)
- calendarId (String, foreign key)
- userId (UUID, foreign key)
- accessLevel (Enum: no_access, busy_time, view_book)
- createdAt, updatedAt (DateTime)

#### CalendarWorkingHours
- id (String)
- calendarId (String, foreign key)
- dayOfWeek (Int: 0-6)
- startTime, endTime (String: HH:MM format)
- isActive (Boolean)

#### MomentRequest
- id (String)
- senderId, receiverId (UUID, foreign keys)
- startTime, endTime (DateTime)
- notes (String, optional)
- status (Enum: pending, approved, rejected, rescheduled)
- momentId (Int, optional foreign key)
- createdAt, updatedAt (DateTime)

#### RefreshToken
- id (UUID)
- token (String, unique)
- userId (UUID, foreign key)
- expiresAt (DateTime)
- createdAt (DateTime)

## Calendar Visibility System

The Moment app features a comprehensive calendar visibility system:

### Access Levels
- **No Access**: Calendar not visible to this person
- **Busy Time Only**: Contacts can see when you're busy but not event details (default)
- **View Details & Book**: Contacts can see full details and request to book time

### Sharing Features
- **Calendar-level sharing**: Set default access levels for entire calendars
- **Contact-specific permissions**: Override default access for individual contacts
- **Moment-level visibility**: Grant detailed access to specific moments via `visibleTo`
- **Contact blocking**: Prevent specific users from viewing any of your calendars

### Privacy Features
- Only contacts can view your calendars
- Blocked contacts have no access
- Granular control over what information is shared
- Automatic visibility for booked appointments

## Real-time Features

- **WebSocket connections**: Real-time notifications for moment requests and updates
- **Background job processing**: Redis + Bull for reliable notification delivery
- **Socket.IO integration**: Instant updates for calendar changes

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/momentRequest.test.ts
```

## API Documentation

- **Interactive Documentation**: Available at `/api-docs` when server is running
- **Comprehensive Guide**: See `docs/frontend-guide.md` for detailed API documentation
- **Calendar System**: See `docs/calendar_visibility_system.md` for visibility system details

For detailed documentation, see the [docs/](docs/) directory.

## Production Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Write tests for new features
3. Update documentation when adding new endpoints
4. Run `npm test` before submitting changes

## License

This project is proprietary and confidential.