# Multi-Recipient Moment Requests

This document explains the multi-recipient moment request feature that allows users to send meeting/appointment invitations to multiple users at once.

## Overview

The multi-recipient moment request feature extends the original one-to-one moment request functionality to allow a user to send the same moment request to multiple recipients simultaneously. This is useful for scheduling group meetings, team events, or any situation where the same time slot needs to be proposed to multiple people.

## API Endpoint

### Request Moments with Multiple Users

```
POST /api/moment-requests/multiple
```

**Authentication**: Bearer token required

**Request body:**
```json
{
  "receiverIds": [
    "87654321-4321-4321-4321-210987654321",
    "87654321-4321-4321-4321-210987654322",
    "87654321-4321-4321-4321-210987654323"
  ],
  "startTime": "2025-06-01T15:00:00Z",
  "endTime": "2025-06-01T16:00:00Z",
  "notes": "Team standup meeting - Let's sync up on our weekly progress and discuss any blockers"
}
```

**Response:**
```json
{
  "message": "Moment requests created successfully",
  "result": {
    "successful": 3,
    "failed": 0,
    "failedReceiverIds": []
  }
}
```

## How It Works

1. The sender submits a single request with an array of recipient user IDs
2. The backend creates individual moment requests for each recipient
3. Each recipient receives a real-time notification about the moment request
4. Recipients can individually approve or reject the request
5. When approved, the moment is automatically added to their calendar with appropriate visibility
6. The sender can track the status of each request separately

## Calendar Integration

When a moment request is approved:
- A new moment is created in the receiver's default calendar
- The moment is automatically shared with the requester (added to `visibleTo` array)
- The requester receives a notification of the approval
- Both parties can see the scheduled moment in their calendars

## Error Handling

The endpoint handles various scenarios gracefully:

1. **Invalid recipients**: If any recipient IDs are invalid, they will be included in the `failedReceiverIds` array
2. **Blocked users**: If the sender is blocked by any recipients, those requests will fail but others will succeed
3. **Self-invitations**: Requests to the sender's own ID are automatically skipped
4. **Validation errors**: If required fields are missing, a 400 error is returned
5. **Non-existent users**: Invalid user IDs result in failed requests but don't block successful ones

### Example Error Response

```json
{
  "message": "Moment requests created with some failures",
  "result": {
    "successful": 2,
    "failed": 1,
    "failedReceiverIds": ["invalid-user-id-123"]
  }
}
```

## Notifications

Recipients receive real-time notifications via WebSockets when a moment request is sent to them. The notification includes details about the sender, the proposed time, and any notes.

### WebSocket Event

```javascript
socket.on('moment:request', (request) => {
  // Handle new moment request
  console.log('New moment request received:', {
    id: request.id,
    senderId: request.senderId,
    senderName: request.sender?.name,
    startTime: request.startTime,
    endTime: request.endTime,
    notes: request.notes,
    status: request.status // Will be 'pending'
  });
});
```

### Responding to Requests

Each recipient can respond individually:

```
POST /api/moment-requests/{requestId}/respond
```

**Request body:**
```json
{
  "approved": true  // true to approve, false to reject
}
```

**Response for approval:**
```json
{
  "message": "Request approved successfully",
  "request": {
    "id": "req_abc123",
    "status": "approved",
    "momentId": 125  // ID of the created moment
  }
}
```

## Database Implementation

Each moment request is stored as a separate record in the `MomentRequest` table with:
- Unique ID per request
- Status tracking (pending, approved, rejected, rescheduled)
- Reference to created moment (if approved)
- Sender and receiver information

### Schema Reference

```sql
CREATE TABLE MomentRequest (
  id TEXT PRIMARY KEY,
  senderId TEXT NOT NULL,
  receiverId TEXT NOT NULL,
  startTime TIMESTAMP NOT NULL,
  endTime TIMESTAMP NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  momentId INTEGER, -- Foreign key to Moment if approved
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

## Frontend Implementation Example

```javascript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, FlatList } from 'react-native';
import axios from 'axios';

const SendGroupMomentRequest = () => {
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  
  const sendRequest = async () => {
    try {
      const token = await getAuthToken(); // Get from secure storage
      const receiverIds = selectedContacts.map(contact => contact.contactUserId);
      
      if (receiverIds.length === 0) {
        Alert.alert('Error', 'Please select at least one contact');
        return;
      }
      
      const response = await axios.post(
        'https://api.momentapp.com/api/moment-requests/multiple',
        {
          receiverIds,
          startTime,
          endTime,
          notes
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const { successful, failed, failedReceiverIds } = response.data.result;
      
      if (failed === 0) {
        Alert.alert(
          'Success!',
          `Moment request sent to ${successful} contacts!`
        );
      } else {
        Alert.alert(
          'Partially Successful',
          `Sent to ${successful} contacts. ${failed} requests failed.`
        );
        console.warn('Failed requests for users:', failedReceiverIds);
      }
      
      // Reset form
      setNotes('');
      setSelectedContacts([]);
      
    } catch (error) {
      console.error('Request failed:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.error || 'Failed to send request'
      );
    }
  };
  
  return (
    <View style={{ padding: 20 }}>
      {/* Time selection UI */}
      <DateTimePicker
        value={startTime}
        onChange={setStartTime}
        placeholder="Start time"
      />
      
      <DateTimePicker
        value={endTime}
        onChange={setEndTime}
        placeholder="End time"
      />
      
      {/* Notes input */}
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Meeting notes (optional)"
        multiline
        style={{ borderWidth: 1, padding: 10, marginVertical: 10 }}
      />
      
      {/* Contact selection */}
      <ContactPicker
        selectedContacts={selectedContacts}
        onSelectionChange={setSelectedContacts}
      />
      
      {/* Send button */}
      <Button 
        title={`Send Request to ${selectedContacts.length} contacts`}
        onPress={sendRequest}
        disabled={selectedContacts.length === 0}
      />
    </View>
  );
};

export default SendGroupMomentRequest;
```

## Real-time Updates

### Sender Experience

The sender can listen for response notifications:

```javascript
socket.on('moment:response', (response) => {
  console.log('Received response:', {
    requestId: response.requestId,
    recipientName: response.recipient?.name,
    approved: response.approved,
    momentId: response.momentId // If approved
  });
  
  // Update UI to show response status
  updateRequestStatus(response.requestId, response.approved);
});
```

### Recipient Experience

Recipients see incoming requests and can respond:

```javascript
socket.on('moment:request', (request) => {
  // Show notification or update requests list
  showNotification({
    title: `Meeting Request from ${request.sender?.name}`,
    body: `${formatTime(request.startTime)} - ${formatTime(request.endTime)}`,
    data: { requestId: request.id }
  });
});
```

## Technical Considerations

1. **Performance**: The implementation uses database transactions to ensure atomicity
2. **Concurrency**: Multiple simultaneous requests are handled safely with proper locking
3. **Scaling**: The notification system uses Redis queues to handle high volumes
4. **Data Consistency**: Failed individual requests don't affect successful ones

## Validation Rules

- Maximum 50 recipients per request (to prevent spam)
- Start time must be in the future
- End time must be after start time
- Notes field limited to 500 characters
- All recipient IDs must be valid UUIDs

## Future Enhancements

Planned enhancements for the multi-recipient feature include:

1. **Group Response Summary**: Show aggregated responses to the sender
2. **Alternative Time Suggestions**: Allow recipients to suggest different times
3. **Auto-scheduling**: Find optimal time based on all participants' calendars
4. **Recurring Group Meetings**: Support for recurring multi-recipient requests
5. **Group Chat Integration**: Create group chats for approved meetings
6. **Calendar Analytics**: Track meeting patterns and optimal times for groups 