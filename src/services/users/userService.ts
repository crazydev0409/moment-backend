import prisma from '../../services/prisma';
import { User } from '@prisma/client';
import { getEventSystem } from '../../events';
import { hashPhoneNumber } from '../../utils/phoneHash';
import { normalizePhoneNumber } from '../../utils/phoneUtils';
import {
  AvailabilityScheduleResponse,
  AvailabilitySlotInput,
  BookableUser,
  CalendarEventSummary,
} from '../../types/calendar';

const DEFAULT_WEEKDAY_SLOTS: AvailabilitySlotInput[] = [
  { weekday: 0, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 1, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 2, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 3, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 4, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 5, startMinutes: 0, endMinutes: 24 * 60 },
  { weekday: 6, startMinutes: 0, endMinutes: 24 * 60 },
];

const WEEKDAY_LABELS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const getDatePartsInTimezone = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = WEEKDAY_LABELS[parts.find(part => part.type === 'weekday')?.value || 'Sun'] ?? 0;
  const hour = Number(parts.find(part => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value || '0');

  return {
    weekday,
    minutes: hour * 60 + minute,
  };
};


type MomentRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  notes: string | null;
  description?: string | null;
  meetingType?: string | null;
  locationType?: string;
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
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
    const hashedPhoneNumber = hashPhoneNumber(phoneNumber);
    return prisma.user.findUnique({
      where: { phoneNumber: hashedPhoneNumber }
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

  async getBookableUser(viewerId: string, targetUserId: string): Promise<BookableUser> {
    if (viewerId === targetUserId) {
      throw new Error('You cannot book a meeting with yourself');
    }

    const blocked = await this.isUserBlocked(viewerId, targetUserId);
    if (blocked) {
      throw new Error('You do not have permission to book this user');
    }

    const [targetUser, contact] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          avatar: true,
          timezone: true,
          phoneNumber: true,
        },
      }),
      prisma.contact.findFirst({
        where: {
          ownerId: viewerId,
          contactUserId: targetUserId,
        },
        select: {
          id: true,
          displayName: true,
        },
      }),
    ]);

    if (!targetUser) {
      throw new Error('Bookable user not found');
    }

    return {
      id: targetUser.id,
      displayName: contact?.displayName || targetUser.name || 'Catch user',
      avatar: targetUser.avatar,
      isContact: Boolean(contact),
      timezone: targetUser.timezone || 'UTC',
    };
  }

  async getAvailabilitySchedule(userId: string): Promise<AvailabilityScheduleResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const slots = await prisma.availabilitySlot.findMany({
      where: { userId },
      orderBy: [
        { weekday: 'asc' },
        { startMinutes: 'asc' },
      ],
    });

    return {
      timezone: user.timezone || 'UTC',
      slots: slots.length > 0
        ? slots.map(slot => ({
            weekday: slot.weekday,
            startMinutes: slot.startMinutes,
            endMinutes: slot.endMinutes,
          }))
        : DEFAULT_WEEKDAY_SLOTS,
    };
  }

  async updateAvailabilitySchedule(
    userId: string,
    data: AvailabilityScheduleResponse,
  ): Promise<AvailabilityScheduleResponse> {
    const timezone = data.timezone || 'UTC';

    // Sort and validate individual slot ranges
    const sortedSlots = [...data.slots]
      .sort((a, b) => (a.weekday - b.weekday) || (a.startMinutes - b.startMinutes));

    for (const slot of sortedSlots) {
      if (
        slot.weekday < 0 ||
        slot.weekday > 6 ||
        slot.startMinutes < 0 ||
        slot.endMinutes > 24 * 60 ||
        slot.startMinutes >= slot.endMinutes
      ) {
        throw new Error('Availability slots must have valid weekday and time ranges');
      }
    }

    // Merge overlapping/adjacent slots on the same weekday
    const uniqueSlots: AvailabilitySlotInput[] = [];
    for (const slot of sortedSlots) {
      const previous = uniqueSlots[uniqueSlots.length - 1];
      if (
        previous &&
        previous.weekday === slot.weekday &&
        previous.endMinutes >= slot.startMinutes
      ) {
        previous.endMinutes = Math.max(previous.endMinutes, slot.endMinutes);
      } else {
        uniqueSlots.push({
          weekday: slot.weekday,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
        });
      }
    }

    if (uniqueSlots.length === 0) {
      throw new Error('At least one availability slot is required');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { timezone },
      });

      await tx.availabilitySlot.deleteMany({
        where: { userId },
      });

      if (uniqueSlots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: uniqueSlots.map(slot => ({
            userId,
            weekday: slot.weekday,
            startMinutes: slot.startMinutes,
            endMinutes: slot.endMinutes,
            timezone,
          })),
        });
      }
    });

    return {
      timezone,
      slots: uniqueSlots,
    };
  }

  async getCalendarEventsForUser(
    userId: string,
    viewerId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEventSummary[]> {
    const isOwnerView = viewerId === userId;
    const [requests, externalEvents] = await Promise.all([
      prisma.momentRequest.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
          startTime: { lt: rangeEnd },
          endTime: { gt: rangeStart },
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.externalCalendarEvent.findMany({
        where: {
          integration: {
            userId,
          },
          startTime: { lt: rangeEnd },
          endTime: { gt: rangeStart },
        },
        include: {
          integration: {
            select: {
              provider: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    const visibleInternalEvents = requests.filter((request) => {
      if (viewerId === userId) {
        return true;
      }

      return (
        request.status === 'approved' ||
        request.status === 'pending' ||
        (request.status === 'rejected' && request.senderId === viewerId)
      );
    });

    const internalEvents: CalendarEventSummary[] = visibleInternalEvents.map((request) => ({
      id: request.id,
      source: 'catch',
      sourceType: 'internal',
      title: isOwnerView ? request.title : 'Busy',
      description: isOwnerView ? request.notes || request.description || null : null,
      startTime: request.startTime.toISOString(),
      endTime: request.endTime.toISOString(),
      status: isOwnerView ? request.status : undefined,
      meetingType: isOwnerView ? request.meetingType : undefined,
      locationType: isOwnerView ? request.locationType : undefined,
      locationLabel: isOwnerView ? request.locationLabel : null,
      locationAddress: isOwnerView ? request.locationAddress : null,
      locationLatitude: isOwnerView ? request.locationLatitude : null,
      locationLongitude: isOwnerView ? request.locationLongitude : null,
      compact: false,
    }));

    const mappedExternalEvents: CalendarEventSummary[] = externalEvents.map((event) => ({
      id: event.id,
      source: event.integration.provider as CalendarEventSummary['source'],
      sourceType: 'external',
      title: isOwnerView ? event.title : 'Busy',
      description: isOwnerView ? event.description : null,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      locationType: isOwnerView ? (event.location ? 'onsite' : 'remote') : undefined,
      locationLabel: isOwnerView ? event.sourceCalendarName : null,
      locationAddress: isOwnerView ? event.location : null,
      compact: true,
    }));

    return [...internalEvents, ...mappedExternalEvents].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }

  async validateMeetingSchedule(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeRequestId?: string,
  ): Promise<void> {
    const conflicts = await prisma.momentRequest.findFirst({
      where: {
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
        status: {
          in: ['pending', 'approved'],
        },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (conflicts) {
      throw new Error('Selected time conflicts with an existing Catch meeting');
    }

    const externalConflict = await prisma.externalCalendarEvent.findFirst({
      where: {
        integration: {
          userId,
        },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (externalConflict) {
      throw new Error('Selected time conflicts with a connected calendar event');
    }
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
      title: string;
      notes?: string;
      meetingType?: string;
      locationType?: 'remote' | 'onsite';
      locationLabel?: string;
      locationAddress?: string;
      locationLatitude?: number;
      locationLongitude?: number;
      hookId?: string | null;
    }
  ): Promise<MomentRequest> {
    if (senderId === receiverId) {
      throw new Error('You cannot create a meeting with yourself');
    }

    // Check if users exist
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });

    if (!sender || !receiver) {
      throw new Error('One or both users do not exist');
    }

    if (data.startTime >= data.endTime) {
      throw new Error('Start time must be before end time');
    }

    await this.validateMeetingSchedule(receiverId, data.startTime, data.endTime);

    const request = await prisma.momentRequest.create({
      data: {
        senderId,
        receiverId,
        startTime: data.startTime,
        endTime: data.endTime,
        title: data.title,
        notes: data.notes || null,
        meetingType: data.meetingType || 'meet',
        locationType: data.locationType || 'remote',
        locationLabel: data.locationLabel || null,
        locationAddress: data.locationAddress || null,
        locationLatitude: data.locationLatitude ?? null,
        locationLongitude: data.locationLongitude ?? null,
        hookId: data.hookId ?? null,
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
          title: data.title || data.notes || 'New Moment Request',
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
      await this.validateMeetingSchedule(receiverId, request.startTime, request.endTime, requestId);

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
          notes: `Moment with ${sender?.name || 'a contact'}: ${request.notes || 'Meeting'}`,
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
          notes: `Moment with ${receiver?.name || 'a contact'}: ${request.notes || 'Meeting'}`,
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
    userId: string,
    newSchedule: {
      startTime: Date;
      endTime: Date;
      note?: string;
    }
  ): Promise<MomentRequest> {
    // Allow both sender and receiver to reschedule
    const originalRequest = await prisma.momentRequest.findFirst({
      where: {
        id: requestId,
        OR: [{ senderId: userId }, { receiverId: userId }]
      }
    });

    if (!originalRequest) {
      throw new Error('Moment request not found or you do not have permission');
    }

    if (originalRequest.status !== 'pending') {
      throw new Error('Only pending requests can be rescheduled');
    }

    if (newSchedule.startTime >= newSchedule.endTime) {
      throw new Error('Start time must be before end time');
    }

    const isSender = originalRequest.senderId === userId;

    if (isSender) {
      // Organizer updating their own request — update in place
      const updatedRequest = await prisma.momentRequest.update({
        where: { id: requestId },
        data: {
          startTime: newSchedule.startTime,
          endTime: newSchedule.endTime,
          notes: newSchedule.note || originalRequest.notes,
        }
      });

      // Notify the receiver about the updated time
      try {
        const { eventPublisher } = getEventSystem();
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        await eventPublisher.publishMomentRequestCreated(
          updatedRequest.id,
          userId,
          originalRequest.receiverId,
          {
            senderName: sender?.name || sender?.phoneNumber || 'User',
            title: newSchedule.note || originalRequest.title || 'Rescheduled Request',
            startTime: newSchedule.startTime,
            endTime: newSchedule.endTime,
            notes: newSchedule.note,
            isReschedule: true,
            originalRequestId: requestId
          }
        );
      } catch (error) {
        console.error('Failed to publish reschedule event:', error);
      }

      return updatedRequest;
    } else {
      // Receiver proposing a counter-time — mark original rescheduled, create new request
      await prisma.momentRequest.update({
        where: { id: requestId },
        data: { status: 'rescheduled' }
      });

      const newRequest = await prisma.momentRequest.create({
        data: {
          senderId: userId,
          receiverId: originalRequest.senderId,
          startTime: newSchedule.startTime,
          endTime: newSchedule.endTime,
          title: newSchedule.note || originalRequest.title || 'Rescheduled Request',
          notes: newSchedule.note || null,
          status: 'pending'
        }
      });

      try {
        const { eventPublisher } = getEventSystem();
        const receiver = await prisma.user.findUnique({ where: { id: userId } });
        await eventPublisher.publishMomentRequestCreated(
          newRequest.id,
          userId,
          originalRequest.senderId,
          {
            senderName: receiver?.name || receiver?.phoneNumber || 'User',
            title: newSchedule.note || originalRequest.title || 'Rescheduled Request',
            startTime: newSchedule.startTime,
            endTime: newSchedule.endTime,
            notes: newSchedule.note,
            isReschedule: true,
            originalRequestId: requestId
          }
        );
      } catch (error) {
        console.error('Failed to publish reschedule event:', error);
      }

      return newRequest;
    }
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
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(contactPhone);
    } catch (e) {
      // Fallback for safety, though controller should catch this
      normalizedPhone = contactPhone.startsWith('+') ? contactPhone : `+${contactPhone.replace(/\D/g, '')}`;
    }

    // Hash phone number for legacy lookup (to check if it exists as a hash)
    const hashedPhoneNumber = hashPhoneNumber(normalizedPhone);

    // Check if contact already exists (by plain number OR by hash)
    const existingContact = await prisma.contact.findFirst({
      where: {
        ownerId,
        OR: [
          { contactPhone: normalizedPhone },
          { contactPhone: hashedPhoneNumber }
        ]
      }
    });

    if (existingContact) {
      // If found by hash, migrate to plain number
      if (existingContact.contactPhone === hashedPhoneNumber) {
        return prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            contactPhone: normalizedPhone,
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
        }) as Promise<Contact>;
      }

      return {
        ...existingContact,
        contactUser: undefined
      } as Contact;
    }

    // Find if this phone belongs to a registered user
    // We check both plain (new users) and hash (legacy users)
    const contactUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone },
          { phoneNumber: hashedPhoneNumber }
        ]
      },
      select: {
        id: true,
        name: true,
        avatar: true
      }
    });

    const contact = await prisma.contact.create({
      data: {
        ownerId,
        contactPhone: normalizedPhone, // Store PLAIN number
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
      where: {
        ownerId,
        OR: [
          { contactUserId: { not: ownerId } },
          { contactUserId: null }
        ]
      },
      include: {
        contactUser: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: {
        displayName: 'asc'
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
        let normalizedPhone: string;
        try {
          normalizedPhone = normalizePhoneNumber(contact.phoneNumber);
        } catch (e) {
          // If normalization fails, try a basic fallback or skip
          console.warn(`Failed to normalize ${contact.phoneNumber}, trying basic strip`);
          normalizedPhone = `+${contact.phoneNumber.replace(/\D/g, '')}`;
          if (normalizedPhone.length < 5) { // Too short to be valid
            failed++;
            continue;
          }
        }

        // Hash phone number for legacy lookup
        const hashedPhoneNumber = hashPhoneNumber(normalizedPhone);

        // Find if this phone belongs to a registered user
        // Check both plain and hash
        const contactUser = await prisma.user.findFirst({
          where: {
            OR: [
              { phoneNumber: normalizedPhone },
              { phoneNumber: hashedPhoneNumber }
            ]
          }
        });

        // Check if contact already exists
        // We look for EITHER the normalized plain number OR the legacy hash
        const existingContact = await prisma.contact.findFirst({
          where: {
            ownerId,
            OR: [
              { contactPhone: normalizedPhone },
              { contactPhone: hashedPhoneNumber }
            ]
          }
        });

        if (existingContact) {
          // Update existing contact (and migrate hash -> plain if needed)
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              contactPhone: normalizedPhone, // Always ensure we are storing the plain normalized number
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
              displayName: contact.displayName,
              phoneBookId: contact.phoneBookId,
              contactUserId: contactUser?.id || null,
              importedAt: new Date()
            }
          });
          imported++;
        }
      } catch (error) {
        console.error('Error importing contact:', error);
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
        contactUserId: { not: null },
        NOT: { contactUserId: ownerId },
        contactUser: { verified: true },
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
