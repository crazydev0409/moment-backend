import prisma from '../services/prisma';
import { v4 as uuidv4 } from 'uuid';

export interface UserDevice {
  id: string;
  userId: string;
  platform: 'ios' | 'android';
  deviceId: string;
  appVersion: string;
  isActive: boolean;
  rememberMe: boolean;
  lastSeen: Date;
  createdAt: Date;
}

export class UserDeviceRepository {
  async registerOrUpdateDevice(
    userId: string,
    deviceData: Partial<UserDevice>
  ): Promise<UserDevice> {
    const now = new Date();

    // Try to find existing device by deviceId and userId
    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId: deviceData.deviceId
      }
    });

    if (existingDevice) {
      // Update existing device
      return await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          appVersion: deviceData.appVersion,
          rememberMe: deviceData.rememberMe !== undefined ? deviceData.rememberMe : existingDevice.rememberMe,
          lastSeen: now,
          isActive: true
        }
      }) as UserDevice;
    } else {
      // Create new device record
      return await prisma.userDevice.create({
        data: {
          id: uuidv4(),
          userId,
          platform: deviceData.platform!,
          deviceId: deviceData.deviceId!,
          appVersion: deviceData.appVersion!,
          isActive: true,
          rememberMe: deviceData.rememberMe || false,
          lastSeen: now,
          createdAt: now
        }
      }) as UserDevice;
    }
  }

  async getHealthyDevicesForUser(userId: string): Promise<UserDevice[]> {
    return await prisma.userDevice.findMany({
      where: {
        userId,
        isActive: true,
        lastSeen: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    }) as UserDevice[];
  }

  async deactivateDevice(deviceId: string, userId: string): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { deviceId, userId },
      data: { isActive: false }
    });
  }

  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    await prisma.userDevice.updateMany({
      where: { deviceId },
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
