import type { SSEEvent } from "../types";

type SSEListener = (event: SSEEvent) => void;

class SSEEmitter {
  private listeners: Set<SSEListener> = new Set();

  subscribe(listener: SSEListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: SSEEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const sseEmitter = new SSEEmitter();
