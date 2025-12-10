import { Request as _Request, Response as _Response } from 'express';
import prisma from '../../services/prisma';
import { CustomRequestHandler } from '../../types/express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UserService } from '../../services/users/userService';
import { Prisma } from '@prisma/client';

const userService = new UserService();

/**
 * Create a new moment
 */
export const createMoment: CustomRequestHandler = async (req, res) => {
  try {
    const { startTime, endTime, availability, notes, icon, allDay, visibleTo } = req.body;

    // Input validation
    if (!startTime || !endTime || !availability) {
      return res.status(400).json({
        error: 'startTime, endTime, and availability are required'
      });
    }

    if (!['public', 'private'].includes(availability)) {
      return res.status(400).json({
        error: 'availability must be either "public" or "private"'
      });
    }

    // Parse dates
    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (parsedStartTime >= parsedEndTime) {
      return res.status(400).json({ error: 'startTime must be before endTime' });
    }

    // Validate shared users if provided
    let validatedVisibleTo: string[] = [];
    if (visibleTo && Array.isArray(visibleTo) && visibleTo.length > 0) {
      try {
        const contacts = await prisma.contact.findMany({
          where: {
            ownerId: req.user!.id,
            contactUserId: { in: visibleTo }
          }
        });

        validatedVisibleTo = contacts.map((contact) => contact.contactUserId).filter((id): id is string => id !== null);
      } catch (error) {
        console.error('Error validating shared users:', error);
      }
    }

    // Create moment in database
    const newMoment = await prisma.moment.create({
      data: {
        userId: req.user!.id,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        availability,
        notes: notes || null,
        icon: icon || null,
        allDay: allDay === true,
        visibleTo: validatedVisibleTo
      }
    });

    return res.json({ message: 'Moment created successfully', moment: newMoment });
  } catch (error) {
    console.error('Error creating moment:', error);
    return res.status(500).json({ error: 'Failed to create moment' });
  }
};

/**
 * Get all moments for the authenticated user
 */
export const getMoments: CustomRequestHandler = async (req, res) => {
  try {
    // Get user's moments
    const moments = await prisma.moment.findMany({
      where: {
        userId: req.user!.id
      },
      orderBy: { startTime: 'asc' }
    });

    return res.json({ moments });
  } catch (error) {
    console.error('Error listing moments:', error);
    return res.status(500).json({ error: 'Failed to list moments' });
  }
};


/**
 * Update a specific moment
 */
export const updateMoment: CustomRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, availability, notes, icon, allDay } = req.body;

    // Validate moment ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Valid moment ID is required' });
    }

    // Check if the moment exists and belongs to the user
    const moment = await prisma.moment.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id
      }
    });

    if (!moment) {
      return res.status(404).json({
        error: 'Moment not found or you do not have permission to update it'
      });
    }

    // Prepare update data with explicit typing
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (startTime) {
      const parsedStartTime = new Date(startTime);

      // Check end time constraint
      if (endTime) {
        const parsedEndTime = new Date(endTime);
        if (parsedStartTime >= parsedEndTime) {
          return res.status(400).json({ error: 'startTime must be before endTime' });
        }
      } else if (parsedStartTime >= moment.endTime) {
        return res.status(400).json({ error: 'startTime must be before endTime' });
      }

      updates.push(`"startTime" = $${paramCount++}`);
      values.push(parsedStartTime);
    }

    if (endTime) {
      const parsedEndTime = new Date(endTime);

      // Check start time constraint
      if (!startTime && moment.startTime >= parsedEndTime) {
        return res.status(400).json({ error: 'startTime must be before endTime' });
      }

      updates.push(`"endTime" = $${paramCount++}`);
      values.push(parsedEndTime);
    }

    if (availability) {
      if (!['public', 'private'].includes(availability)) {
        return res.status(400).json({ error: 'availability must be either "public" or "private"' });
      }
      updates.push(`"availability" = $${paramCount++}`);
      values.push(availability);
    }

    if (notes !== undefined) {
      updates.push(`"notes" = $${paramCount++}`);
      values.push(notes);
    }

    if (icon !== undefined) {
      updates.push(`"icon" = $${paramCount++}`);
      values.push(icon);
    }

    if (allDay !== undefined) {
      updates.push(`"allDay" = $${paramCount++}`);
      values.push(allDay === true);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    // Update moment
    const updateQuery = `
      UPDATE "Moment"
      SET ${updates.join(', ')}, "updatedAt" = NOW()
      WHERE id = $${paramCount++}
      RETURNING *
    `;
    values.push(parseInt(id));

    const updatedMoment = await prisma.$queryRawUnsafe(updateQuery, ...values);
    const updatedMomentData = (updatedMoment as any[])[0];

    // Sync update to corresponding moment for the other user if this moment is from a moment request
    let otherUserMomentId: number | null = null;
    let otherUserId: string | null = null;
    let momentRequest: any = null;

    try {
      // Check if this moment is linked to a moment request
      momentRequest = await prisma.momentRequest.findFirst({
        where: { momentId: parseInt(id) },
        include: { sender: true, receiver: true }
      });

      if (momentRequest) {
        // Determine the other user
        otherUserId = momentRequest.senderId === req.user!.id 
          ? momentRequest.receiverId 
          : momentRequest.senderId;

        // Find the corresponding moment for the other user
        // Moments created from the same request will have matching startTime/endTime
        const originalStartTime = moment.startTime;
        const originalEndTime = moment.endTime;
        const newStartTime = updatedMomentData.startTime || originalStartTime;
        const newEndTime = updatedMomentData.endTime || originalEndTime;

        // Find the other user's moment with matching original times
        const otherUserMoment = otherUserId ? await prisma.moment.findFirst({
          where: {
            userId: otherUserId,
            startTime: originalStartTime,
            endTime: originalEndTime,
            // Make sure it's visible to the current user (indicating it's from the same request)
            visibleTo: {
              has: req.user!.id
            }
          }
        }) : null;

        if (otherUserMoment) {
          otherUserMomentId = otherUserMoment.id;

          // Prepare updates for the other user's moment
          const otherUpdates: string[] = [];
          const otherValues: any[] = [];
          let otherParamCount = 1;

          // Sync startTime and endTime if they were updated
          if (startTime) {
            otherUpdates.push(`"startTime" = $${otherParamCount++}`);
            otherValues.push(newStartTime);
          }
          if (endTime) {
            otherUpdates.push(`"endTime" = $${otherParamCount++}`);
            otherValues.push(newEndTime);
          }
          // Sync notes if updated (but keep the format with the other person's name)
          if (notes !== undefined) {
            // Extract the meeting title/notes part, keeping the "Moment with [person]" format
            const otherUser = momentRequest.senderId === req.user!.id 
              ? momentRequest.receiver 
              : momentRequest.sender;
            const otherPersonName = otherUser?.phoneNumber || 'a contact';
            const meetingNotes = notes.includes(':') ? notes.split(':').slice(1).join(':').trim() : notes;
            const formattedNotes = `Moment with ${otherPersonName}: ${meetingNotes}`;
            otherUpdates.push(`"notes" = $${otherParamCount++}`);
            otherValues.push(formattedNotes);
          }
          // Sync availability if updated
          if (availability) {
            otherUpdates.push(`"availability" = $${otherParamCount++}`);
            otherValues.push(availability);
          }
          // Sync icon if updated
          if (icon !== undefined) {
            otherUpdates.push(`"icon" = $${otherParamCount++}`);
            otherValues.push(icon);
          }
          // Sync allDay if updated
          if (allDay !== undefined) {
            otherUpdates.push(`"allDay" = $${otherParamCount++}`);
            otherValues.push(allDay === true);
          }

          // Update the other user's moment if there are changes
          if (otherUpdates.length > 0) {
            otherUpdates.push(`"updatedAt" = NOW()`);
            otherValues.push(otherUserMoment.id);
            
            const otherUpdateQuery = `
              UPDATE "Moment"
              SET ${otherUpdates.join(', ')}
              WHERE id = $${otherParamCount}
              RETURNING *
            `;
            
            await prisma.$queryRawUnsafe(otherUpdateQuery, ...otherValues);
            console.log(`✅ Synced moment update to other user's moment (ID: ${otherUserMoment.id})`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync moment update to other user:', error);
      // Don't fail the update if sync fails
    }

    // Publish moment updated event and notify other user
    try {
      const { getEventSystem } = await import('../../events');
      const { eventPublisher } = getEventSystem();

      if (momentRequest && otherUserId) {
        await eventPublisher.publishMomentUpdated(
          id,
          req.user!.id,
          {
            notes: updatedMomentData.notes,
            title: momentRequest.title,
            startTime: updatedMomentData.startTime,
            endTime: updatedMomentData.endTime,
            availability: updatedMomentData.availability
          },
          otherUserId,
          momentRequest.id
        );
      } else {
        // Still publish event for moments not from requests (for future use)
        await eventPublisher.publishMomentUpdated(
          id,
          req.user!.id,
          {
            notes: updatedMomentData.notes,
            startTime: updatedMomentData.startTime,
            endTime: updatedMomentData.endTime,
            availability: updatedMomentData.availability
          }
        );
      }
    } catch (error) {
      console.error('Failed to publish moment updated event:', error);
      // Don't fail the update if event publishing fails
    }

    return res.json({
      message: 'Moment updated successfully',
      moment: updatedMomentData
    });
  } catch (error) {
    console.error('Error updating moment:', error);
    return res.status(500).json({ error: 'Failed to update moment' });
  }
};

/**
 * Delete a specific moment
 */
export const deleteMoment: CustomRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate moment ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Valid moment ID is required' });
    }

    // Check if the moment exists and belongs to the user
    const momentCheck = await prisma.moment.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id
      }
    });

    if (!momentCheck) {
      return res.status(404).json({
        error: 'Moment not found or you do not have permission to delete it'
      });
    }

    // Check if this moment is linked to a moment request before deleting
    const momentRequest = await prisma.momentRequest.findFirst({
      where: { momentId: parseInt(id) },
      include: { sender: true, receiver: true }
    });

    // Delete moment
    await prisma.$queryRaw`
      DELETE FROM "Moment"
      WHERE id = ${parseInt(id)}
    `;

    // Publish moment deleted event and notify other user if this moment is from a moment request
    try {
      const { getEventSystem } = await import('../../events');
      const { eventPublisher } = getEventSystem();

      if (momentRequest) {
        // Notify the other user involved in the meeting
        const otherUserId = momentRequest.senderId === req.user!.id 
          ? momentRequest.receiverId 
          : momentRequest.senderId;
        
        await eventPublisher.publishMomentDeleted(
          parseInt(id),
          req.user!.id,
          {
            notes: momentCheck.notes,
            title: momentRequest.title,
            startTime: momentCheck.startTime,
            endTime: momentCheck.endTime
          },
          otherUserId,
          momentRequest.id
        );
      } else {
        // Still publish event for moments not from requests
        await eventPublisher.publishMomentDeleted(
          id,
          req.user!.id,
          {
            notes: momentCheck.notes,
            startTime: momentCheck.startTime,
            endTime: momentCheck.endTime
          }
        );
      }
    } catch (error) {
      console.error('Failed to publish moment deleted event:', error);
      // Don't fail the delete if event publishing fails
    }

    return res.json({ message: 'Moment deleted successfully' });
  } catch (error) {
    console.error('Error deleting moment:', error);
    return res.status(500).json({ error: 'Failed to delete moment' });
  }
};

/**
 * Get moments for another user with respect to visibility permissions
 */
export const getUserCalendar: CustomRequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user!.id;

    // Validate user ID
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if the target user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if viewer is blocked by target user
    const blockCheck = await prisma.blockedContact.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: viewerId },
          { blockerId: viewerId, blockedId: userId }
        ]
      }
    });

    if (blockCheck) {
      return res.status(403).json({
        error: "You do not have permission to view this user's moments"
      });
    }

    // Get user's moments
    const moments = await prisma.moment.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' }
    });

    // Process moments - show full details if visibleTo includes viewer, otherwise show only timing
    const processedMoments = moments.map(moment => {
      const isVisibleToViewer = moment.visibleTo && Array.isArray(moment.visibleTo) &&
        moment.visibleTo.includes(viewerId);

      if (isVisibleToViewer || moment.availability === 'public') {
        return moment;
      } else {
        // Show only timing for private moments not explicitly shared
        return {
          id: moment.id,
          startTime: moment.startTime,
          endTime: moment.endTime,
          allDay: moment.allDay,
          availability: 'public',
          notes: null,
          icon: null,
          visibleTo: [],
          createdAt: moment.createdAt,
          updatedAt: moment.updatedAt,
          _isBusyTime: true
        };
      }
    });

    return res.json({
      userId: user.id,
      username: user.name,
      moments: processedMoments
    });
  } catch (error) {
    console.error('Error getting user calendar:', error);
    return res.status(500).json({ error: 'Failed to get user calendar' });
  }
};

/**
 * Share a moment with specific contacts
 */
export const shareMoment: CustomRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;

    // Validate moment ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Valid moment ID is required' });
    }

    // Validate contact IDs
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'Valid contactIds array is required' });
    }

    // Check if the moment exists and belongs to the user
    const momentCheck = await prisma.moment.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id
      }
    });

    if (!momentCheck) {
      return res.status(404).json({
        error: 'Moment not found or you do not have permission to share it'
      });
    }

    const moment = momentCheck;

    // Validate that all contactIds are actual contacts of the user
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: req.user!.id,
        contactUserId: { in: contactIds }
      }
    });

    const validContactIds = contacts
      .map(contact => contact.contactUserId)
      .filter((id): id is string => id !== null);

    if (!validContactIds.length) {
      return res.status(400).json({ error: 'No valid contacts found' });
    }

    // Get current visibleTo list and combine with new IDs
    const currentVisibleTo = moment.visibleTo || [];
    const combinedVisibleTo = [...new Set([...currentVisibleTo, ...validContactIds])];

    // Update the moment
    await prisma.moment.update({
      where: { id: parseInt(id) },
      data: {
        visibleTo: combinedVisibleTo
      }
    });

    return res.json({ message: 'Moment shared successfully' });
  } catch (error) {
    console.error('Error sharing moment:', error);
    return res.status(500).json({ error: 'Failed to share moment' });
  }
};
