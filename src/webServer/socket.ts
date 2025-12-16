import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { BaseEvent, EventType } from '../events/types/Event';

// Extend Socket interface to include user info
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// Map to store user ID to socket IDs (one user can have multiple devices)
const userSocketMap = new Map<string, Set<string>>();

// Map to store socket ID to user ID
const socketUserMap = new Map<string, string>();

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initializeSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domain
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return next(new Error('JWT_SECRET not configured'));
      }

      const decoded = jwt.verify(token, jwtSecret) as { id: string; phoneNumber: string };
      socket.userId = decoded.id;
      
      next();
    } catch (error) {
      console.error('[SocketIO] Authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const socketId = socket.id;

    console.log(`[SocketIO] User ${userId} connected (socket: ${socketId})`);

    // Add socket to user mapping
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)!.add(socketId);
    socketUserMap.set(socketId, userId);

    // Handle ping/pong for connection health
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ status: 'pong', timestamp: new Date().toISOString() });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[SocketIO] User ${userId} disconnected (socket: ${socketId})`);
      
      // Remove socket from mappings
      const userSockets = userSocketMap.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          userSocketMap.delete(userId);
        }
      }
      socketUserMap.delete(socketId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[SocketIO] Socket error for user ${userId}:`, error);
    });
  });

  console.log('[SocketIO] Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO instance
 */
export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO() first.');
  }
  return io;
}

/**
 * Broadcast event to specific user(s)
 */
export function broadcastToUser(userId: string, event: string, data: any): void {
  if (!io) {
    console.warn('[SocketIO] Cannot broadcast: Socket.IO not initialized');
    return;
  }

  const sockets = userSocketMap.get(userId);
  if (sockets && sockets.size > 0) {
    sockets.forEach(socketId => {
      io!.to(socketId).emit(event, data);
    });
    console.log(`[SocketIO] Broadcasted ${event} to user ${userId} (${sockets.size} socket(s))`);
  } else {
    console.log(`[SocketIO] User ${userId} not connected, skipping broadcast`);
  }
}

/**
 * Broadcast event to multiple users
 */
export function broadcastToUsers(userIds: string[], event: string, data: any): void {
  userIds.forEach(userId => broadcastToUser(userId, event, data));
}

/**
 * Broadcast event to all connected clients
 */
export function broadcastToAll(event: string, data: any): void {
  if (!io) {
    console.warn('[SocketIO] Cannot broadcast: Socket.IO not initialized');
    return;
  }

  io.emit(event, data);
  console.log(`[SocketIO] Broadcasted ${event} to all connected clients`);
}

/**
 * Handle events from the event bus and broadcast via WebSocket
 */
export function handleEventForWebSocket(event: BaseEvent): void {
  if (!io) {
    console.warn('[SocketIO] Cannot handle event: Socket.IO not initialized');
    return;
  }

  const userId = event.metadata?.userId;
  if (!userId) {
    console.warn('[SocketIO] Event missing userId, skipping WebSocket broadcast');
    return;
  }

  console.log(`[SocketIO] 📨 Handling event for WebSocket: ${event.type}`, {
    eventType: event.type,
    metadataUserId: userId,
    payload: event.payload
  });

  // Map event types to Socket.IO event names
  let socketEvent: string;
  let targetUserIds: string[] = [userId];

  switch (event.type) {
    case EventType.MOMENT_REQUEST_CREATED:
      // Meeting created → notify receiver
      socketEvent = 'moment:request';
      targetUserIds = [event.payload.receiverId];
      console.log(`[SocketIO] 📬 MOMENT_REQUEST_CREATED - notifying receiver: ${event.payload.receiverId}`);
      break;

    case EventType.MOMENT_REQUEST_APPROVED:
    case EventType.MOMENT_REQUEST_REJECTED:
      // Meeting accepted/rejected → notify sender
      socketEvent = 'moment:response';
      targetUserIds = [event.payload.senderId];
      console.log(`[SocketIO] ✅ MOMENT_REQUEST_${event.type === EventType.MOMENT_REQUEST_APPROVED ? 'APPROVED' : 'REJECTED'} - notifying sender: ${event.payload.senderId}`);
      break;

    case EventType.MOMENT_DELETED:
      // Meeting canceled → notify receiver (only if from moment request)
      // When canceling, we publish MOMENT_DELETED with otherUserId = receiver
      if (event.payload.otherUserId && event.payload.momentRequestId) {
        socketEvent = 'moment:canceled';
        // Notify only the receiver (otherUserId), not the one who canceled
        targetUserIds = [event.payload.otherUserId];
        console.log(`[SocketIO] ❌ MOMENT_DELETED (canceled) - notifying receiver: ${event.payload.otherUserId}`);
      } else {
        // Regular moment deletion (not from cancel) - skip socket notification
        // This shouldn't happen for moment requests, but handle gracefully
        console.log(`[SocketIO] 🗑️ MOMENT_DELETED (regular) - skipping socket notification`);
        return; // Don't send socket event for regular moment deletions
      }
      break;

    default:
      // Skip all other events - we only handle the 3 required ones
      console.log(`[SocketIO] ⏭️ Skipping event type: ${event.type}`);
      return;
  }

  console.log(`[SocketIO] 📤 Broadcasting ${socketEvent} to users:`, {
    socketEvent,
    targetUserIds,
    userCount: targetUserIds.length
  });

  // Broadcast to target users
  broadcastToUsers(targetUserIds, socketEvent, {
    eventType: event.type,
    ...event.payload,
    timestamp: event.timestamp
  });

  console.log(`[SocketIO] ✅ Completed broadcasting ${socketEvent} event`);
}

/**
 * Get connected user count
 */
export function getConnectedUserCount(): number {
  return userSocketMap.size;
}

/**
 * Check if user is connected
 */
export function isUserConnected(userId: string): boolean {
  return userSocketMap.has(userId) && userSocketMap.get(userId)!.size > 0;
}

