// src/eventEmitter.js — singleton pub/sub

class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ handler, once: false });
    return this;
  }

  once(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ handler, once: true });
    return this;
  }

  off(event, handler) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(
      l => l.handler !== handler
    );
    return this;
  }

  emit(event, data) {
    const listeners = this._listeners[event];
    if (listeners) {
      const toRemove = [];
      for (const l of listeners) {
        l.handler(data);
        if (l.once) toRemove.push(l);
      }
      if (toRemove.length) {
        this._listeners[event] = listeners.filter(l => !toRemove.includes(l));
      }
    }

    // Wildcard: nasłuch wszystkich zdarzeń (np. auto-zapis stanu gry)
    if (event !== '*') {
      const wildcards = this._listeners['*'];
      if (wildcards) {
        for (const l of wildcards) l.handler({ event, data });
      }
    }
    return this;
  }

  clear(event) {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
    return this;
  }
}

export const emitter = new EventEmitter();
