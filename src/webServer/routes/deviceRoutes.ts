import { Router } from 'express';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';
import * as deviceController from '../controllers/deviceController';

const router = Router();

// Apply authentication to all device routes
router.use(authenticate);

// Device management routes
router.post('/register', asHandler(deviceController.registerDevice));
router.get('/', asHandler(deviceController.getUserDevices));
router.delete('/:deviceId', asHandler(deviceController.deactivateDevice));
router.patch('/activity', asHandler(deviceController.updateDeviceActivity));

// Notification management routes
router.get('/notifications', asHandler(deviceController.getNotifications));
router.patch('/notifications/:notificationId/read', asHandler(deviceController.markNotificationRead));

// Development/testing routes
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-notification', asHandler(deviceController.testNotification));
}

export default router;
