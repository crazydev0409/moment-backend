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

export default router;
