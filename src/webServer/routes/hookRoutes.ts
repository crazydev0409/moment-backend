import { Router } from 'express';
import { authenticate } from '../sso';
import { asHandler } from '../../types/express';
import * as hookController from '../controllers/hookController';

const router = Router();

// All hook routes require authentication.
router.use(authenticate);

router.get('/', asHandler(hookController.getHooks));
router.post('/', asHandler(hookController.createHook));

router.get('/mesh', asHandler(hookController.getMeshHooks));
router.get('/user/:userId', asHandler(hookController.getUserOpenHooks));

router.get('/:id', asHandler(hookController.getHook));
router.put('/:id', asHandler(hookController.updateHook));
router.delete('/:id', asHandler(hookController.deleteHook));

router.post('/:id/state', asHandler(hookController.setHookState));

// Participant management (shared hooks)
router.post('/:id/participants', asHandler(hookController.inviteParticipants));
router.post('/:id/respond', asHandler(hookController.respondToHookInvite));
router.delete('/:id/participants/:participantId', asHandler(hookController.removeParticipant));

export default router;
