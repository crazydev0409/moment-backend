/* eslint-disable */
import { UserService } from '../services/users/userService';
import prisma from '../services/prisma';

// Mock the notification service to prevent Redis connections
jest.mock('../services/notifications/notificationService', () => ({
  sendNotification: jest.fn(),
  sendMomentInvitation: jest.fn(),
  sendMomentReminder: jest.fn(),
  QueueNames: {
    MOMENT_INVITATION: 'moment_invitation',
    MOMENT_REMINDER: 'moment_reminder',
    USER_NOTIFICATION: 'user_notification'
  }
}));

// Mock Prisma
jest.mock('../services/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn()
    },
    moment: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    momentRequest: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    }
  }
}));

describe('MomentRequest Service', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('rescheduleMomentRequest', () => {
    it('should reschedule a moment request', async () => {
      // Mock data
      const requestId = 'request-id';
      const receiverId = 'receiver-id';
      const originalSenderId = 'sender-id';
      const startTime = new Date('2023-06-01T10:00:00Z');
      const endTime = new Date('2023-06-01T11:00:00Z');
      const note = 'Reschedule note';

      // Mock the original request
      const mockOriginalRequest = {
        id: requestId,
        senderId: originalSenderId,
        receiverId,
        startTime: new Date('2023-06-01T09:00:00Z'),
        endTime: new Date('2023-06-01T10:00:00Z'),
        note: 'Original notes',
        status: 'pending'
      };

      // Mock the new request
      const mockNewRequest = {
        id: 'new-request-id',
        senderId: receiverId,
        receiverId: originalSenderId,
        startTime,
        endTime,
        note: `Reschedule suggestion for original request. Original notes`,
        status: 'pending'
      };

      // Setup mocks
      (prisma.momentRequest.findFirst as jest.Mock).mockResolvedValue(mockOriginalRequest);
      (prisma.momentRequest.update as jest.Mock).mockResolvedValue({
        ...mockOriginalRequest,
        status: 'rescheduled'
      });
      (prisma.momentRequest.create as jest.Mock).mockResolvedValue(mockNewRequest);

      // Call the service method
      const result = await userService.rescheduleMomentRequest(requestId, receiverId, {
        startTime,
        endTime,
        note
      });

      // Assertions
      expect(prisma.momentRequest.findFirst).toHaveBeenCalledWith({
        where: {
          id: requestId,
          receiverId
        }
      });

      expect(prisma.momentRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          status: 'rescheduled'
        }
      });

      expect(prisma.momentRequest.create).toHaveBeenCalledWith({
        data: {
          senderId: receiverId,
          receiverId: originalSenderId,
          startTime,
          endTime,
          notes: note,
          status: 'pending'
        }
      });

      expect(result).toEqual(mockNewRequest);
    });

    it('should throw an error if the request is not found', async () => {
      // Mock findFirst to return null (request not found)
      (prisma.momentRequest.findFirst as jest.Mock).mockResolvedValue(null);

      // Call the service method and expect it to throw
      await expect(
        userService.rescheduleMomentRequest('non-existent-id', 'receiver-id', {
          startTime: new Date(),
          endTime: new Date()
        })
      ).rejects.toThrow('Moment request not found or you do not have permission');
    });

    it('should throw an error if the request is not pending', async () => {
      // Mock a request that is already approved
      (prisma.momentRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'request-id',
        status: 'approved'
      });

      // Call the service method and expect it to throw
      await expect(
        userService.rescheduleMomentRequest('request-id', 'receiver-id', {
          startTime: new Date(),
          endTime: new Date()
        })
      ).rejects.toThrow('Only pending requests can be rescheduled');
    });

    it('should throw an error if start time is after end time', async () => {
      // Mock a valid request
      (prisma.momentRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'request-id',
        status: 'pending'
      });

      // Call with invalid times
      const startTime = new Date('2023-06-01T11:00:00Z');
      const endTime = new Date('2023-06-01T10:00:00Z');

      await expect(
        userService.rescheduleMomentRequest('request-id', 'receiver-id', {
          startTime,
          endTime
        })
      ).rejects.toThrow('Start time must be before end time');
    });
  });
});
