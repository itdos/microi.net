/**
 * 事件总线
 * utils/eventBus.js
 */
import { EventEmitter } from 'events';

class MicroiEventBus extends EventEmitter {
    off(eventName, listener) {
        if (typeof listener === "function") {
            return super.off(eventName, listener);
        }
        return eventName ? this.removeAllListeners(eventName) : this.removeAllListeners();
    }
}

export const EventBus = new MicroiEventBus();
