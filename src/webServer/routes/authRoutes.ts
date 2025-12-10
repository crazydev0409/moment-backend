import { Router } from 'express';
import * as authController from '../controllers/authController';
import { asHandler } from '../../types/express';

const router = Router();

// Auth routes
router.post('/register', asHandler(authController.register));
router.post('/generate-otp', asHandler(authController.generateOtp));
router.post('/verify', asHandler(authController.verify));
router.post('/refresh', asHandler(authController.refreshToken));
router.post('/logout', asHandler(authController.logout));

export default router;
