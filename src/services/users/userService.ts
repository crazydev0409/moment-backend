import prisma from '../../services/prisma';
import { User, Prisma } from '@prisma/client';
import { getEventSystem } from '../../events';

// Define types based on schema
type WorkingHours = {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};


type MomentRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  momentId: number | null;
  sender?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    avatar: string | null;
  };
  receiver?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    avatar: string | null;
  };
};

type Contact = {
  id: string;
  ownerId: string;
  contactUserId: string | null;
  contactPhone: string;
  displayName: string | null;
  updatedAt: Date;
  phoneBookId: string | null;
  importedAt: Date;
  contactUser?: {
    id: string;
    name: string | null;
    avatar: string | null;
    phoneNumber?: string;
  } | null;
};

/**
 * User service for handling user profiles, working hours, and permissions
 */
export class UserService {
  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get a user by phone number
   */
  async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { phoneNumber }
    });
  }

  /**
   * Update a user's profile
   */
  async updateUserProfile(
    userId: string,
    data: {
      name?: string | null;
      avatar?: string | null;
      timezone?: string;
      bio?: string | null;
      email?: string | null;
      birthday?: Date | null;
      meetingTypes?: string[] | null;
    }
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        avatar: data.avatar,
        timezone: data.timezone,
        bio: data.bio,
        email: data.email ?? undefined,
        birthday: data.birthday ?? undefined,
        meetingTypes: data.meetingTypes ?? undefined,
        verified: true
      }
    });
  }

  /**
   * Delete a user's account
   */
  async deleteUser(userId: string): Promise<void> {
    // This will cascade delete related records
    await prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * Check if a user can view another user's moments
   * Users can view each other's moments if they are contacts
   */

  /**
   * Create a moment request to book a time on someone's calendar
   */
  async createMomentRequest(
    senderId: string,
    receiverId: string,
    data: {
      startTime: Date;
      endTime: Date;
      notes?: string;
      meetingType?: string;
    }
  ): Promise<MomentRequest> {
    // Check if users exist
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });

    if (!sender || !receiver) {
      throw new Error('One or both users do not exist');
    }


    const request = await prisma.momentRequest.create({
      data: {
        senderId,
        receiverId,
        startTime: data.startTime,
        endTime: data.endTime,
        title: data.notes || 'Moment Request',
        notes: data.notes || null,
        meetingType: data.meetingType || 'meet',
        status: 'pending'
      }
    });

    // Publish moment request created event
    try {
      const { eventPublisher } = getEventSystem();
      await eventPublisher.publishMomentRequestCreated(
        request.id,
        senderId,
        receiverId,
        {
          senderName: sender.name || 'User',
          title: data.notes || 'New Moment Request',
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes
        }
      );
    } catch (error) {
      console.error('Failed to publish moment request created event:', error);
      // Don't fail the request if event publishing fails
    }

    return request;
  }

  /**
   * Get all moment requests received by a user
   */
  async getReceivedMomentRequests(userId: string): Promise<MomentRequest[]> {
    return prisma.momentRequest.findMany({
      where: {
        receiverId: userId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get pending moment requests received by a user (for showing notifications on app start)
   */
  async getPendingMomentRequests(userId: string): Promise<MomentRequest[]> {
    return prisma.momentRequest.findMany({
      where: {
        receiverId: userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get all moment requests sent by a user
   */
  async getSentMomentRequests(userId: string): Promise<MomentRequest[]> {
    return prisma.momentRequest.findMany({
      where: {
        senderId: userId
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Respond to a moment request (approve or reject)
   */
  async respondToMomentRequest(requestId: string, receiverId: string, approved: boolean): Promise<MomentRequest> {
    const request = await prisma.momentRequest.findFirst({
      where: {
        id: requestId,
        receiverId
      }
    });

    if (!request) {
      throw new Error('Moment request not found or you do not have permission');
    }

    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }

    // If approved, create moments for both users
    if (approved) {
      // Check for time conflicts for receiver
      const conflictingMoments = await prisma.moment.findFirst({
        where: {
          userId: receiverId,
          OR: [
            {
              AND: [
                { startTime: { lte: request.startTime } },
                { endTime: { gt: request.startTime } }
              ]
            },
            {
              AND: [
                { startTime: { lt: request.endTime } },
                { endTime: { gte: request.endTime } }
              ]
            },
            {
              AND: [
                { startTime: { gte: request.startTime } },
                { endTime: { lte: request.endTime } }
              ]
            }
          ]
        }
      });

      if (conflictingMoments) {
        throw new Error('Cannot approve due to a calendar conflict');
      }

      // Get both users' information to use in moment notes
      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      const sender = await prisma.user.findUnique({ where: { id: request.senderId } });

      // Create moment for the receiver
      const receiverMoment = await prisma.moment.create({
        data: {
          userId: receiverId,
          startTime: request.startTime,
          endTime: request.endTime,
          availability: 'private',
          notes: `Moment with ${sender?.phoneNumber || 'a contact'}: ${request.notes || 'Meeting'}`,
          allDay: false,
          visibleTo: [request.senderId] // Make visible to sender
        }
      });

      // Create moment for the sender
      await prisma.moment.create({
        data: {
          userId: request.senderId,
          startTime: request.startTime,
          endTime: request.endTime,
          availability: 'private',
          notes: `Moment with ${receiver?.phoneNumber || 'a contact'}: ${request.notes || 'Meeting'}`,
          allDay: false,
          visibleTo: [receiverId] // Make visible to receiver
        }
      });

      // Update the request with the new status and link to the receiver's moment
      const updatedRequest = await prisma.momentRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          momentId: receiverMoment.id
        },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              avatar: true
            }
          },
          sender: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              avatar: true
            }
          }
        }
      });

      // Publish moment request approved event to notify the sender
      try {
        const { eventPublisher } = getEventSystem();
        await eventPublisher.publishMomentRequestApproved(
          requestId,
          request.senderId,
          receiverId,
          receiverMoment.id,
          {
            receiverName: receiver?.name || receiver?.phoneNumber || 'User',
            title: request.title || request.notes || 'Meeting',
            startTime: request.startTime,
            endTime: request.endTime
          }
        );
      } catch (error) {
        console.error('Failed to publish moment request approved event:', error);
        // Don't fail the request if event publishing fails
      }

      return updatedRequest;
    } else {
      // Just reject the request
      const updatedRequest = await prisma.momentRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected'
        },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              avatar: true
            }
          },
          sender: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              avatar: true
            }
          }
        }
      });

      // Publish moment request rejected event to notify the sender
      try {
        const { eventPublisher } = getEventSystem();
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        await eventPublisher.publishMomentRequestRejected(
          requestId,
          request.senderId,
          receiverId,
          {
            receiverName: receiver?.name || receiver?.phoneNumber || 'User',
            title: request.title || request.notes || 'Meeting',
            startTime: request.startTime,
            endTime: request.endTime
          }
        );
      } catch (error) {
        console.error('Failed to publish moment request rejected event:', error);
        // Don't fail the request if event publishing fails
      }

      return updatedRequest;
    }
  }

  /**
   * Reschedule a moment request - cancels the original request and creates a new one with different time
   */
  async rescheduleMomentRequest(
    requestId: string,
    receiverId: string,
    newSchedule: {
      startTime: Date;
      endTime: Date;
      note?: string;
    }
  ): Promise<MomentRequest> {
    // Find the original request
    const originalRequest = await prisma.momentRequest.findFirst({
      where: {
        id: requestId,
        receiverId
      }
    });

    if (!originalRequest) {
      throw new Error('Moment request not found or you do not have permission');
    }

    if (originalRequest.status !== 'pending') {
      throw new Error('Only pending requests can be rescheduled');
    }

    // Validate the new times
    if (newSchedule.startTime >= newSchedule.endTime) {
      throw new Error('Start time must be before end time');
    }

    // Mark the original request as "rescheduled" (a special kind of rejected status)
    await prisma.momentRequest.update({
      where: { id: requestId },
      data: {
        status: 'rescheduled'
      }
    });

    // Create a new request from the receiver to the original sender
    // (reversing the roles, as the recipient is now suggesting a new time)
    const newRequest = await prisma.momentRequest.create({
      data: {
        senderId: receiverId, // Current receiver becomes the sender
        receiverId: originalRequest.senderId, // Original sender becomes the receiver
        startTime: newSchedule.startTime,
        endTime: newSchedule.endTime,
        title: newSchedule.note || 'Rescheduled Request',
        notes: newSchedule.note || null,
        status: 'pending'
      }
    });

    // Publish reschedule event to notify the original sender
    try {
      const { eventPublisher } = getEventSystem();
      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      await eventPublisher.publishMomentRequestCreated(
        newRequest.id,
        receiverId,
        originalRequest.senderId,
        {
          senderName: receiver?.name || receiver?.phoneNumber || 'User',
          title: newSchedule.note || 'Rescheduled Request',
          startTime: newSchedule.startTime,
          endTime: newSchedule.endTime,
          notes: newSchedule.note,
          isReschedule: true,
          originalRequestId: requestId
        }
      );
    } catch (error) {
      console.error('Failed to publish reschedule event:', error);
      // Don't fail the reschedule if event publishing fails
    }

    return newRequest;
  }

  /**
   * Cancel a moment request - both sender and receiver can cancel
   * Deletes the request and any associated moments if the request was approved
   */
  async cancelMomentRequest(requestId: string, userId: string): Promise<void> {
    // Find the moment request
    const request = await prisma.momentRequest.findFirst({
      where: {
        id: requestId,
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }
    });

    if (!request) {
      throw new Error('Moment request not found or you do not have permission to cancel it');
    }

    // If the request was approved, delete the associated moments for both users
    if (request.status === 'approved') {
      // Delete moments for both sender and receiver
      await prisma.moment.deleteMany({
        where: {
          OR: [
            {
              userId: request.senderId,
              startTime: request.startTime,
              endTime: request.endTime
            },
            {
              userId: request.receiverId,
              startTime: request.startTime,
              endTime: request.endTime
            }
          ]
        }
      });
    }

    // Publish moment deleted event to notify both parties (canceling is same as deleting)
    try {
      const { eventPublisher } = getEventSystem();
      const otherUserId = userId === request.senderId ? request.receiverId : request.senderId;

      console.log('[UserService] Publishing moment deleted event for canceled request:', {
        requestId,
        canceledByUserId: userId,
        otherUserId,
        senderId: request.senderId,
        receiverId: request.receiverId
      });

      // Use moment:deleted event since canceling is the same as deleting
      await eventPublisher.publishMomentDeleted(
        requestId, // Use requestId as momentId for the event
        userId, // The user who canceled
        {
          title: request.title || request.notes || 'Meeting',
          startTime: request.startTime,
          endTime: request.endTime
        },
        otherUserId, // Notify the other user
        requestId // momentRequestId
      );

      console.log('[UserService] ✅ Moment deleted event published successfully for canceled request');
    } catch (error) {
      console.error('[UserService] ❌ Failed to publish moment deleted event:', error);
      // Don't fail the cancellation if event publishing fails
    }

    // Delete the moment request
    await prisma.momentRequest.delete({
      where: { id: requestId }
    });
  }

  /**
   * Add a contact
   */
  async addContact(ownerId: string, contactPhone: string, displayName?: string): Promise<Contact> {
    // Normalize phone number to E.164 format
    let normalizedPhone = contactPhone.trim();

    // Basic validation - this should be more robust in production
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: {
        ownerId_contactPhone: {
          ownerId,
          contactPhone: normalizedPhone
        }
      }
    });

    if (existingContact) {
      return {
        ...existingContact,
        contactUser: undefined
      } as Contact;
    }

    // Find if this phone belongs to a registered user
    const contactUser = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      select: {
        id: true,
        name: true,
        avatar: true
      }
    });

    const contact = await prisma.contact.create({
      data: {
        ownerId,
        contactPhone: normalizedPhone,
        contactUserId: contactUser?.id || null,
        displayName: displayName || normalizedPhone,
        updatedAt: new Date(),
        importedAt: new Date()
      },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    return contact as Contact;
  }

  /**
   * Update a contact
   */
  async updateContact(id: string, ownerId: string, data: { displayName?: string }): Promise<Contact> {
    // Verify ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        ownerId
      }
    });

    if (!contact) {
      throw new Error('Contact not found or you do not have permission');
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    return updatedContact as Contact;
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: string, ownerId: string): Promise<void> {
    // Verify ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        ownerId
      }
    });

    if (!contact) {
      throw new Error('Contact not found or you do not have permission');
    }

    await prisma.contact.delete({
      where: { id }
    });
  }

  /**
   * Get all contacts for a user
   */
  async getContacts(ownerId: string): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: { ownerId },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    return contacts as Contact[];
  }

  /**
   * Import contacts from phone address book
   */
  async importContacts(
    ownerId: string,
    contacts: Array<{
      phoneNumber: string;
      displayName: string;
      phoneBookId?: string;
    }>
  ): Promise<{ imported: number; updated: number; failed: number }> {
    let imported = 0;
    let updated = 0;
    let failed = 0;

    // Process each contact
    for (const contact of contacts) {
      try {
        // Normalize phone number to E.164 format
        // Keep the leading + if present, remove all non-numeric characters (spaces, dashes, etc.)
        let normalizedPhone = contact.phoneNumber.trim();

        // Remove all non-numeric characters (spaces, dashes, parentheses, etc.)
        // This keeps only digits
        const digitsOnly = normalizedPhone.replace(/\D/g, '');

        // Always prefix with + for E.164 format
        normalizedPhone = `+${digitsOnly}`;

        // Find if this phone belongs to a registered user
        const contactUser = await prisma.user.findUnique({
          where: { phoneNumber: normalizedPhone }
        });

        // Check if contact already exists
        const existingContact = await prisma.contact.findUnique({
          where: {
            ownerId_contactPhone: {
              ownerId,
              contactPhone: normalizedPhone
            }
          }
        });

        if (existingContact) {
          // Update existing contact
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              displayName: contact.displayName,
              phoneBookId: contact.phoneBookId,
              contactUserId: contactUser?.id || existingContact.contactUserId,
              updatedAt: new Date()
            }
          });
          updated++;
        } else {
          // Create new contact
          await prisma.contact.create({
            data: {
              ownerId,
              contactPhone: normalizedPhone,
              contactUserId: contactUser?.id || null,
              displayName: contact.displayName,
              phoneBookId: contact.phoneBookId
            }
          });
          imported++;
        }
      } catch (error) {
        console.error('Failed to import contact:', error);
        failed++;
      }
    }

    return { imported, updated, failed };
  }

  /**
   * Sync user contacts with actual users
   * This updates contact records where the phone number now belongs to a registered user
   */
  async syncContacts(ownerId: string): Promise<number> {
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId,
        contactUserId: null // Only sync contacts that don't have a user ID yet
      }
    });

    let updatedCount = 0;

    for (const contact of contacts) {
      // Check if this phone now belongs to a registered user
      const user = await prisma.user.findUnique({
        where: { phoneNumber: contact.contactPhone }
      });

      if (user) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { contactUserId: user.id }
        });
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Block a user from viewing your calendar
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    // Verify both users exist
    const blocker = await prisma.user.findUnique({ where: { id: blockerId } });
    const blocked = await prisma.user.findUnique({ where: { id: blockedId } });

    if (!blocker || !blocked) {
      throw new Error('One or both users do not exist');
    }

    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    // Check if already blocked
    const existingBlock = await prisma.blockedContact.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId
        }
      }
    });

    if (existingBlock) {
      // Already blocked, no need to do anything
      return;
    }

    // Create block record
    await prisma.blockedContact.create({
      data: {
        blockerId,
        blockedId
      }
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await prisma.blockedContact.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId
        }
      }
    });
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(viewerId: string, userId: string): Promise<boolean> {
    // Check if the viewer is blocked by the user
    const block = await prisma.blockedContact.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: viewerId
        }
      }
    });

    return !!block;
  }

  /**
   * Get all blocked users
   */
  async getBlockedUsers(userId: string): Promise<{
    id: string;
    blockerId: string;
    blockedId: string;
    createdAt: Date;
    blocked: User;
  }[]> {
    return prisma.blockedContact.findMany({
      where: { blockerId: userId },
      include: {
        blocked: true
      }
    });
  }

  /**
   * Share a moment with specific contacts
   */
  async shareMomentWithContacts(userId: string, momentId: number, contactIds: string[]): Promise<void> {
    // Verify the moment belongs to the user
    const moment = await prisma.moment.findFirst({
      where: {
        id: momentId,
        userId: userId
      }
    });

    if (!moment) {
      throw new Error('Moment not found or you do not have permission');
    }

    // Verify all contacts exist
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        contactUserId: {
          in: contactIds
        }
      }
    });

    const validContactIds = contacts.map((contact) => contact.contactUserId).filter((id): id is string => id !== null);

    if (validContactIds.length !== contactIds.length) {
      throw new Error('One or more contact IDs are invalid');
    }

    // Update the moment's visibleTo field
    await prisma.moment.update({
      where: { id: momentId },
      data: {
        visibleTo: validContactIds
      }
    });
  }

  /**
   * Create a moment request for multiple recipients at once
   */
  async createMomentRequestForMultipleRecipients(
    senderId: string,
    receiverIds: string[],
    data: {
      startTime: Date;
      endTime: Date;
      title: string;
      description?: string;
    }
  ): Promise<{ successful: MomentRequest[]; failed: string[] }> {
    // Validate input
    if (!receiverIds.length) {
      throw new Error('At least one receiver ID is required');
    }

    if (data.startTime >= data.endTime) {
      throw new Error('Start time must be before end time');
    }

    // Check if sender exists
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        name: true,
        phoneNumber: true
      }
    });

    if (!sender) {
      throw new Error('Sender user not found');
    }

    // Track successful and failed requests
    const successful: MomentRequest[] = [];
    const failed: string[] = [];

    // Create a request for each recipient
    for (const receiverId of receiverIds) {
      try {
        // Verify this recipient exists and isn't the sender
        if (receiverId === senderId) {
          failed.push(receiverId);
          continue;
        }

        const receiver = await prisma.user.findUnique({
          where: { id: receiverId }
        });

        if (!receiver) {
          failed.push(receiverId);
          continue;
        }

        // Check if the receiver has blocked the sender
        const isBlocked = await this.isUserBlocked(senderId, receiverId);
        if (isBlocked) {
          failed.push(receiverId);
          continue;
        }

        // Create the moment request
        const request = await prisma.momentRequest.create({
          data: {
            senderId,
            receiverId,
            startTime: data.startTime,
            endTime: data.endTime,
            title: data.title,
            notes: data.description || null,
            status: 'pending'
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
                avatar: true
              }
            },
            receiver: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
                avatar: true
              }
            }
          }
        });

        // Publish moment request created event
        try {
          const { eventPublisher } = getEventSystem();
          await eventPublisher.publishMomentRequestCreated(
            request.id,
            senderId,
            receiverId,
            {
              senderName: sender.name || 'User',
              title: data.title,
              startTime: data.startTime,
              endTime: data.endTime,
              notes: data.description
            }
          );
        } catch (error) {
          console.error('Failed to publish moment request created event:', error);
          // Don't fail the request if event publishing fails
        }

        // Event system will handle notifications and database storage

        successful.push(request);
      } catch (error) {
        console.error(`Failed to create moment request for receiver ${receiverId}:`, error);
        failed.push(receiverId);
      }
    }

    return { successful, failed };
  }

  /**
   * Get all contacts that are registered users
   * This is useful for selecting recipients for moments
   */
  async getRegisteredContacts(ownerId: string): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        ownerId,
        contactUserId: {
          not: null
        }
      },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
            phoneNumber: true
          }
        }
      },
      orderBy: {
        displayName: 'asc'
      }
    });
  }
}
