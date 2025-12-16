import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger';
import passport from './auth/passport';
import routes from './routes';
import http from 'http';
import { initializeEventSystem, shutdownEventSystem } from '../events';
import { MaintenanceScheduler } from '../jobs/MaintenanceScheduler';
import { initializeSocketIO } from './socket';

// Create Express app
export const app = express();

// Create HTTP server
const server = http.createServer(app);

// Global instances
let maintenanceScheduler: MaintenanceScheduler | null = null;

// Middleware
app.use(express.json());
app.use(passport.initialize());

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount all routes
app.use('/api', routes);

// Initialize event system and start server
async function startServer() {
  try {
    console.log('[Server] Initializing Socket.IO...');
    initializeSocketIO(server);
    
    console.log('[Server] Initializing event system...');
    await initializeEventSystem();
    
    console.log('[Server] Starting maintenance scheduler...');
    maintenanceScheduler = new MaintenanceScheduler();
    maintenanceScheduler.start();

    // Only start server automatically if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Start server
      const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
      server.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`📊 Event Bus: ${process.env.EVENT_BUS_ADAPTER || 'memory'}`);
        console.log(`📱 Push Notifications: Expo`);
        console.log(`🔌 WebSocket: Socket.IO enabled`);
        console.log(`🔧 Maintenance Jobs: Active`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      });
    }
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('[Server] Shutting down gracefully...');
  
  try {
    if (maintenanceScheduler) {
      maintenanceScheduler.stop();
    }
    
    await shutdownEventSystem();
    
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();
