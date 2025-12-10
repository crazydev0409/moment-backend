# Calendar Visibility System Documentation

## Overview

The Moment app implements a flexible calendar visibility system that balances privacy with usability. The system has been designed with the following principles:

1. Users control how their calendars appear to contacts
2. Fine-grained sharing is available through multiple access levels
3. Blocked contacts cannot view a user's calendars at all
4. Only contacts can view a user's calendars

## Calendar-Centric Model

The app uses a calendar-centric model where:
- Each user has one or more calendars
- Moments (events) belong to calendars
- Access control is primarily managed at the calendar level
- Specific moments can have additional visibility rules

## Access Levels

Each calendar has a `defaultAccessLevel` with three options:

- **No Access**: Calendar not visible to this person
- **Busy Time Only** (default): Contacts can see when you're busy but not event details
- **View Details & Book**: Contacts can see full details and request to book time

## Per-Contact Sharing

Users can set specific access levels for individual contacts:

- Each calendar has a `CalendarShare` table tracking who can access it
- Access level can be set per-contact, overriding the default
- This enables granular control for different groups of contacts

## Moment-Level Visibility

For specific moments, additional visibility can be set:

- Each moment has a `visibleTo` array containing user IDs that can see the full details
- When viewing a calendar, moments specifically shared with you will always show full details
- This enables exceptions for sensitive appointments

## Blocked Contacts

Users can block specific contacts:

- Blocked contacts cannot view any of the user's calendars
- The block relationship is bidirectional in the database
- Users can view and manage their blocked contacts list

## API Endpoints

### Calendar Management

- `GET /api/calendars` - Get user's calendars
- `POST /api/calendars` - Create a new calendar
- `GET /api/calendars/:id` - Get a specific calendar
- `PUT /api/calendars/:id` - Update calendar settings
- `DELETE /api/calendars/:id` - Delete a calendar (except default)

### Calendar Sharing

- `POST /api/calendars/:id/share` - Share a calendar with specific contacts
- `GET /api/users/visibility/viewers` - Get all users who can view your calendars
- `GET /api/users/visibility/calendars` - Get all calendars you can view

### Blocked Contacts

- `GET /api/users/blocked` - Get list of blocked contacts
- `POST /api/users/block` - Block a user
- `DELETE /api/users/unblock/:userId` - Unblock a user

### Moment Visibility

- `POST /api/moments/:id/share` - Add users to a moment's visibleTo list

## Database Schema

The system utilizes the following database structures:

1. **Calendar** model:
   - `defaultAccessLevel` field (default: "busy_time")
   - Relations to moments and sharing permissions

2. **Moment** model:
   - `calendarId` linking to parent calendar
   - `visibleTo` array for user IDs that can see details

3. **CalendarShare** model:
   - Links calendars to users who can access them
   - Includes access level for each share

4. **BlockedContact** model:
   - Tracks blocked relationships between users

## Automatic Visibility for Booked Moments

When a moment is created through the booking system:
- The moment is automatically added to the appropriate calendar
- The requester is automatically added to the moment's `visibleTo` list
- This ensures users can always see their booked appointments

## Future Extensions

The calendar-centric model enables:

- Multiple calendars per user (Work, Personal, etc.)
- Calendar groups for teams
- Public/subscribable calendars
- Advanced recurring events
- Calendar-specific working hours 