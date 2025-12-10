import { Router } from 'express';
import * as healthController from '../controllers/healthController';
import { asHandler } from '../../types/express';

const router = Router();

// Health check route
router.get('/', asHandler(healthController.healthCheck));

export default router;
