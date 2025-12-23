import express from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';

const router = express.Router();

// Apply JWT authentication to all user routes
router.use(authenticate);

// User profile routes
router.get('/profile', asHandler(userController.getCurrentUser));
router.put('/profile', asHandler(userController.updateProfile));
router.delete('/account', asHandler(userController.deleteAccount));

// Contact routes
router.get('/contacts', asHandler(userController.getContacts));
router.post('/contacts/import', asHandler(userController.importContacts));
router.post('/contacts/sync', asHandler(userController.syncContacts));


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

/**
 * @swagger
 * /api/users/blocked:
 *   get:
 *     summary: Get list of blocked users
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of blocked users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blockedUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       blocked:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                           phoneNumber:
 *                             type: string
 */
router.get('/blocked', asHandler(userController.getBlockedUsers));

/**
 * @swagger
 * /api/users/block:
 *   post:
 *     summary: Block a user from viewing your calendar
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to block
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/block', asHandler(userController.blockUser));

/**
 * @swagger
 * /api/users/unblock/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to unblock
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       404:
 *         description: Block relationship not found
 *       500:
 *         description: Server error
 */
router.delete('/unblock/:userId', asHandler(userController.unblockUser));

/**
 * @swagger
 * /api/users/contacts/registered:
 *   get:
 *     summary: Get all contacts that are registered users
 *     description: Returns a list of the user's contacts that have accounts on the platform
 *     security:
 *       - bearerAuth: []
 *     tags: [Contacts]
 *     responses:
 *       200:
 *         description: List of registered contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contacts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       contactUserId:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       contactPhone:
 *                         type: string
 *                       contactUser:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                           phoneNumber:
 *                             type: string
 */
router.get('/contacts/registered', asHandler(userController.getRegisteredContacts));

/**
 * @swagger
 * /api/users/moment-requests/multiple:
 *   post:
 *     summary: Create moment requests for multiple recipients at once
 *     description: Sends a moment invitation to multiple users
 *     security:
 *       - bearerAuth: []
 *     tags: [Moments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverIds
 *               - startTime
 *               - endTime
 *               - title
 *             properties:
 *               receiverIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to send the moment request to
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Start time of the moment
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: End time of the moment
 *               title:
 *                 type: string
 *                 description: Title of the moment
 *               description:
 *                 type: string
 *                 description: Optional description of the moment
 *     responses:
 *       200:
 *         description: Moment requests created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   properties:
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     failedReceiverIds:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.post('/moment-requests/multiple', asHandler(userController.createMomentRequestMultiple));

export default router;
