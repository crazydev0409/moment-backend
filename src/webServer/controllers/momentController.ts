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
    const momentCheck = await prisma.moment.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id
      }
    });

    if (!momentCheck) {
      return res.status(404).json({ 
        error: 'Moment not found or you do not have permission to update it' 
      });
    }

    const moment = momentCheck;

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

    return res.json({
      message: 'Moment updated successfully',
      moment: (updatedMoment as any[])[0]
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

    // Delete moment
    await prisma.$queryRaw`
      DELETE FROM "Moment"
      WHERE id = ${parseInt(id)}
    `;

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

    // Check if users are contacts (for visibility)
    const canView = await userService.canViewCalendar(viewerId, userId);
    if (!canView) {
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
