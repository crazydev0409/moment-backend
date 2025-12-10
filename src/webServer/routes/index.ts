import { Router } from 'express';
import authRoutes from './authRoutes';
import momentRoutes from './momentRoutes';
import healthRoutes from './healthRoutes';
import userRoutes from './userRoutes';
import deviceRoutes from './deviceRoutes';
import testRoutes from './testRoutes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/moments', momentRoutes);
router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/devices', deviceRoutes);
router.use('/test', testRoutes);

export default router;
