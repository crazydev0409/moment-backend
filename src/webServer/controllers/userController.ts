import { Request as _Request, Response as _Response } from 'express';
import { CustomRequestHandler } from '../../types/express';
import { UserService } from '../../services/users/userService';
import prisma from '../../services/prisma';
// Old notification service removed - now using event system

const userService = new UserService();

/**
 * Get the current user's profile
 */
export const getCurrentUser: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user without sensitive information
    return res.json({
      id: user.id,
      phoneNumber: user.phoneNumber,
      name: (user as any).name,
      avatar: (user as any).avatar,
      timezone: (user as any).timezone || 'UTC',
      bio: (user as any).bio,
      email: (user as any).email,
      birthday: (user as any).birthday,
      meetingTypes: (user as any).meetingTypes || [],
      verified: user.verified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
};

/**
 * Update the current user's profile
 */
export const updateProfile: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, avatar, timezone, bio, email, birthday, meetingTypes } = req.body;

    // Validate timezone if provided
    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (e) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }
    }

    // Parse birthday if provided
    let parsedBirthday: Date | undefined;
    if (birthday) {
      const b = new Date(birthday);
      if (isNaN(b.getTime())) {
        return res.status(400).json({ error: 'Invalid birthday date' });
      }
      parsedBirthday = b;
    }

    // Validate meetingTypes if provided
    if (meetingTypes !== undefined) {
      if (!Array.isArray(meetingTypes)) {
        return res.status(400).json({ error: 'meetingTypes must be an array' });
      }
      if (meetingTypes.length > 3) {
        return res.status(400).json({ error: 'You can select up to 3 meeting types' });
      }
      // Validate each meeting type is a string
      if (!meetingTypes.every(type => typeof type === 'string')) {
        return res.status(400).json({ error: 'All meeting types must be strings' });
      }
    }

    const updatedUser = await userService.updateUserProfile(userId, {
      name,
      avatar,
      timezone,
      bio,
      email,
      birthday: parsedBirthday,
      meetingTypes: meetingTypes ?? undefined
    });

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        phoneNumber: updatedUser.phoneNumber,
        name: (updatedUser as any).name,
        avatar: (updatedUser as any).avatar,
        timezone: (updatedUser as any).timezone || 'UTC',
        bio: (updatedUser as any).bio,
        email: (updatedUser as any).email,
        birthday: (updatedUser as any).birthday,
        meetingTypes: (updatedUser as any).meetingTypes || [],
        verified: updatedUser.verified,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};


/**
 * Get all contacts for the current user
 */
export const getContacts: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const contacts = await userService.getContacts(userId);

    return res.json({ contacts });
  } catch (error) {
    console.error('Error getting contacts:', error);
    return res.status(500).json({ error: 'Failed to get contacts' });
  }
};

/**
 * Add a new contact
 */
export const addContact: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { contactPhone, displayName } = req.body;

    // Validate phone number
    if (!contactPhone) {
      return res.status(400).json({ error: 'Contact phone number is required' });
    }

    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(contactPhone)) {
      return res.status(400).json({
        error: 'Phone number must be in E.164 format (e.g., +1234567890)'
      });
    }

    const contact = await userService.addContact(userId, contactPhone, displayName);

    return res.json({
      message: 'Contact added successfully',
      contact
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    return res.status(500).json({ error: 'Failed to add contact' });
  }
};

/**
 * Update a contact
 */
export const updateContact: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { displayName } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    try {
      const contact = await userService.updateContact(id, userId, { displayName });

      return res.json({
        message: 'Contact updated successfully',
        contact
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating contact:', error);
    return res.status(500).json({ error: 'Failed to update contact' });
  }
};

/**
 * Delete a contact
 */
export const deleteContact: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    try {
      await userService.deleteContact(id, userId);

      return res.json({
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
};

/**
 * Import contacts from mobile device address book
 */
export const importContacts: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { contacts } = req.body;

    // Validate contacts array
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        error: 'Valid contacts array is required'
      });
    }

    // Validate each contact has required fields
    for (const contact of contacts) {
      if (!contact.phoneNumber || !contact.displayName) {
        return res.status(400).json({
          error: 'Each contact must have phoneNumber and displayName'
        });
      }
    }

    const result = await userService.importContacts(userId, contacts);

    return res.json({
      message: 'Contacts imported successfully',
      ...result
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    return res.status(500).json({ error: 'Failed to import contacts' });
  }
};

/**
 * Sync contacts with registered users
 */
export const syncContacts: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const updatedCount = await userService.syncContacts(userId);

    return res.json({
      message: 'Contacts synced successfully',
      updatedCount
    });
  } catch (error) {
    console.error('Error syncing contacts:', error);
    return res.status(500).json({ error: 'Failed to sync contacts' });
  }
};


/**
 * Create a moment request to book time on someone's calendar
 */
export const createMomentRequest: CustomRequestHandler = async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, startTime, endTime, title, description, meetingType } = req.body;

    // Validate required fields
    if (!receiverId || !startTime || !endTime || !title) {
      return res.status(400).json({
        error: 'Receiver ID, start time, end time, and title are required'
      });
    }

    try {
      // Combine title and description into notes field
      const notes = description ? `${title}: ${description}` : title;

      const request = await userService.createMomentRequest(senderId, receiverId, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes,
        meetingType: meetingType || 'meet'
      });

      return res.json({
        message: 'Moment request created successfully',
        request
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating moment request:', error);
    return res.status(500).json({ error: 'Failed to create moment request' });
  }
};

/**
 * Get all moment requests received by the user
 */
export const getReceivedMomentRequests: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const requests = await userService.getReceivedMomentRequests(userId);

    return res.json({ requests });
  } catch (error) {
    console.error('Error getting received moment requests:', error);
    return res.status(500).json({ error: 'Failed to get received moment requests' });
  }
};

/**
 * Get pending moment requests received by the user (for notifications on app start)
 */
export const getPendingMomentRequests: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const requests = await userService.getPendingMomentRequests(userId);

    return res.json({ requests });
  } catch (error) {
    console.error('Error getting pending moment requests:', error);
    return res.status(500).json({ error: 'Failed to get pending moment requests' });
  }
};

/**
 * Get all moment requests sent by the user
 */
export const getSentMomentRequests: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const requests = await userService.getSentMomentRequests(userId);

    return res.json({ requests });
  } catch (error) {
    console.error('Error getting sent moment requests:', error);
    return res.status(500).json({ error: 'Failed to get sent moment requests' });
  }
};

/**
 * Get moment requests for a specific user (for viewing their availability)
 */
export const getUserMomentRequests: CustomRequestHandler = async (req, res) => {
  try {
    const requesterId = req.user!.id;
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get both received and sent requests for the target user
    const [receivedRequests, sentRequests] = await Promise.all([
      userService.getReceivedMomentRequests(userId),
      userService.getSentMomentRequests(userId),
    ]);

    // Only return approved/pending requests (not rejected)
    const allRequests = [...receivedRequests, ...sentRequests].filter(
      (request: any) => request.status === 'approved' || request.status === 'pending'
    );

    return res.json({ requests: allRequests });
  } catch (error) {
    console.error('Error getting user moment requests:', error);
    return res.status(500).json({ error: 'Failed to get user moment requests' });
  }
};

/**
 * Respond to a moment request (approve or reject)
 */
export const respondToMomentRequest: CustomRequestHandler = async (req, res) => {
  try {
    const receiverId = req.user!.id;
    const { requestId } = req.params;
    const { approved } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    if (approved === undefined) {
      return res.status(400).json({ error: 'Approval status is required' });
    }

    try {
      const request = await userService.respondToMomentRequest(requestId, receiverId, Boolean(approved));

      return res.json({
        message: approved ? 'Moment request approved and added to both calendars' : 'Moment request rejected',
        request
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error responding to moment request:', error);
    return res.status(500).json({ error: 'Failed to respond to moment request' });
  }
};

/**
 * Reschedule a moment request (suggest alternative time)
 */
export const rescheduleMomentRequest: CustomRequestHandler = async (req, res) => {
  try {
    const receiverId = req.user!.id;
    const { requestId } = req.params;
    const { startTime, endTime, note } = req.body;

    // Validate required fields
    if (!requestId || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Request ID, start time, and end time are required'
      });
    }

    try {
      const newRequest = await userService.rescheduleMomentRequest(requestId, receiverId, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        note
      });

      return res.json({
        message: 'Moment request rescheduled successfully',
        originalRequestId: requestId,
        newRequest
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error rescheduling moment request:', error);
    return res.status(500).json({ error: 'Failed to reschedule moment request' });
  }
};

/**
 * Cancel a moment request (both sender and receiver can cancel)
 */
export const cancelMomentRequest: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    try {
      await userService.cancelMomentRequest(requestId, userId);

      return res.json({
        message: 'Moment request canceled successfully'
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error canceling moment request:', error);
    return res.status(500).json({ error: 'Failed to cancel moment request' });
  }
};

/**
 * Block a user from viewing calendar
 */
export const blockUser: CustomRequestHandler = async (req, res) => {
  try {
    const blockerId = req.user!.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      await userService.blockUser(blockerId, userId);
      return res.json({ message: 'User blocked successfully' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error blocking user:', error);
    return res.status(500).json({ error: 'Failed to block user' });
  }
};

/**
 * Unblock a previously blocked user
 */
export const unblockUser: CustomRequestHandler = async (req, res) => {
  try {
    const blockerId = req.user!.id;
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      await userService.unblockUser(blockerId, userId);
      return res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        return res.status(404).json({ error: 'Block relationship not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error unblocking user:', error);
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
};

/**
 * Get list of blocked users
 */
export const getBlockedUsers: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const blockedUsers = await userService.getBlockedUsers(userId);

    return res.json({ blockedUsers });
  } catch (error) {
    console.error('Error getting blocked users:', error);
    return res.status(500).json({ error: 'Failed to get blocked users' });
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const unreadOnly = req.query.unreadOnly === 'true';

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build the query
    const whereClause: any = { userId };
    if (unreadOnly) {
      whereClause.isRead = false;
    }

    // Get notifications with pagination
    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.notification.count({
      where: whereClause
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    return res.json({
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'Valid notification IDs are required' });
    }

    // Verify that all notifications belong to the user
    const notifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId
      }
    });

    if (notifications.length !== notificationIds.length) {
      return res.status(403).json({
        error: 'One or more notifications do not belong to you or do not exist'
      });
    }

    // Mark as read
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return res.json({
      message: 'Notifications marked as read',
      count: notifications.length
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get count of unread notifications
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return res.json({
      message: 'All notifications marked as read',
      count: unreadCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

/**
 * Send a test notification to the authenticated user
 */
export const sendTestNotification: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { type } = req.body;

    // Default to a generic notification if type not specified
    const notificationType = type || 'test';

    // Create notification data based on type
    let notificationData: any = { message: 'Test notification' };

    if (notificationType.includes('moment')) {
      notificationData = {
        momentId: 123,
        title: 'Test Moment',
        startTime: new Date(Date.now() + 3600000), // 1 hour from now
        endTime: new Date(Date.now() + 7200000),   // 2 hours from now
        fromUser: {
          id: userId,
          name: 'Current User'
        }
      };
    }

    // Send test notification via event system
    try {
      const { getEventSystem } = await import('../../events');
      const { eventPublisher } = getEventSystem();
      await eventPublisher.publishTestEvent(userId, notificationData);
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }

    return res.json({
      message: 'Test notification sent',
      type: notificationType
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ error: 'Failed to send test notification' });
  }
};

/**
 * Create a moment request for multiple recipients at once
 */
export const createMomentRequestMultiple: CustomRequestHandler = async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverIds, startTime, endTime, title, description } = req.body;

    // Validate required fields
    if (!receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
      return res.status(400).json({
        error: 'At least one receiver ID is required'
      });
    }

    if (!startTime || !endTime || !title) {
      return res.status(400).json({
        error: 'Start time, end time, and title are required'
      });
    }

    try {
      const result = await userService.createMomentRequestForMultipleRecipients(
        senderId,
        receiverIds,
        {
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          title,
          description
        }
      );

      return res.json({
        message: 'Moment requests created successfully',
        result: {
          successful: result.successful.length,
          failed: result.failed.length,
          failedReceiverIds: result.failed
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating multiple moment requests:', error);
    return res.status(500).json({ error: 'Failed to create moment requests' });
  }
};

/**
 * Get all contacts that are registered users
 * Useful for selecting recipients for moments
 */
export const getRegisteredContacts: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const contacts = await userService.getRegisteredContacts(userId);

    return res.json({ contacts });
  } catch (error) {
    console.error('Error getting registered contacts:', error);
    return res.status(500).json({ error: 'Failed to get registered contacts' });
  }
};

/**
 * Test endpoint for the multi-recipient moment request feature (no auth required)
 */
export const testMultiRecipientMomentRequest: CustomRequestHandler = async (req, res) => {
  try {
    const { senderId, receiverIds, startTime, endTime, title, description } = req.body;

    // Validate required fields
    if (!senderId || !receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
      return res.status(400).json({
        error: 'Sender ID and at least one receiver ID are required'
      });
    }

    if (!startTime || !endTime || !title) {
      return res.status(400).json({
        error: 'Start time, end time, and title are required'
      });
    }

    try {
      // Log the request
      console.log('Test multi-recipient request:', {
        senderId,
        receiverCount: receiverIds.length,
        title,
        startTime,
        endTime
      });

      // Simulate successful response without actually creating moment requests
      const result = {
        message: 'Test successful - Moment requests would be created in a real environment',
        result: {
          successful: receiverIds.length,
          failed: 0,
          failedReceiverIds: []
        }
      };

      return res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ error: 'Failed to process test request' });
  }
};
