import { EventHandler, BaseEvent } from '../types/Event';
import { handleEventForWebSocket } from '../../webServer/socket';

/**
 * Event handler that broadcasts events via WebSocket to connected clients
 */
export class WebSocketEventHandler {
  handleEvent: EventHandler = async (event: BaseEvent) => {
    try {
      // Broadcast event via WebSocket
      handleEventForWebSocket(event);
    } catch (error) {
      console.error('[WebSocketEventHandler] Failed to broadcast event via WebSocket:', error);
      // Don't throw - WebSocket broadcast failure shouldn't break the event flow
    }
  };
}

