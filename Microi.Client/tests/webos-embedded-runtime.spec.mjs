import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    WEBOS_WINDOW_RUNTIME_NAME_PREFIX,
    isEmbeddedWebosWindowRuntime,
} from '../src/utils/webos-embedded-runtime.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('WebOS frame runtime requires child frame, same origin and strict nonce name', () => {
    assert.equal(isEmbeddedWebosWindowRuntime(), false);
    const parent = { location: { origin: 'https://os.example' } };
    const frame = { name: WEBOS_WINDOW_RUNTIME_NAME_PREFIX + 'b'.repeat(32), location: { origin: 'https://os.example' }, parent };
    frame.self = frame;
    frame.top = parent;
    assert.equal(isEmbeddedWebosWindowRuntime(frame), true);
    assert.equal(isEmbeddedWebosWindowRuntime({ ...frame, top: frame }), false);
    assert.equal(isEmbeddedWebosWindowRuntime({ ...frame, name: 'microi-webos-window:bad' }), false);
    assert.equal(isEmbeddedWebosWindowRuntime({ ...frame, parent: { location: { origin: 'https://evil.example' } } }), false);
});

test('embedded runtime gates duplicate websocket, chat polling and behavior signals', () => {
    const main = read('src/main.js');
    const app = read('src/App.vue');
    const pinia = read('src/pinia/index.js');
    const storage = read('src/utils/localStorage-manager.js');
    const diyCommon = read('src/utils/diy.common.js');
    const lang = read('src/lang/index.js');
    const layout = read('src/layout/index.vue');
    // 执行真实注册入口，验证嵌入窗口不安装任何持久化逻辑；不能把某个插件调用写法当作隔离保证。
    const entry = new Function('createPinia', 'piniaPluginPersistedstate', 'installPickedPersistence', 'isEmbeddedWebosWindowRuntime',
        pinia.replace(/^import .*;\r?$/gm, '').replace(/^export .*;\r?$/gm, '') + '\nreturn pinia;');
    for (const embedded of [true, false]) {
        const plugins = [], picked = [], fallback = [];
        const instance = { use(plugin) { plugins.push(plugin); return this; } };
        assert.equal(entry(() => instance, context => fallback.push(context), context => {
            picked.push(context); return context.handled;
        }, () => embedded), instance);
        assert.equal(plugins.length, embedded ? 0 : 1);
        for (const context of [{ handled: true }, { handled: false }]) for (const plugin of plugins) plugin(context);
        assert.equal(picked.length, embedded ? 0 : 2);
        assert.equal(fallback.length, embedded ? 0 : 1);
        if (!embedded) assert.equal(fallback[0], picked[1], 'unsupported persistence must use the original plugin');
    }
    assert.match(main, /const snapshot = LocalStorageManager\.getAll\(\)/);
    assert.match(main, /FileServer: snapshot\.FileServer \|\| snapshot\.SysConfig\?\.FileServer/);
    assert.ok(main.indexOf('const snapshot = LocalStorageManager.getAll()') < main.indexOf('app.use(router)'));
    assert.match(main, /if \(!isWebosEmbeddedRuntime\) \{[\s\S]*setCurrentTime/);
    assert.match(main, /if \(isWebosEmbeddedRuntime\) \{[\s\S]*setOsClient/);
    assert.match(storage, /if \(isReadOnlyEmbeddedRuntime\) return false/);
    assert.match(lang, /if \(!isEmbeddedWebosWindowRuntime\(\)\) \{[\s\S]*localStorage\.setItem\("microi\.net"/);
    assert.match(diyCommon, /isEmbeddedWebosWindowRuntime\(\)[\s\S]*microi:webos-window-auth-required/);
    assert.match(main, /if \(!isWebosEmbeddedRuntime\) tryConnectWebSocket\(\)/);
    assert.match(main, /WebOS嵌入窗口复用父页面实时通道/);
    assert.match(main, /import\.meta\.env\.DEV && !isWebosEmbeddedRuntime/);
    assert.match(
        app,
        /TryConnectWebSocketAfterCurrentUser\(\) \{[\s\S]*if \(isEmbeddedWebosWindowRuntime\(\)\) return;[\s\S]*self\.\$nextTick/
    );
    assert.match(app, /if \(!isWebosEmbeddedRuntime\) \{[\s\S]*UserBehaviorSignal/);
    assert.match(app, /if \(isEmbeddedWebosWindowRuntime\(\)\) return/);
    assert.match(app, /if \(!isWebosEmbeddedRuntime\) \{[\s\S]*self\.PageInit\(\)/);
    assert.match(layout, /const isEmbeddedWebosWindow = isEmbeddedWebosWindowRuntime\(\)/);
    assert.match(layout, /isEmbeddedWebosWindow \|\| \['macOS', 'Windows'\]\.includes\(diyStore\.SystemStyle\)/);
});
