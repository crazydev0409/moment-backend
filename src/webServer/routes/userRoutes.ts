import express from 'express';
import * as userController from '../controllers/userController';
import * as calendarController from '../controllers/calendarController';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';

const router = express.Router();

// OAuth callbacks must remain public because they are invoked by provider redirects
router.get(
  '/calendar-integrations/:provider/callback',
  asHandler(calendarController.handleCalendarOAuthCallback),
);

// Apply JWT authentication to all remaining user routes
router.use(authenticate);

// User profile routes
router.get('/profile', asHandler(userController.getCurrentUser));
router.put('/profile', asHandler(userController.updateProfile));
router.post('/profile/avatar', userController.avatarUpload, asHandler(userController.uploadAvatar));
router.delete('/account', asHandler(userController.deleteAccount));

router.post('/change-email/start', asHandler(userController.startEmailChange));

router.post('/change-email/confirm', asHandler(userController.confirmEmailChange));

router.post('/change-phone/start', asHandler(userController.startPhoneChange));

router.post('/change-phone/confirm', asHandler(userController.confirmPhoneChange));

// Contact routes
router.get('/contacts', asHandler(userController.getContacts));
router.post('/contacts/import', asHandler(userController.importContacts));
router.post('/contacts/sync', asHandler(userController.syncContacts));
router.patch('/contacts/:id', asHandler(userController.patchContact));
router.delete('/contacts/:id', asHandler(userController.deleteContact));

// Calendar integration routes
router.get('/calendar-integrations', asHandler(calendarController.listCalendarIntegrations));
router.post('/calendar-integrations/:provider/start', asHandler(calendarController.startCalendarOAuth));
router.post('/calendar-integrations/icloud/connect', asHandler(calendarController.connectIcloudIntegration));
router.post('/calendar-integrations/:provider/sync', asHandler(calendarController.syncCalendarIntegration));
router.delete('/calendar-integrations/:provider', asHandler(calendarController.disconnectCalendarIntegration));

// Bookable profiles, availability, and merged calendar events
router.get('/bookable/:userId', asHandler(calendarController.getBookableUser));
router.get('/availability', asHandler(calendarController.getAvailability));
router.get('/:userId/availability', asHandler(calendarController.getUserAvailability));
router.put('/availability', asHandler(calendarController.updateAvailability));
router.get('/calendar-events', asHandler(calendarController.getMyCalendarEvents));
router.get('/:userId/calendar-events', asHandler(calendarController.getUserCalendarEvents));

// Moment request routes
router.post('/moment-requests', asHandler(userController.createMomentRequest));
router.get('/moment-requests/received', asHandler(userController.getReceivedMomentRequests));
router.get('/moment-requests/pending', asHandler(userController.getPendingMomentRequests));
router.get('/moment-requests/sent', asHandler(userController.getSentMomentRequests));
router.get('/:userId/moment-requests', asHandler(userController.getUserMomentRequests));
router.post('/moment-requests/:requestId/respond', asHandler(userController.respondToMomentRequest));
router.post('/moment-requests/:requestId/reschedule', asHandler(userController.rescheduleMomentRequest));
router.delete('/moment-requests/:requestId', asHandler(userController.cancelMomentRequest));

// Add these routes
router.get('/notifications', asHandler(userController.getUserNotifications));
router.post('/notifications/read', asHandler(userController.markNotificationsAsRead));
router.post('/notifications/read-all', asHandler(userController.markAllNotificationsAsRead));

// Add the test notification endpoint
router.post('/notifications/test', asHandler(userController.sendTestNotification));

router.get('/blocked', asHandler(userController.getBlockedUsers));

router.post('/block', asHandler(userController.blockUser));

router.delete('/unblock/:userId', asHandler(userController.unblockUser));

router.get('/contacts/registered', asHandler(userController.getRegisteredContacts));

router.post('/moment-requests/multiple', asHandler(userController.createMomentRequestMultiple));

export default router;
