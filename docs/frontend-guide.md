# Moment App Backend API Guide

Welcome to the Moment team! This guide will help you quickly understand our backend architecture and APIs so you can start building the React Native frontend.

## Overview

Moment is a **calendar sharing application** that uses a calendar-centric model where:
- Users own calendars (each user starts with a default calendar)
- Moments (events) belong to calendars, not directly to users
- Access control is managed at the calendar level with three permission tiers
- Users can request "moments" (meetings/appointments) with granular visibility controls

## Quick Setup

1. **Base URL**: All API requests go to `https://api.momentapp.com` (or `http://localhost:3000` for local development)
2. **Authentication**: All endpoints (except auth routes) require a JWT token in the `Authorization` header: `Bearer <token>`
3. **Content Type**: API accepts and returns JSON (`application/json`)
4. **Real-time**: WebSocket connection available for live notifications at same base URL

## Authentication Flow

### Register a User

```
POST /api/auth/register
```

**Request body:**
```json
{
  "phoneNumber": "+15555555555"  // E.164 format required
}
```

**Response:**
```json
{
  "message": "Verification code sent successfully",
  "status": "pending",
  "expiresIn": "10 minutes"
}
```

### Verify Phone Number

```
POST /api/auth/verify
```

**Request body:**
```json
{
  "phoneNumber": "+15555555555",
  "code": "123456"
}
```

**Response:**
```json
{
  "message": "Verification successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "expiresIn": "1 hour"
}
```

### Refresh Token

```
POST /api/auth/refresh
```

**Request body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "expiresIn": "1 hour"
}
```

### Logout

```
POST /api/auth/logout
```

**Request body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

## User Profile Management

### Get Current User Profile

```
GET /api/users/profile
```

**Response:**
```json
{
  "id": "12345678-1234-1234-1234-123456789012",
  "phoneNumber": "+15555555555",
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg",
  "timezone": "America/New_York",
  "bio": "Software developer",
  "verified": true,
  "createdAt": "2025-05-30T12:00:00Z",
  "updatedAt": "2025-05-30T12:00:00Z"
}
```

### Update User Profile

```
PUT /api/users/profile
```

**Request body:**
```json
{
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg",
  "timezone": "America/New_York",
  "bio": "Software developer"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    // Updated user object
  }
}
```

## Calendar Management

**Note**: Full calendar CRUD operations are not yet implemented. The following endpoints are available for MVP:

### Get User's Default Calendar

```
GET /api/moments/default-calendar
```

**Response:**
```json
{
  "calendar": {
    "id": "cal_abc123",
    "userId": "12345678-1234-1234-1234-123456789012",
    "name": "My Calendar",
    "color": "#4285f4",
    "isDefault": true,
    "defaultAccessLevel": "busy_time",
    "createdAt": "2025-05-30T12:00:00Z",
    "updatedAt": "2025-05-30T12:00:00Z"
  }
}
```

### Get Default Calendar with Moments

```
GET /api/moments/default-calendar/moments
```

**Response:**
```json
{
  "calendar": {
    "id": "cal_abc123",
    "userId": "12345678-1234-1234-1234-123456789012",
    "name": "My Calendar",
    "color": "#4285f4",
    "isDefault": true,
    "defaultAccessLevel": "busy_time",
    "createdAt": "2025-05-30T12:00:00Z",
    "updatedAt": "2025-05-30T12:00:00Z"
  },
  "moments": [
    {
      "id": 123,
      "calendarId": "cal_abc123",
      "calendarName": "My Calendar",
      "startTime": "2025-06-01T14:00:00Z",
      "endTime": "2025-06-01T15:00:00Z",
      "availability": "public",
      "notes": "Team meeting",
      "icon": "meeting",
      "allDay": false,
      "visibleTo": ["user-id-1", "user-id-2"],
      "createdAt": "2025-05-30T12:00:00Z",
      "updatedAt": "2025-05-30T12:00:00Z"
    }
  ]
}
```

### Calendar Sharing (Current Implementation)

These endpoints are available through the user routes:

#### Share Calendar with Another User

```
POST /api/users/sharing
```

**Request body:**
```json
{
  "userId": "87654321-4321-4321-4321-210987654321",
  "permission": "view"  // "view" or "edit"
}
```

**Response:**
```json
{
  "message": "Calendar shared successfully",
  "sharing": {
    "id": "share_123",
    "calendarId": "cal_abc123",
    "userId": "87654321-4321-4321-4321-210987654321",
    "accessLevel": "busy_time",
    "createdAt": "2025-05-30T12:00:00Z"
  }
}
```

#### Get Calendar Sharing Status

```
GET /api/users/sharing
```

**Response:**
```json
{
  "sharing": [
    {
      "id": "share_123",
      "calendarId": "cal_abc123",
      "userId": "87654321-4321-4321-4321-210987654321",
      "accessLevel": "view_book",
      "createdAt": "2025-05-30T12:00:00Z",
      "user": {
        "id": "87654321-4321-4321-4321-210987654321",
        "name": "Jane Smith",
        "phoneNumber": "+15555555556",
        "avatar": "https://example.com/avatar.jpg"
      }
    }
  ]
}
```

#### Revoke Calendar Sharing

```
DELETE /api/users/sharing/:userId
```

**Response:**
```json
{
  "message": "Calendar sharing revoked successfully"
}
```

### Calendar Visibility (Legacy Endpoints)

These are older endpoints that still work:

#### Grant Calendar Visibility

```
POST /api/users/visibility
```

**Request body:**
```json
{
  "userId": "87654321-4321-4321-4321-210987654321"
}
```

#### Get Who Can View Your Calendars

```
GET /api/users/visibility/viewers
```

#### Get Calendars You Can View

```
GET /api/users/visibility/calendars
```

#### Revoke Calendar Visibility

```
DELETE /api/users/visibility/:userId
```

## Practical Frontend Usage

### Getting User's Default Calendar

For MVP, every user has exactly one calendar (their default calendar). Here are the common patterns:

```javascript
// Get default calendar info only
const getDefaultCalendar = async () => {
  const response = await fetch('/api/moments/default-calendar', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.calendar; // { id, name, color, defaultAccessLevel, etc. }
};

// Get default calendar with all its moments
const getDefaultCalendarWithMoments = async () => {
  const response = await fetch('/api/moments/default-calendar/moments', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return {
    calendar: data.calendar,
    moments: data.moments
  };
};

// Alternative: Get all moments (includes calendar info)
const getAllMomentsWithCalendarInfo = async () => {
  const response = await fetch('/api/moments', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Each moment includes calendarName and calendarId
  // You can extract calendar info from the first moment
  const calendarInfo = data.moments.length > 0 ? {
    id: data.moments[0].calendarId,
    name: data.moments[0].calendarName
  } : null;
  
  return { moments: data.moments, calendarInfo };
};
```

### Creating Moments in Default Calendar

```javascript
// Create moment - automatically goes to default calendar
const createMoment = async (momentData) => {
  const response = await fetch('/api/moments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startTime: momentData.startTime,
      endTime: momentData.endTime,
      availability: momentData.availability,
      notes: momentData.notes,
      // calendarId is optional - will use default calendar if not provided
    })
  });
  
  return response.json();
};
```

## Moments (Events)

### Get All Moments

```
GET /api/moments
```

**Response:**
```json
{
  "moments": [
    {
      "id": 123,
      "calendarId": "cal_abc123",
      "startTime": "2025-06-01T14:00:00Z",
      "endTime": "2025-06-01T15:00:00Z",
      "availability": "public",
      "notes": "Team meeting",
      "icon": "meeting",
      "allDay": false,
      "visibleTo": ["user-id-1", "user-id-2"],
      "createdAt": "2025-05-30T12:00:00Z",
      "updatedAt": "2025-05-30T12:00:00Z"
    }
  ]
}
```

### Create a New Moment

```
POST /api/moments
```

**Request body:**
```json
{
  "startTime": "2025-06-01T14:00:00Z",
  "endTime": "2025-06-01T15:00:00Z",
  "availability": "public",  // public or private
  "notes": "Team meeting",
  "icon": "meeting",
  "allDay": false,
  "visibleTo": ["user-id-1", "user-id-2"]  // Users who can see details
}
```

**Response:**
```json
{
  "message": "Moment created successfully",
  "moment": {
    "id": 124,
    "calendarId": "cal_abc123",  // Automatically assigned to default calendar
    "startTime": "2025-06-01T14:00:00Z",
    "endTime": "2025-06-01T15:00:00Z",
    "availability": "public",
    "notes": "Team meeting",
    "icon": "meeting",
    "allDay": false,
    "visibleTo": ["user-id-1", "user-id-2"]
  }
}
```

### Update a Moment

```
PUT /api/moments/123
```

**Request body:**
```json
{
  "startTime": "2025-06-01T15:00:00Z",
  "endTime": "2025-06-01T16:00:00Z",
  "notes": "Updated team meeting"
}
```

### Delete a Moment

```
DELETE /api/moments/123
```

### Share a Moment with Specific Users

```
POST /api/moments/123/share
```

**Request body:**
```json
{
  "contactIds": ["user-id-3", "user-id-4"]
}
```

## Moment Requests

### Create a Moment Request

```
POST /api/moment-requests
```

**Request body:**
```json
{
  "receiverId": "87654321-4321-4321-4321-210987654321",
  "startTime": "2025-06-01T15:00:00Z",
  "endTime": "2025-06-01T16:00:00Z",
  "notes": "Would you like to have coffee?"
}
```

**Response:**
```json
{
  "message": "Moment request sent successfully",
  "request": {
    "id": "req_abc123",
    "senderId": "12345678-1234-1234-1234-123456789012",
    "receiverId": "87654321-4321-4321-4321-210987654321",
    "startTime": "2025-06-01T15:00:00Z",
    "endTime": "2025-06-01T16:00:00Z",
    "notes": "Would you like to have coffee?",
    "status": "pending",
    "createdAt": "2025-05-30T12:00:00Z"
  }
}
```

### Send Request to Multiple Recipients

```
POST /api/moment-requests/multiple
```

**Request body:**
```json
{
  "receiverIds": [
    "87654321-4321-4321-4321-210987654321",
    "87654321-4321-4321-4321-210987654322"
  ],
  "startTime": "2025-06-01T15:00:00Z",
  "endTime": "2025-06-01T16:00:00Z",
  "notes": "Team standup meeting"
}
```

**Response:**
```json
{
  "message": "Moment requests created successfully",
  "result": {
    "successful": 2,
    "failed": 0,
    "failedReceiverIds": []
  }
}
```

### Respond to a Moment Request

```
POST /api/moment-requests/req_abc123/respond
```

**Request body:**
```json
{
  "approved": true  // true to approve, false to reject
}
```

**Response:**
```json
{
  "message": "Request approved successfully",
  "request": {
    "id": "req_abc123",
    "status": "approved",
    "momentId": 125  // Created moment ID if approved
  }
}
```

## Contact Management

### Get All Contacts

```
GET /api/contacts
```

**Response:**
```json
{
  "contacts": [
    {
      "id": "contact-id-1",
      "ownerId": "12345678-1234-1234-1234-123456789012",
      "contactUserId": "user-id-1",
      "contactPhone": "+15555555556",
      "displayName": "Jane Smith",
      "phoneBookId": "phone-contact-1",
      "createdAt": "2025-05-30T12:00:00Z",
      "contactUser": {
        "id": "user-id-1",
        "name": "Jane Smith",
        "avatar": "https://example.com/avatar.jpg"
      }
    }
  ]
}
```

### Import Contacts from Phone

```
POST /api/contacts/import
```

**Request body:**
```json
{
  "contacts": [
    {
      "phoneNumber": "+15555555556",
      "displayName": "Jane Smith",
      "phoneBookId": "phone-contact-1"
    },
    {
      "phoneNumber": "+15555555557",
      "displayName": "Bob Johnson",
      "phoneBookId": "phone-contact-2"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Contacts imported successfully",
  "imported": 1,
  "updated": 1,
  "failed": 0
}
```

### Sync Contacts with Registered Users

```
POST /api/contacts/sync
```

**Response:**
```json
{
  "message": "Contacts synced successfully",
  "updatedCount": 2
}
```

## Privacy & Blocking

### Block a User

```
POST /api/users/block
```

**Request body:**
```json
{
  "userId": "87654321-4321-4321-4321-210987654321"
}
```

### Unblock a User

```
DELETE /api/users/unblock/87654321-4321-4321-4321-210987654321
```

### Get Blocked Users

```
GET /api/users/blocked
```

**Response:**
```json
{
  "blockedUsers": [
    {
      "id": "block-id-1",
      "blockerId": "12345678-1234-1234-1234-123456789012",
      "blockedId": "87654321-4321-4321-4321-210987654321",
      "createdAt": "2025-05-30T12:00:00Z",
      "blocked": {
        "id": "87654321-4321-4321-4321-210987654321",
        "name": "Blocked User",
        "phoneNumber": "+15555555558"
      }
    }
  ]
}
```

## Calendar Access Levels

### Understanding Access Levels

1. **No Access**: 
   - Calendar completely hidden
   - User cannot see any information

2. **Busy Time Only** (Default):
   - Shows time slots are occupied
   - No event details visible
   - Cannot see notes, title, or participants

3. **View Details & Book**:
   - Full event details visible
   - Can see notes, participants, etc.
   - Can request to book available time slots

### Viewing Another User's Calendar

```
GET /api/moments/user/87654321-4321-4321-4321-210987654321
```

**Response** (filtered based on your access level):
```json
{
  "userId": "87654321-4321-4321-4321-210987654321",
  "username": "Jane Smith",
  "moments": [
    {
      "id": 123,
      "startTime": "2025-06-01T14:00:00Z",
      "endTime": "2025-06-01T15:00:00Z",
      "availability": "public",
      // Notes and details only shown if you have "view_book" access
      // or if moment is in your visibleTo array
    }
  ]
}
```

## Working Hours

### Get Working Hours

```
GET /api/users/working-hours
```

**Response:**
```json
{
  "workingHours": [
    {
      "id": "wh_123",
      "calendarId": "cal_abc123",
      "dayOfWeek": 1,  // 0=Sunday, 1=Monday, etc.
      "startTime": "09:00",
      "endTime": "17:00",
      "isActive": true
    }
  ]
}
```

### Set Working Hours for a Day

```
PUT /api/users/working-hours/1
```

**Request body:**
```json
{
  "startTime": "09:00",
  "endTime": "17:00",
  "isActive": true
}
```

## WebSocket Events

Connect to the same base URL for real-time notifications:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Listen for moment requests
socket.on('moment:request', (request) => {
  console.log('New moment request:', request);
});

// Listen for request responses
socket.on('moment:response', (response) => {
  console.log('Request response:', response);
});

// Listen for calendar updates
socket.on('calendar:updated', (calendar) => {
  console.log('Calendar updated:', calendar);
});
```

## Error Handling

All API endpoints return consistent error formats:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Internal server error

## Rate Limiting

- Authentication endpoints: 5 requests per minute per IP
- General API endpoints: 100 requests per minute per user
- WebSocket connections: 1 per user

## Development Tips

1. **Phone Numbers**: Always use E.164 format (+1234567890)
2. **Timezones**: All timestamps are in UTC, handle timezone conversion on frontend
3. **Caching**: User profiles and contacts are good candidates for local caching
4. **Offline Support**: Consider storing moment requests locally when offline
5. **Real-time**: Always listen for WebSocket events to keep UI in sync

## Example Implementation

```javascript
// Example React Native service
class MomentApiService {
  constructor(baseUrl, tokenManager) {
    this.baseUrl = baseUrl;
    this.tokenManager = tokenManager;
  }

  async apiCall(endpoint, options = {}) {
    const token = await this.tokenManager.getToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (response.status === 401) {
      // Token expired, refresh and retry
      await this.tokenManager.refreshToken();
      return this.apiCall(endpoint, options);
    }

    return response.json();
  }

  // Create a moment request
  async createMomentRequest(receiverId, startTime, endTime, notes) {
    return this.apiCall('/api/moment-requests', {
      method: 'POST',
      body: JSON.stringify({
        receiverId,
        startTime,
        endTime,
        notes
      })
    });
  }

  // Get user's moments
  async getMoments() {
    return this.apiCall('/api/moments');
  }
}
```

For more details on specific features, see:
- [Calendar Visibility System](./calendar_visibility_system.md)
- [Multi-recipient Feature](./multi-recipient-feature.md)
- [Contacts API](./contacts-api.md) 