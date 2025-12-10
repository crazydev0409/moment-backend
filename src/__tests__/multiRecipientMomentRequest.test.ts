// Mock the notification type enum
const mockNotificationType = {
  MOMENT_REQUEST: 'moment-request',
  MOMENT_CREATED: 'moment-created',
  MOMENT_UPDATED: 'moment-updated',
  MOMENT_DELETED: 'moment-deleted',
  MOMENT_SHARED: 'moment-shared',
  MOMENT_REMINDER: 'moment-reminder',
  NEW_CONTACT: 'new-contact'
};

// Mock notification service
jest.mock('../services/notifications/notificationService', () => ({
  __esModule: true,
  NotificationType: mockNotificationType,
  notificationService: {
    sendNotification: jest.fn(),
  },
}));

// Mock prisma client
jest.mock('../services/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    momentRequest: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback()),
  },
}));

// Import after the mocks
import { UserService } from '../services/users/userService';
import prisma from '../services/prisma';
import { mockReset, mockClear } from 'jest-mock-extended';

describe('Multi-Recipient Moment Requests', () => {
  let userService: UserService;
  const mockSenderId = 'sender-123';
  const mockReceiverIds = ['receiver-1', 'receiver-2', 'receiver-3'];
  const mockInvalidReceiverId = 'invalid-receiver';
  const mockSenderData = {
    id: mockSenderId,
    name: 'Test Sender',
    phoneNumber: '+15551234567',
  };
  const mockRequestData = {
    startTime: new Date('2023-06-01T10:00:00Z'),
    endTime: new Date('2023-06-01T11:00:00Z'),
    title: 'Test Moment',
    description: 'Test Description',
  };

  beforeEach(() => {
    userService = new UserService();
    mockReset(prisma.user.findUnique);
    mockReset(prisma.momentRequest.create);
    mockReset(prisma.notification.create);
    jest.clearAllMocks();

    // Mock sender user
    (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
      if (args.where.id === mockSenderId) {
        return Promise.resolve(mockSenderData);
      } else if (args.where.id === mockReceiverIds[0] || args.where.id === mockReceiverIds[1] || args.where.id === mockReceiverIds[2]) {
        return Promise.resolve({
          id: args.where.id,
          name: `Receiver ${args.where.id}`,
          phoneNumber: '+1555987654',
        });
      } else {
        return Promise.resolve(null);
      }
    });

    // Mock momentRequest.create
    (prisma.momentRequest.create as jest.Mock).mockImplementation((args) => {
      return Promise.resolve({
        id: 'request-123',
        senderId: args.data.senderId,
        receiverId: args.data.receiverId,
        startTime: args.data.startTime,
        endTime: args.data.endTime,
        title: args.data.title,
        description: args.data.description,
        status: args.data.status,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: mockSenderData,
        receiver: {
          id: args.data.receiverId,
          name: `Receiver ${args.data.receiverId}`,
          phoneNumber: '+1555987654',
        },
      });
    });

    // Mock userService.isUserBlocked
    jest.spyOn(userService, 'isUserBlocked').mockResolvedValue(false);
  });

  test('should create moment requests for multiple recipients', async () => {
    const result = await userService.createMomentRequestForMultipleRecipients(
      mockSenderId,
      mockReceiverIds,
      mockRequestData
    );

    // Should have 3 successful requests
    expect(result.successful.length).toBe(3);
    expect(result.failed.length).toBe(0);

    // Should have called create 3 times
    expect(prisma.momentRequest.create).toHaveBeenCalledTimes(3);
    
    // Should have called notification service 3 times
    expect(require('../services/notifications/notificationService').notificationService.sendNotification).toHaveBeenCalledTimes(3);
    expect(prisma.notification.create).toHaveBeenCalledTimes(3);
    
    // Check request properties for first recipient
    expect(prisma.momentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderId: mockSenderId,
          receiverId: mockReceiverIds[0],
          notes: mockRequestData.description,
          status: 'pending',
        }),
      })
    );
  });

  test('should handle invalid recipients', async () => {
    // Add an invalid recipient ID
    const mixedReceiverIds = [...mockReceiverIds, mockInvalidReceiverId];
    
    const result = await userService.createMomentRequestForMultipleRecipients(
      mockSenderId,
      mixedReceiverIds,
      mockRequestData
    );

    // Should have 3 successful requests and 1 failed
    expect(result.successful.length).toBe(3);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0]).toBe(mockInvalidReceiverId);
    
    // Should have called create 3 times
    expect(prisma.momentRequest.create).toHaveBeenCalledTimes(3);
    
    // Should have called notification service 3 times
    expect(require('../services/notifications/notificationService').notificationService.sendNotification).toHaveBeenCalledTimes(3);
  });

  test('should handle blocked users', async () => {
    // Mock that the second recipient has blocked the sender
    jest.spyOn(userService, 'isUserBlocked').mockImplementation(async (senderId, receiverId) => {
      return receiverId === mockReceiverIds[1];
    });
    
    const result = await userService.createMomentRequestForMultipleRecipients(
      mockSenderId,
      mockReceiverIds,
      mockRequestData
    );

    // Should have 2 successful requests and 1 failed
    expect(result.successful.length).toBe(2);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0]).toBe(mockReceiverIds[1]);
    
    // Should have called create 2 times
    expect(prisma.momentRequest.create).toHaveBeenCalledTimes(2);
    
    // Should have called notification service 2 times
    expect(require('../services/notifications/notificationService').notificationService.sendNotification).toHaveBeenCalledTimes(2);
  });

  test('should validate input data', async () => {
    // Test with invalid start/end times
    const invalidData = {
      ...mockRequestData,
      startTime: new Date('2023-06-01T11:00:00Z'),
      endTime: new Date('2023-06-01T10:00:00Z'),
    };

    await expect(
      userService.createMomentRequestForMultipleRecipients(mockSenderId, mockReceiverIds, invalidData)
    ).rejects.toThrow('Start time must be before end time');
    
    // Test with empty receiver IDs
    await expect(
      userService.createMomentRequestForMultipleRecipients(mockSenderId, [], mockRequestData)
    ).rejects.toThrow('At least one receiver ID is required');
    
    // Test with invalid sender
    await expect(
      userService.createMomentRequestForMultipleRecipients('invalid-sender', mockReceiverIds, mockRequestData)
    ).rejects.toThrow('Sender user not found');
  });

  test('should skip self-invitations', async () => {
    const receiverIds = [mockSenderId, ...mockReceiverIds];
    
    const result = await userService.createMomentRequestForMultipleRecipients(
      mockSenderId,
      receiverIds,
      mockRequestData
    );

    // Should have 3 successful requests and 1 failed (self-invitation)
    expect(result.successful.length).toBe(3);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0]).toBe(mockSenderId);
    
    // Should have called create 3 times
    expect(prisma.momentRequest.create).toHaveBeenCalledTimes(3);
  });
}); 