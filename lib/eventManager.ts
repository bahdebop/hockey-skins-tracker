// Server-Sent Events manager for real-time game updates
type EventCallback = (data: any) => void;

class EventManager {
  private connections: Map<string, Set<EventCallback>> = new Map();

  subscribe(gameId: string, callback: EventCallback) {
    if (!this.connections.has(gameId)) {
      this.connections.set(gameId, new Set());
    }
    this.connections.get(gameId)!.add(callback);
    
    console.log(`Client subscribed to game ${gameId}. Total: ${this.connections.get(gameId)!.size}`);
  }

  unsubscribe(gameId: string, callback: EventCallback) {
    const callbacks = this.connections.get(gameId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.connections.delete(gameId);
      }
      console.log(`Client unsubscribed from game ${gameId}`);
    }
  }

  broadcast(gameId: string, event: string, data: any) {
    const callbacks = this.connections.get(gameId);
    if (callbacks && callbacks.size > 0) {
      console.log(`Broadcasting ${event} to ${callbacks.size} clients for game ${gameId}`);
      callbacks.forEach(callback => {
        try {
          callback({ event, data });
        } catch (error) {
          console.error('Error broadcasting to client:', error);
        }
      });
    }
  }

  getConnectionCount(gameId: string): number {
    return this.connections.get(gameId)?.size || 0;
  }
}

// Singleton instance
export const eventManager = new EventManager();
