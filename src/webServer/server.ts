import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger';
import passport from './auth/passport';
import routes from './routes';
import paymentWebhookRoutes from './routes/paymentWebhookRoutes';
import http from 'http';
import { initializeEventSystem, shutdownEventSystem } from '../events';
import { MaintenanceScheduler } from '../jobs/MaintenanceScheduler';
import { initializeSocketIO } from './socket';
import { UPLOADS_ROOT } from '../utils/uploadsDir';

// Create Express app
export const app = express();

// Azure App Service terminates TLS at its edge and forwards the original
// scheme/host via X-Forwarded-* headers — without trusting the proxy,
// req.protocol always reports 'http' even in production, which would make
// any absolute URL built from it (e.g. an uploaded avatar's URL) wrong.
app.set('trust proxy', true);

// Create HTTP server
const server = http.createServer(app);

// Global instances
let maintenanceScheduler: MaintenanceScheduler | null = null;

// Stripe webhook signature verification needs the raw, unparsed request body.
// This MUST be registered before the global express.json() below, and at the
// exact literal path Stripe is configured to POST to (dashboard webhook URL:
// https://moment-backend.azurewebsites.net/api/payments/webhook) — it's
// mounted directly on `app` rather than nested under routes/index.ts so it
// can get express.raw() instead of express.json().
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhookRoutes);

// Middleware
app.use(express.json());
app.use(passport.initialize());

// Uploaded files (avatars, etc.) — served from wherever uploadsDir.ts
// resolved to (persistent Azure /home storage in production, ./uploads
// locally).
app.use('/uploads', express.static(UPLOADS_ROOT));

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
