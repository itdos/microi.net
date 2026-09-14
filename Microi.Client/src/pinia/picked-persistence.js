import { watch } from 'vue';

/**
 * 核心 store 的平铺字段持久化。按字段监听并缓存已序列化片段，避免时钟/加载状态
 * 触发完整权限树遍历；权限树自身仍是深度响应式，任何嵌套修改都会更新其片段。
 * 不支持的配置交回标准插件，不修改其它 store、存储格式或登录状态的同步动作。
 */
export function installPickedPersistence(context) {
    const { store, options } = context;
    const config = options.persist;
    if (store.$id !== 'diy' || !config || Array.isArray(config) || typeof config !== 'object'
        || !Array.isArray(config.pick) || !config.pick.length || config.omit || config.serializer
        || typeof config.key !== 'string' || !config.storage?.getItem || !config.storage?.setItem
        || config.pick.some(key => typeof key !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(key)
            || ['__proto__', 'constructor', 'prototype'].includes(key))) return false;

    const keys = [...new Set(config.pick)];
    const fragments = new Map();
    const invalid = new Set();
    let pending = false, disposed = false;
    const report = error => { if (config.debug) console.error('[Microi persisted state]', error); };
    const capture = key => {
        try {
            fragments.set(key, JSON.stringify(store.$state[key]));
            invalid.delete(key);
        } catch (error) { invalid.add(key); report(error); }
    };
    const write = () => {
        // 某字段序列化失败时，不能把旧权限片段配上新的 Token 写成部分成功。
        if (disposed || invalid.size) return;
        try {
            const body = keys.filter(key => fragments.get(key) !== undefined)
                .map(key => JSON.stringify(key) + ':' + fragments.get(key)).join(',');
            config.storage.setItem(config.key, '{' + body + '}');
        } catch (error) { report(error); }
    };
    const schedule = () => {
        if (pending || disposed) return;
        pending = true;
        // 与原插件默认的异步 watcher 一致；同一轮多个字段变化只写一次。
        queueMicrotask(() => { if (!pending || disposed) return; pending = false; write(); });
    };
    store.$hydrate = ({ runHooks = true } = {}) => {
        try {
            if (runHooks) config.beforeHydrate?.(context);
            const raw = config.storage.getItem(config.key);
            if (raw) {
                const data = JSON.parse(raw), picked = {};
                for (const key of keys) if (data?.[key] !== undefined) picked[key] = data[key];
                store.$patch(picked);
            }
            if (runHooks) config.afterHydrate?.(context);
        } catch (error) { report(error); }
        keys.forEach(capture);
    };
    store.$persist = () => {
        // 显式保存必须立即包含尚未进入 watcher 队列的登录/退出与嵌套修改。
        pending = false;
        keys.forEach(capture);
        write();
    };
    store.$hydrate();
    const stops = keys.map(key => watch(() => store.$state[key], () => {
        capture(key); schedule();
    }, { deep: true }));
    const dispose = store.$dispose.bind(store);
    store.$dispose = () => { disposed = true; pending = false; stops.forEach(stop => stop()); dispose(); };
    return true;
}
