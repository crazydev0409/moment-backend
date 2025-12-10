import { CustomRequestHandler } from '../../types/express';
import { UserDeviceRepository } from '../../repositories/UserDeviceRepository';
import { validatePhoneNumber } from '../../utils/validation';
import prisma from '../../services/prisma';

const deviceRepo = new UserDeviceRepository();

/**
 * Register or update a user's device with Expo push token
 */
export const registerDevice: CustomRequestHandler = async (req, res) => {
  try {
    const { expoPushToken, deviceId, platform, appVersion, expoVersion } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!expoPushToken || !deviceId || !platform || !appVersion || !expoVersion) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: expoPushToken, deviceId, platform, appVersion, expoVersion'
      });
    }

    // Validate platform
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be either "ios" or "android"'
      });
    }

    // Register/update device
    const device = await deviceRepo.registerOrUpdateDevice(userId, {
      expoPushToken,
      deviceId,
      platform,
      appVersion,
      expoVersion
    });

    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        deviceId: device.id,
        status: device.tokenValidationStatus,
        lastTokenRefresh: device.lastTokenRefresh
      }
    });

  } catch (error: any) {
    console.error('Device registration error:', error);
    
    if (error.code === 'P2002') { // Prisma unique constraint error
      return res.status(409).json({
        success: false,
        message: 'This push token is already registered to another device'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to register device'
    });
  }
};

/**
 * Get all devices registered for the current user
 */
export const getUserDevices: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const devices = await deviceRepo.getHealthyDevicesForUser(userId);

    res.json({
      success: true,
      data: {
        devices: devices.map(device => ({
          id: device.id,
          deviceId: device.deviceId,
          platform: device.platform,
          appVersion: device.appVersion,
          isActive: device.isActive,
          lastSeen: device.lastSeen,
          status: device.tokenValidationStatus,
          createdAt: device.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Get user devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve devices'
    });
  }
};

/**
 * Deactivate a specific device
 */
export const deactivateDevice: CustomRequestHandler = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    await deviceRepo.deactivateDevice(deviceId, userId);

    res.json({
      success: true,
      message: 'Device deactivated successfully'
    });

  } catch (error) {
    console.error('Device deactivation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate device'
    });
  }
};

/**
 * Update device activity (last seen timestamp)
 */
export const updateDeviceActivity: CustomRequestHandler = async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    
    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'Expo push token is required'
      });
    }

    await deviceRepo.updateDeviceLastSeen(expoPushToken);

    res.json({
      success: true,
      message: 'Device activity updated'
    });

  } catch (error) {
    console.error('Update device activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device activity'
    });
  }
};

/**
 * Test notification endpoint for development
 */
export const testNotification: CustomRequestHandler = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoint not available in production'
      });
    }

    const { getEventSystem } = await import('../../events');
    const { eventPublisher } = getEventSystem();
    const userId = req.user!.id;

    // Publish a test event
    await eventPublisher.publishTestEvent(userId, {
      contactUserId: userId,
      contactOwnerId: userId,
      contactName: 'Test Contact',
      phoneNumber: req.user!.phoneNumber
    });

    res.json({
      success: true,
      message: 'Test notification sent'
    });

  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
};

/**
 * Get notification history for the user
 */
export const getNotifications: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.notification.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalCount: total
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationRead: CustomRequestHandler = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.id;
    
    await prisma.notification.updateMany({
      where: { 
        id: notificationId,
        userId
      },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};
