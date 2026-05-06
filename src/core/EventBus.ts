type EventCallback = (data?: any) => void;

export class EventBus {
  private static listeners: Map<string, EventCallback[]> = new Map();

  static on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  static off(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event)!.filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  static emit(event: string, data?: any) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event)!.forEach(callback => callback(data));
  }
}
