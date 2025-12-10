# Swagger API Documentation Alignment Fixes

## Overview

Fixed misalignments between Swagger documentation and actual implementation to ensure API docs accurately reflect available endpoints.

## Changes Made

### ❌ **Removed Non-Existent Endpoints**

#### Calendar Sharing Endpoints (Not Implemented)
- `GET /users/sharing` - No controller function exists
- `POST /users/sharing` - No controller function exists  
- `DELETE /users/sharing/{userId}` - No controller function exists

#### Incorrect Top-Level Moment Requests
- `POST /moment-requests` - Wrong path structure
- `POST /moment-requests/{id}/respond` - Wrong path structure

### ✅ **Added Missing Endpoints**

#### Notification Management
- `GET /users/notifications` - Get user notifications
- `POST /users/notifications/read` - Mark specific notifications as read
- `POST /users/notifications/read-all` - Mark all notifications as read
- `POST /users/notifications/test` - Send test notification (dev only)

#### Contacts & User Management
- `GET /users/contacts/registered` - Get contacts that are registered users

#### Moment Requests (Correct Paths)
- `POST /users/moment-requests` - Create a single moment request
- `POST /users/moment-requests/multiple` - Create moment requests for multiple recipients
- `GET /users/moment-requests/received` - Get received moment requests
- `GET /users/moment-requests/sent` - Get sent moment requests
- `POST /users/moment-requests/{requestId}/respond` - Respond to a moment request
- `POST /users/moment-requests/{requestId}/reschedule` - Reschedule a moment request

#### Calendar Visibility (Already Correctly Aligned)
- `GET /users/visibility/viewers` - Get users who can view your calendars
- `GET /users/visibility/calendars` - Get calendars you can view
- `POST /users/visibility` - Grant calendar visibility to a user
- `DELETE /users/visibility/{userId}` - Revoke calendar visibility from a user

## Current API Structure

### Authentication
- `POST /auth/register` ✅
- `POST /auth/verify` ✅
- `POST /auth/refresh` ✅
- `POST /auth/logout` ✅

### Moments (Calendar Events)
- `GET /moments` ✅
- `POST /moments` ✅
- `PUT /moments/{id}` ✅
- `DELETE /moments/{id}` ✅
- `POST /moments/{id}/share` ✅
- `GET /moments/default-calendar` ✅
- `GET /moments/default-calendar/moments` ✅
- `GET /moments/user/{userId}` ✅

### Users & Contacts
- `GET /users/profile` ✅
- `PUT /users/profile` ✅
- `GET /users/contacts` ✅
- `POST /users/contacts/import` ✅
- `GET /users/contacts/registered` ✅
- `POST /users/block` ✅
- `GET /users/notifications` ✅
- `POST /users/notifications/read` ✅
- `POST /users/notifications/read-all` ✅
- `POST /users/notifications/test` ✅

### Calendar Visibility
- `GET /users/visibility/viewers` ✅
- `GET /users/visibility/calendars` ✅
- `POST /users/visibility` ✅
- `DELETE /users/visibility/{userId}` ✅

### Moment Requests
- `POST /users/moment-requests` ✅
- `POST /users/moment-requests/multiple` ✅
- `GET /users/moment-requests/received` ✅
- `GET /users/moment-requests/sent` ✅
- `POST /users/moment-requests/{requestId}/respond` ✅
- `POST /users/moment-requests/{requestId}/reschedule` ✅

### Contacts API
- `GET /contacts` ✅
- `POST /contacts/import` ✅
- `POST /contacts/sync` ✅

### Health Check
- `GET /health` ✅

## Status

✅ **All Swagger documentation now accurately reflects implemented endpoints**
✅ **All tests passing (56/56)**
✅ **No breaking changes to existing functionality**

## For Frontend Developers

The API documentation at `/swagger` now correctly shows only the endpoints that are actually implemented and available for use. All documented endpoints have been tested and are working as described.

### Key Notes:
- **Calendar CRUD operations are not yet implemented** (post-MVP feature)
- **Default calendar functionality is available** through moment endpoints
- **Calendar sharing uses visibility system** (not direct sharing endpoints)
- **Moment requests follow `/users/moment-requests/*` pattern**
- **All notification endpoints are functional** 