import assert from 'node:assert/strict';
import test from 'node:test';
import { createV8Print, releaseStalePlusBleConnections } from '../src/utils/v8-print.js';

// Each fixture replaces process-wide browser/5+ globals; keep these cases serial.
const serialTest = (name, fn) => test(name, { concurrency: false }, fn);

// 真实 5+ 壳没有 uni；用回调边界和字节流验证调度，不把模拟耗时当作真机出纸时间。
async function nativePrinter(t, options = {}) {
    const install = (key, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
    };
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    storage.setItem('microi_ble_info', JSON.stringify({ deviceId: 'native-printer', deviceName: options.name || 'GP-M322' }));
    const writes = [], writeTypes = [], delays = [], calls = [];
    const originalTimeout = globalThis.setTimeout;
    t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
        delays.push(ms);
        if (ms === 0) options.onDelay?.(ms);
        return originalTimeout(callback, ms === 1500 ? 10 : 0, ...args);
    });
    install('localStorage', storage);
    install('sessionStorage', storage);
    install('navigator', { platform: 'Android' });
    install('uni', undefined);
    const bluetooth = {
        onBLEConnectionStateChange() {}, onBluetoothDeviceFound() {},
        openBluetoothAdapter({ success }) { success({}); },
        createBLEConnection({ success }) { calls.push('connect'); success({}); },
        closeBLEConnection() {},
        getBLEDeviceServices({ success }) { calls.push('services'); success({ services: [{ uuid: 'service' }] }); },
        getBLEDeviceCharacteristics({ success }) {
            calls.push('characteristics');
            success({ characteristics: [{ uuid: 'write', properties: options.properties || { write: true, writeNoResponse: true } }] });
        },
        writeBLECharacteristicValue(payload) {
            writes.push([...new Uint8Array(payload.value)]);
            writeTypes.push(payload.writeType);
            if (options.write) options.write(payload, writes.length);
            else payload.success({});
        },
    };
    if (options.mtu !== 'missing') bluetooth.setBLEMTU = payload => {
        calls.push('mtu');
        assert.equal(payload.mtu, 183);
        if (options.mtu === 'failure') payload.fail({ code: 10008 });
        else if (options.mtu === 'timeout') options.onMtu?.(payload);
        else payload.success(options.mtu === 'empty' ? {} : { mtu: options.mtu ?? 183 });
    };
    install('window', { plus: { os: { name: options.os || 'Android' }, bluetooth }, addEventListener() {} });
    const print = createV8Print();
    t.after(() => print.disconnect());
    assert.equal(await print.initializeConnection(), true);
    return { print, writes, writeTypes, delays, calls, storage };
}

serialTest('纯 5+ Android 佳博使用无响应写并把连续写入限制在 100 字节稳定档', async t => {
    const { print, calls, writes, writeTypes, delays, storage } = await nativePrinter(t);
    const state = print.getConnectionState();
    assert.deepEqual(calls, ['connect', 'services', 'characteristics', 'mtu']);
    assert.equal(state.mtu, 183);
    assert.equal(state.maxWriteBytes, 180);
    assert.equal(state.recommendedPacketSize, 100);
    assert.equal(state.packetIntervalMs, 8);
    assert.equal(state.writeType, 'writeNoResponse');
    assert.equal(JSON.parse(storage.getItem('microi_ble_info')).mtu, undefined, 'MTU 不能随设备记录跨连接缓存');
    const bytes = Uint8Array.from({ length: 9207 }, (_, i) => i % 256);
    print.setOneTimeData(180);
    delays.length = 0;
    await print.prepareSend(bytes);
    assert.equal(writes.length, 93);
    assert.ok(writes.every(bytes => bytes.length <= 100), '调用方请求 180 时也不能突破佳博稳定档');
    assert.ok(writeTypes.every(type => type === 'writeNoResponse'), '每包都必须把无响应写模式传给 5+');
    assert.deepEqual(writes.flat(), [...bytes]);
    assert.equal(delays.filter(ms => ms === 8).length, 92, '相邻分包保留短 GATT 保护窗口');
});

serialTest('佳博原生写入严格等待上一包成功回调，不并发占用 GATT 队列', async t => {
    let writing = false;
    const { print, writes, delays } = await nativePrinter(t, {
        write(payload) {
            if (writing) {
                payload.fail({ code: 10008 });
                return;
            }
            writing = true;
            queueMicrotask(() => {
                writing = false;
                payload.success({});
            });
        },
    });
    print.setOneTimeData(180);
    await print.prepareSend(new Uint8Array(361).fill(7));
    assert.equal(writes.length, 4);
    assert.equal(delays.filter(ms => ms === 8).length, 3);
});

for (const mtu of ['missing', 'empty', 'failure', 'timeout', 23, 64, 102, 103, 182, 183, 517, 22, 'invalid']) {
    serialTest(`MTU=${mtu} 时按实际能力限包，不把设置请求成功当作协商结果`, async t => {
        let late;
        const { print, writes } = await nativePrinter(t, { mtu, onMtu: p => { late = p; } });
        const valid = Number.isInteger(mtu) && mtu >= 23 && mtu <= 517;
        const maxBytes = valid ? Math.min(180, mtu - 3) : 20;
        const state = print.getConnectionState();
        assert.equal(state.maxWriteBytes, maxBytes);
        const stableBytes = maxBytes >= 100 ? 100 : 20;
        assert.equal(state.recommendedPacketSize, stableBytes);
        print.setOneTimeData(180);
        await print.prepareSend(new Uint8Array(201).fill(42));
        assert.ok(writes.every(bytes => bytes.length <= stableBytes));
        assert.equal(writes.flat().length, 201);
        if (late) {
            late.success({ mtu: 183 });
            assert.equal(print.getConnectionState().maxWriteBytes, 20, '超时后的迟到回调不能提升当前会话包长');
        }
    });
}

serialTest('旧 5+ 佳博只能 20 字节时仍保留短 GATT 保护窗口', async t => {
    const { print, writes, delays } = await nativePrinter(t, { mtu: 'missing' });
    delays.length = 0;
    await print.prepareSend(new Uint8Array(100));
    assert.equal(writes.length, 5);
    assert.equal(delays.filter(ms => ms === 8).length, 4);
});

for (const options of [{ name: '旧款打印机' }, { os: 'iOS' }]) {
    serialTest(`${options.name || options.os} 保留 20 字节及原有节流`, async t => {
        const { print, calls, writes, delays } = await nativePrinter(t, options);
        assert.equal(calls.includes('mtu'), false);
        delays.length = 0;
        await print.prepareSend(new Uint8Array(40));
        assert.deepEqual(writes.map(bytes => bytes.length), [20, 20]);
        assert.deepEqual(delays, [20]);
    });
}

serialTest('佳博特征不支持无响应写时保留确认写兼容路径', async t => {
    const { print, writeTypes } = await nativePrinter(t, { properties: { write: true } });
    assert.equal(print.getConnectionState().writeType, 'write');
    await print.prepareSend(new Uint8Array(40));
    assert.deepEqual(writeTypes, ['write', 'write']);
});

serialTest('原生回调未完成时不发下一包，并发任务保持整份顺序', async t => {
    const pending = [];
    const { print, writes } = await nativePrinter(t, { write: p => pending.push(p) });
    print.setOneTimeData(180);
    const first = print.prepareSend(new Uint8Array(181).fill(1));
    const second = print.prepareSend(new Uint8Array(181).fill(2));
    for (let i = 0; i < 4; i++) {
        for (let spin = 0; spin < 20 && writes.length < i + 1; spin++) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        assert.equal(writes.length, i + 1);
        pending.shift().success({});
    }
    await Promise.all([first, second]);
    assert.deepEqual(writes.map(bytes => bytes[0]), [1, 1, 2, 2]);
});

serialTest('部分发送后错误不降档重发，断开后清除 MTU 能力', async t => {
    const { print, writes } = await nativePrinter(t, { write(p, count) {
        if (count === 2) p.fail({ code: 10007 }); else p.success({});
    } });
    print.setOneTimeData(180);
    await assert.rejects(print.prepareSend(new Uint8Array(400)), /特征值不支持/);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes.map(bytes => bytes.length), [100, 100]);
    print.disconnect();
    assert.equal(print.getConnectionState().maxWriteBytes, 20);
    assert.equal(print.getConnectionState().mtu, 0);
});

// 安装一个只服务于“残留链路”场景的 5+ 全局，返回可断言的关闭记录。
function staleLinkFixture(t, connectedDevices) {
    const install = (key, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
    };
    const closed = [];
    install('window', {
        plus: {
            os: { name: 'Android' },
            bluetooth: {
                getConnectedBluetoothDevices({ success }) { success({ devices: connectedDevices }); },
                closeBLEConnection({ deviceId, complete }) { closed.push(deviceId); complete?.({}); },
            },
        },
        addEventListener() {},
    });
    return { closed };
}

serialTest('扫描前释放应用未持有的残留 GATT 链路，避免打印机保持连接而不广播', async t => {
    const { closed } = staleLinkFixture(t, [{ deviceId: 'stale-printer', name: 'GP-M322' }]);
    const released = await releaseStalePlusBleConnections({ _plusConnected: false, BLEInformation: {} });
    assert.equal(released, 1);
    assert.deepEqual(closed, ['stale-printer']);
});

serialTest('扫描前不释放应用当前正在使用的连接', async t => {
    const { closed } = staleLinkFixture(t, [
        { deviceId: 'current-printer', name: 'GP-M322' },
        { deviceId: 'other-printer', name: 'CC4' },
    ]);
    const print = { _plusConnected: true, BLEInformation: { deviceId: 'current-printer', transport: 'ble' } };
    const released = await releaseStalePlusBleConnections(print);
    assert.equal(released, 1);
    assert.deepEqual(closed, ['other-printer']);
});

serialTest('连接期间被断开事件接管时关闭已建立的 GATT 链路，不遗留占用广播的连接', async t => {
    const install = (key, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
    };
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    storage.setItem('microi_ble_info', JSON.stringify({ deviceId: 'native-printer', deviceName: 'GP-M322' }));
    const closed = [];
    let connectionHandler = null;
    const bluetooth = {
        onBLEConnectionStateChange(handler) { connectionHandler = handler; },
        onBluetoothDeviceFound() {},
        openBluetoothAdapter({ success }) { success({}); },
        createBLEConnection({ success }) { success({}); },
        closeBLEConnection({ deviceId, complete }) { closed.push(deviceId); complete?.({}); },
        getBLEDeviceServices({ success }) {
            // 旧链路的断开事件在发现服务阶段到达：新流程必须关闭自己建立的连接。
            connectionHandler?.({ deviceId: 'native-printer', connected: false });
            success({ services: [{ uuid: 'service' }] });
        },
        getBLEDeviceCharacteristics({ success }) { success({ characteristics: [{ uuid: 'write', properties: { write: true } }] }); },
    };
    install('localStorage', storage);
    install('sessionStorage', storage);
    install('navigator', { platform: 'Android' });
    install('window', { plus: { os: { name: 'Android' }, bluetooth }, addEventListener() {} });
    const print = createV8Print();
    t.after(() => print.disconnect());
    assert.equal(await print.reconnect({ silent: true }), false);
    assert.equal(print.isConnected(), false);
    assert.deepEqual(closed, ['native-printer', 'native-printer'],
        '先清理残留旧链路，断开事件接管后还必须关闭本次新建的 GATT 链路');
});
