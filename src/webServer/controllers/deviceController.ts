import { CustomRequestHandler } from '../../types/express';
import { UserDeviceRepository } from '../../repositories/UserDeviceRepository';
import { validatePhoneNumber } from '../../utils/validation';
import prisma from '../../services/prisma';
import * as jwt from 'jsonwebtoken';
import { jwtSecret } from '../../config/config';

const deviceRepo = new UserDeviceRepository();

/**
 * Register or update a user's device
 */
export const registerDevice: CustomRequestHandler = async (req, res) => {
  try {
    const { deviceId, platform, appVersion, rememberMe } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!deviceId || !platform || !appVersion) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, platform, appVersion'
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
      deviceId,
      platform,
      appVersion,
      rememberMe: rememberMe || false
    });

    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        deviceId: device.id,
        lastSeen: device.lastSeen
      }
    });

  } catch (error: any) {
    console.error('Device registration error:', error);
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
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    await deviceRepo.updateDeviceLastSeen(deviceId);

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

/**
 * Check if device is registered with remember me enabled
 */
export const checkDeviceRegistration: CustomRequestHandler = async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    const user = await deviceRepo.getUserByDeviceId(deviceId);

    if (!user) {
      return res.json({
        success: true,
        registered: false,
        message: 'Device not registered or remember me not enabled'
      });
    }

    // Generate access token for the user
    const accessToken = jwt.sign({ id: user.id, phoneNumber: user.phoneNumber }, jwtSecret, { expiresIn: '10000d' });

    res.json({
      success: true,
      registered: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        bio: user.bio,
        birthday: user.birthday,
        timezone: user.timezone,
        meetingTypes: user.meetingTypes
      },
      accessToken
    });
  } catch (error: any) {
    console.error('Check device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check device registration'
    });
  }
};

/**
 * Update remember me preference for a device
 */
export const updateRememberMe: CustomRequestHandler = async (req, res) => {
  try {
    const { deviceId, rememberMe } = req.body;
    const userId = req.user!.id;

    if (!deviceId || rememberMe === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and remember me preference are required'
      });
    }

    await deviceRepo.updateRememberMe(deviceId, userId, rememberMe);

    res.json({
      success: true,
      message: 'Remember me preference updated'
    });
  } catch (error: any) {
    console.error('Update remember me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update remember me preference'
    });
  }
};
