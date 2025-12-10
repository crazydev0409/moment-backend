# Moment Controller Architecture Guide

## Overview

The `momentController.ts` is the core controller of our **calendar-centric moment sharing application**. It manages "**moments**" (calendar events) within a sophisticated architecture where:

- Users own **calendars** (each user has a default calendar)
- **Moments** belong to calendars, not directly to users
- **Access control** is managed at the calendar level with three permission tiers
- **Visibility** can be granularly controlled per moment

## Architecture Principles

### Calendar-Centric Model
```
User → Calendar (default) → Moments
     ↓
   CalendarShare (access control)
```

### Security-First Design
- **Ownership verification** for all operations
- **Contact system integration** for sharing
- **Block list enforcement** for privacy
- **Granular access controls** with three permission levels

## Controller Functions

### 1. `createMoment` - Creating Calendar Events

```typescript
export const createMoment: CustomRequestHandler = async (req, res) => {
```

**Functionality:**
- Takes event details (`startTime`, `endTime`, `availability`, `notes`, etc.)
- **Auto-assigns to default calendar** if no `calendarId` specified
- **Validates** that the calendar belongs to the authenticated user
- **Validates shared users** through the contact system
- **Stores visibility list** (`visibleTo`) for granular sharing
- Uses **raw SQL queries** for performance with Prisma

**Key Validation:**
- Time validation (start < end)
- Calendar ownership verification
- Contact validation (can only share with your contacts)

**Example Request:**
```json
{
  "startTime": "2025-06-01T14:00:00Z",
  "endTime": "2025-06-01T15:00:00Z",
  "availability": "public",
  "notes": "Team meeting",
  "icon": "meeting",
  "allDay": false,
  "visibleTo": ["user-id-1", "user-id-2"]
}
```

### 2. `getMoments` - Get All User's Moments

```typescript
export const getMoments: CustomRequestHandler = async (req, res) => {
```

**Functionality:**
- Fetches **all moments from all user's calendars**
- **Joins** with Calendar table to include calendar metadata
- Returns moments with `calendarName` and `calendarOwnerId`
- **Ordered by start time** for chronological display

**SQL Pattern:**
```sql
SELECT m.*, c.name as "calendarName", c."userId" as "calendarOwnerId" 
FROM "Moment" m
JOIN "Calendar" c ON m."calendarId" = c.id
WHERE c."userId" = ${req.user!.id}
ORDER BY m."startTime" ASC
```

### 3. `getDefaultCalendar` & `getDefaultCalendarMoments` - MVP Calendar Access

These are **MVP-specific endpoints** for simplified frontend access:

```typescript
export const getDefaultCalendar: CustomRequestHandler = async (req, res) => {
export const getDefaultCalendarMoments: CustomRequestHandler = async (req, res) => {
```

**Purpose:**
- **Default calendar only**: Since MVP users have one calendar
- First function: Returns just calendar info
- Second function: Returns calendar + all its moments
- **Simplified access pattern** for frontend developers

**Frontend Usage:**
```javascript
// Get default calendar info only
const calendar = await fetch('/api/moments/default-calendar');

// Get default calendar with all moments
const calendarWithMoments = await fetch('/api/moments/default-calendar/moments');
```

### 4. `updateMoment` - Event Modification

```typescript
export const updateMoment: CustomRequestHandler = async (req, res) => {
```

**Functionality:**
- **Ownership verification**: Checks moment belongs to user's calendar
- **Dynamic SQL building**: Only updates provided fields
- **Time constraint validation**: Ensures start < end time
- **Parameterized queries**: Prevents SQL injection
- **Returns updated moment** with all changes

**Dynamic Update Pattern:**
```typescript
const updates: string[] = [];
const values: any[] = [];
let paramCount = 1;

if (startTime) {
  updates.push(`"startTime" = $${paramCount++}`);
  values.push(parsedStartTime);
}

const updateQuery = `
  UPDATE "Moment"
  SET ${updates.join(', ')}, "updatedAt" = NOW()
  WHERE id = $${paramCount++}
  RETURNING *
`;
```

### 5. `deleteMoment` - Event Removal

```typescript
export const deleteMoment: CustomRequestHandler = async (req, res) => {
```

**Functionality:**
- **Permission check**: Verifies moment belongs to user's calendar
- **Safe deletion**: Only deletes if ownership confirmed
- **Clean response**: Simple success message

### 6. `getUserCalendar` - Cross-User Calendar Viewing

```typescript
export const getUserCalendar: CustomRequestHandler = async (req, res) => {
```

**This is the most complex function** - handles viewing other users' calendars with **privacy controls**.

#### Access Level System

| Level | Description | What's Visible |
|-------|-------------|----------------|
| `no_access` | Calendar completely hidden | Nothing |
| `busy_time` | Shows time slots are occupied | Start/end times only |
| `view_book` | Full event details visible | All moment details |

#### Processing Flow

1. **Block Check**: Verifies users haven't blocked each other
2. **Calendar Access**: Gets calendars with proper access levels  
3. **Moment Filtering**: 
   - `view_book` level: Shows all details
   - `busy_time` level: Shows only timing (strips content)
   - `visibleTo` override: Shows details if specifically shared
4. **Returns Structured Data** with access level indicators

#### Privacy Filtering Logic

```typescript
if (calendar.effectiveAccessLevel === 'view_book' || isVisibleToViewer) {
  return moment; // Full details
} else {
  // For busy_time access, show only timing
  return {
    id: moment.id,
    calendarId: moment.calendarId,
    startTime: moment.startTime,
    endTime: moment.endTime,
    allDay: moment.allDay,
    availability: 'public', // Force to public so it's visible
    notes: null, // Hide content
    icon: null, // Hide icon
    visibleTo: [],
    createdAt: moment.createdAt,
    updatedAt: moment.updatedAt,
    _isBusyTime: true // Indicator for frontend
  };
}
```

### 7. `shareMoment` - Granular Sharing

```typescript
export const shareMoment: CustomRequestHandler = async (req, res) => {
```

**Functionality:**
- **Contact validation**: Only share with your contacts
- **Additive sharing**: Combines with existing `visibleTo` list
- **Moment-level sharing**: More granular than calendar-level
- **Updates the moment's visibility array**

**Sharing Logic:**
```typescript
// Get current visibleTo list and combine with new IDs
const currentVisibleTo = moment.visibleTo || [];
const combinedVisibleTo = [...new Set([...currentVisibleTo, ...validContactIds])];

// Update the moment
await prisma.$queryRaw`
  UPDATE "Moment"
  SET "visibleTo" = ${JSON.stringify(combinedVisibleTo)}::text[]
  WHERE id = ${parseInt(id)}
`;
```

## Security & Privacy Features

### 1. Ownership Verification

Every operation verifies the user owns the calendar containing the moment:

```sql
SELECT m.*
FROM "Moment" m
JOIN "Calendar" c ON m."calendarId" = c.id
WHERE m.id = ${momentId} AND c."userId" = ${req.user!.id}
```

### 2. Contact System Integration

Users can only share with their contacts:

```sql
SELECT "contactUserId" FROM "Contact"
WHERE "ownerId" = ${req.user!.id}
AND "contactUserId" IN (${Prisma.join(contactIds)})
```

### 3. Block List Enforcement

Blocked users cannot see each other's calendars:

```sql
SELECT id FROM "BlockedContact"
WHERE 
  ("blockerId" = ${userId} AND "blockedId" = ${viewerId})
  OR
  ("blockerId" = ${viewerId} AND "blockedId" = ${userId})
```

## Database Design Patterns

### Raw SQL Usage

The controller uses **raw SQL queries** instead of Prisma ORM methods for:

- **Performance**: Direct database queries without ORM overhead
- **Complex joins**: Calendar + Moment relationships with custom fields
- **Dynamic updates**: Building SQL queries on the fly
- **Precise control**: Exactly what data is fetched and returned

### Query Examples

#### Complex Join with Access Control
```sql
SELECT 
  c.id, 
  c.name, 
  c."defaultAccessLevel",
  COALESCE(cs."accessLevel", c."defaultAccessLevel") as "effectiveAccessLevel"
FROM "Calendar" c
LEFT JOIN "CalendarShare" cs ON c.id = cs."calendarId" AND cs."userId" = ${viewerId}
WHERE 
  c."userId" = ${userId}
  AND (
    cs."accessLevel" IS NOT NULL 
    OR c."defaultAccessLevel" != 'no_access'
  )
```

#### Dynamic Updates
```sql
UPDATE "Moment"
SET ${updates.join(', ')}, "updatedAt" = NOW()
WHERE id = $${paramCount++}
RETURNING *
```

## Frontend Integration Points

### For MVP (Current Implementation)

| Endpoint | Purpose | Usage |
|----------|---------|-------|
| `GET /api/moments/default-calendar` | Get calendar info | Calendar settings, metadata |
| `GET /api/moments/default-calendar/moments` | Get calendar + moments | Full calendar view |
| `GET /api/moments` | Get all moments with metadata | Timeline view, search |
| `POST /api/moments` | Create moment | Add events |
| `PUT /api/moments/:id` | Update moment | Edit events |
| `DELETE /api/moments/:id` | Delete moment | Remove events |
| `POST /api/moments/:id/share` | Share moment | Granular sharing |
| `GET /api/moments/user/:userId` | View other's calendar | Social features |

### For Future (Full Calendar CRUD)

- Multiple calendars per user
- Calendar creation/editing/deletion
- Advanced sharing workflows
- Calendar-specific settings

## Error Handling Strategy

Each function follows a consistent pattern:

1. **Input Validation** (required fields, formats)
2. **Authorization Checks** (ownership, permissions)
3. **Business Logic Validation** (time constraints, relationships)
4. **Database Operations** with error catching
5. **Structured Error Responses** with helpful messages

### Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | Operation completed |
| `400` | Bad Request | Invalid input data |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `500` | Server Error | Database/system error |

## Performance Considerations

### 1. Raw SQL for Performance
- Direct database queries bypass ORM overhead
- Optimized joins reduce round trips
- Parameterized queries prevent injection

### 2. Efficient Queries
- Indexed lookups on `userId`, `calendarId`
- Ordered results at database level
- Selective field fetching

### 3. Caching Opportunities
- User's default calendar info
- Contact lists for sharing validation
- Block lists for access control

## Future Enhancements

### 1. Full Calendar CRUD
- Multiple calendars per user
- Calendar creation/editing
- Calendar-specific permissions

### 2. Advanced Sharing
- Time-limited sharing
- Role-based permissions
- Sharing templates

### 3. Performance Optimizations
- Redis caching layer
- Background sync jobs
- Database query optimization

## Testing Strategy

The controller includes comprehensive error handling and validation, making it suitable for:

- **Unit tests**: Individual function logic
- **Integration tests**: Database interactions
- **Security tests**: Permission validation
- **Performance tests**: Query optimization

## Conclusion

The moment controller is designed to be **secure, performant, and privacy-focused** while providing a clean API for calendar and moment management. Its calendar-centric architecture enables sophisticated sharing and privacy controls while maintaining simplicity for MVP use cases.

The raw SQL approach provides performance benefits while the layered security ensures user privacy and data protection. The controller serves as the foundation for both current MVP functionality and future calendar management features. 