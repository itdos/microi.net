import { EventEmitter } from 'events';

// 大家根据各自业务需求自行封装对应风格的事件总线模块；
class MicroiEventBus extends EventEmitter {
    off(eventName, listener) {
        if (typeof listener === "function") {
            return super.off(eventName, listener);
        }
        return eventName ? this.removeAllListeners(eventName) : this.removeAllListeners();
    }
}

export const EventBus = new MicroiEventBus();
