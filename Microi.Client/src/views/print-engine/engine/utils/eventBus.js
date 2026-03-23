import { EventEmitter } from 'events';

// 大家根据各自业务需求自行封装对应风格的事件总线模块；
export const EventBus = new EventEmitter();