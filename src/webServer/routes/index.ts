import { Router } from 'express';
import authRoutes from './authRoutes';
import momentRoutes from './momentRoutes';
import healthRoutes from './healthRoutes';
import userRoutes from './userRoutes';
import deviceRoutes from './deviceRoutes';
import hookRoutes from './hookRoutes';
import testRoutes from './testRoutes';
import paymentRoutes from './paymentRoutes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/moments', momentRoutes);
router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/devices', deviceRoutes);
router.use('/hooks', hookRoutes);
router.use('/test', testRoutes);
router.use('/payments', paymentRoutes);

export default router;
