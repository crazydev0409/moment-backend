import { Router } from 'express';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';
import * as hookController from '../controllers/hookController';

const router = Router();

// All hook routes require authentication.
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Hooks
 *   description: Reusable scheduling primitives (meeting / service / listing templates)
 */

/**
 * @swagger
 * /api/hooks:
 *   get:
 *     summary: List the authenticated user's hooks (owned + accepted shared)
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *     parameters:
 *       - in: query
 *         name: accessLevel
 *         schema: { type: string, enum: [personal, open, shared] }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [active, paused] }
 *       - in: query
 *         name: grouped
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: When 'true', returns hooks bucketed by group instead of a flat list
 *     responses:
 *       200: { description: List of hooks }
 *   post:
 *     summary: Create a hook
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *     responses:
 *       201: { description: Hook created }
 *       400: { description: Invalid request }
 */
router.get('/', asHandler(hookController.getHooks));
router.post('/', asHandler(hookController.createHook));

/**
 * @swagger
 * /api/hooks/user/{userId}:
 *   get:
 *     summary: View another user's open hooks (for booking / contact profile)
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of the user's open hooks }
 *       403: { description: Blocked }
 *       404: { description: User not found }
 */
router.get('/mesh', asHandler(hookController.getMeshHooks));
router.get('/user/:userId', asHandler(hookController.getUserOpenHooks));

/**
 * @swagger
 * /api/hooks/{id}:
 *   get:
 *     summary: Get a single hook
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Hook }
 *       403: { description: No permission }
 *       404: { description: Not found }
 *   put:
 *     summary: Update a hook (owner only)
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *   delete:
 *     summary: Delete a hook (owner only)
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 */
router.get('/:id', asHandler(hookController.getHook));
router.put('/:id', asHandler(hookController.updateHook));
router.delete('/:id', asHandler(hookController.deleteHook));

/**
 * @swagger
 * /api/hooks/{id}/state:
 *   post:
 *     summary: Pause or resume a hook (owner only)
 *     security: [{ bearerAuth: [] }]
 *     tags: [Hooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               state: { type: string, enum: [active, paused] }
 */
router.post('/:id/state', asHandler(hookController.setHookState));

// Participant management (shared hooks)
router.post('/:id/participants', asHandler(hookController.inviteParticipants));
router.post('/:id/respond', asHandler(hookController.respondToHookInvite));
router.delete('/:id/participants/:participantId', asHandler(hookController.removeParticipant));

export default router;
