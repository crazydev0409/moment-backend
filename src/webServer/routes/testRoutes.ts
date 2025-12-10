import express from 'express';
import * as userController from '../controllers/userController';
import { asHandler } from '../../types/express';

const router = express.Router();

// Test route for multi-recipient moment requests (no authentication)
router.post('/moment-requests/multiple', asHandler(userController.testMultiRecipientMomentRequest));

export default router; 