/**
 * In-memory pub/sub event bus for real-time application events.
 * Singleton instance shared across the server runtime.
 *
 * **Important — serverless limitations:**
 * This event bus is purely in-memory and does NOT persist or share state
 * across serverless function invocations. In platforms like Vercel where each
 * request may run in an isolated instance, subscribers in one instance will
 * not receive events published in another.
 *
 * This implementation is suitable for:
 * - Local development
 * - Single-server / long-lived Node.js deployments
 *
 * For production deployments on serverless platforms, replace this with a
 * distributed pub/sub system such as Redis pub/sub, Ably, or Pusher.
 */

export interface AppEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  owner: string;
  repo: string;
}

export type EventHandler = (event: AppEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to events on a specific channel (e.g. "owner/repo").
   *
   * @returns An unsubscribe function. Safe to call multiple times — subsequent
   *          calls after the first are no-ops.
   */
  subscribe(channel: string, handler: EventHandler): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(handler);

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      const handlers = this.listeners.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(channel);
        }
      }
    };
  }

  /**
   * Publish an event to all subscribers on a channel.
   */
  publish(channel: string, event: AppEvent): void {
    const handlers = this.listeners.get(channel);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler error on channel "${channel}" for event "${event.type}":`, err);
      }
    }
  }

  /**
   * Get the number of active subscribers for a channel (useful for debugging).
   */
  subscriberCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }
}

// Singleton — survives across requests in the same server process
export const eventBus = new EventBus();
