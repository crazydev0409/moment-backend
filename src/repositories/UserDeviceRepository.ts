import prisma from '../services/prisma';
import { v4 as uuidv4 } from 'uuid';

export interface UserDevice {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
  deviceId: string;
  appVersion: string;
  expoVersion: string;
  isActive: boolean;
  rememberMe: boolean;
  lastSeen: Date;
  lastTokenRefresh: Date;
  tokenValidationStatus: TokenStatus;
  failureCount: number;
  createdAt: Date;
}

export enum TokenStatus {
  ACTIVE = 'active',
  SUSPECTED_INVALID = 'suspected_invalid',
  CONFIRMED_INVALID = 'confirmed_invalid',
  TEMPORARILY_DISABLED = 'temporarily_disabled'
}

export class UserDeviceRepository {
  async registerOrUpdateDevice(
    userId: string,
    deviceData: Partial<UserDevice>
  ): Promise<UserDevice> {
    const now = new Date();

    // Try to find existing device by deviceId first
    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId: deviceData.deviceId
      }
    });

    if (existingDevice) {
      // Update existing device with new token
      return await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          expoPushToken: deviceData.expoPushToken,
          appVersion: deviceData.appVersion,
          expoVersion: deviceData.expoVersion,
          rememberMe: deviceData.rememberMe !== undefined ? deviceData.rememberMe : existingDevice.rememberMe,
          lastSeen: now,
          lastTokenRefresh: now,
          tokenValidationStatus: TokenStatus.ACTIVE,
          failureCount: 0, // Reset failure count on token refresh
          isActive: true
        }
      }) as UserDevice;
    } else {
      // Create new device record
      return await prisma.userDevice.create({
        data: {
          id: uuidv4(),
          userId,
          expoPushToken: deviceData.expoPushToken!,
          platform: deviceData.platform!,
          deviceId: deviceData.deviceId!,
          appVersion: deviceData.appVersion!,
          expoVersion: deviceData.expoVersion!,
          isActive: true,
          rememberMe: deviceData.rememberMe || false,
          lastSeen: now,
          lastTokenRefresh: now,
          tokenValidationStatus: TokenStatus.ACTIVE,
          failureCount: 0,
          createdAt: now
        }
      }) as UserDevice;
    }
  }

  async markTokenAsInvalid(expoPushToken: string, reason: string): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { expoPushToken },
      data: {
        tokenValidationStatus: TokenStatus.CONFIRMED_INVALID,
        isActive: false,
        failureCount: { increment: 1 }
      }
    });

    console.log(`Marked token as invalid: ${expoPushToken}, reason: ${reason}`);
  }

  async incrementFailureCount(expoPushToken: string): Promise<void> {
    const device = await prisma.userDevice.findFirst({
      where: { expoPushToken }
    });

    if (!device) return;

    const newFailureCount = device.failureCount + 1;
    let newStatus = device.tokenValidationStatus;

    // Progressive degradation based on failure count
    if (newFailureCount >= 3 && newFailureCount < 5) {
      newStatus = TokenStatus.SUSPECTED_INVALID;
    } else if (newFailureCount >= 5) {
      newStatus = TokenStatus.CONFIRMED_INVALID;
    }

    await prisma.userDevice.update({
      where: { id: device.id },
      data: {
        failureCount: newFailureCount,
        tokenValidationStatus: newStatus,
        isActive: newStatus !== TokenStatus.CONFIRMED_INVALID
      }
    });
  }

  async getHealthyDevicesForUser(userId: string): Promise<UserDevice[]> {
    return await prisma.userDevice.findMany({
      where: {
        userId,
        isActive: true,
        tokenValidationStatus: {
          in: [TokenStatus.ACTIVE, TokenStatus.SUSPECTED_INVALID]
        },
        lastSeen: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    }) as UserDevice[];
  }

  async removeDevicesByTokens(tokens: string[]): Promise<void> {
    await prisma.userDevice.deleteMany({
      where: {
        expoPushToken: { in: tokens }
      }
    });
  }

  async deactivateDevice(deviceId: string, userId: string): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { deviceId, userId },
      data: { isActive: false }
    });
  }

  async updateDeviceLastSeen(expoPushToken: string): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { expoPushToken },
      data: { lastSeen: new Date() }
    });
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  async cleanupStaleTokens(): Promise<number> {
    // Remove tokens that haven't been refreshed in 90 days or are confirmed invalid for 7+ days
    const result = await prisma.userDevice.deleteMany({
      where: {
        OR: [
          {
            tokenValidationStatus: TokenStatus.CONFIRMED_INVALID,
            createdAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days
            }
          },
          {
            lastTokenRefresh: {
              lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days
            }
          }
        ]
      }
    });

    console.log(`Cleaned up ${result.count} stale tokens`);
    return result.count;
  }

  async getSuspectedInvalidDevices(): Promise<UserDevice[]> {
    return await prisma.userDevice.findMany({
      where: {
        tokenValidationStatus: TokenStatus.SUSPECTED_INVALID,
        isActive: true
      },
      take: 100 // Limit to avoid rate limits
    }) as UserDevice[];
  }

  async markTokenAsActive(deviceId: string): Promise<void> {
    await prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        tokenValidationStatus: TokenStatus.ACTIVE,
        failureCount: 0
      }
    });
  }

  async getDeviceByDeviceId(deviceId: string): Promise<UserDevice | null> {
    return await prisma.userDevice.findFirst({
      where: {
        deviceId,
        isActive: true,
        rememberMe: true
      }
    }) as UserDevice | null;
  }

  async getUserByDeviceId(deviceId: string): Promise<any | null> {
    const device = await prisma.userDevice.findFirst({
      where: {
        deviceId,
        isActive: true,
        rememberMe: true
      },
      include: {
        user: true
      }
    });

    return device?.user || null;
  }

  async updateRememberMe(deviceId: string, userId: string, rememberMe: boolean): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { deviceId, userId },
      data: { rememberMe }
    });
  }
}
