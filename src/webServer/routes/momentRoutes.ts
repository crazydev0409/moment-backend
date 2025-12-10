import { Router } from 'express';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';
import * as momentController from '../controllers/momentController';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Moment routes
router.get('/', asHandler(momentController.getMoments));
router.post('/', asHandler(momentController.createMoment));
router.put('/:id', asHandler(momentController.updateMoment));
router.delete('/:id', asHandler(momentController.deleteMoment));
router.post('/:id/share', asHandler(momentController.shareMoment));


// Other user's calendar route
router.get('/user/:userId', asHandler(momentController.getUserCalendar));

/**
 * @swagger
 * /api/moments/{id}/share:
 *   post:
 *     summary: Share a moment with specific contacts
 *     security:
 *       - bearerAuth: []
 *     tags: [Moments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Moment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contactIds
 *             properties:
 *               contactIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of contact user IDs to share with
 *     responses:
 *       200:
 *         description: Moment shared successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

export default router;
