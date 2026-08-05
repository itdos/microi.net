import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
    clear() { this.values.clear(); }
}

function createWebBluetoothDevice(writes) {
    const listeners = new Map();
    const characteristic = {
        uuid: "write-char",
        properties: { write: true, writeWithoutResponse: false },
        async writeValue(buffer) {
            writes.push(Array.from(new Uint8Array(buffer)));
            await new Promise((resolve) => setTimeout(resolve, 2));
        }
    };
    const server = {
        async getPrimaryServices() {
            return [{
                uuid: "service-1",
                async getCharacteristics() { return [characteristic]; }
            }];
        }
    };
    const device = {
        id: "printer-1",
        name: "测试蓝牙打印机",
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type, listener) {
            if (listeners.get(type) === listener) listeners.delete(type);
        },
        gatt: {
            connected: false,
            async connect() {
                this.connected = true;
                return server;
            },
            disconnect() {
                this.connected = false;
                const listener = listeners.get("gattserverdisconnected");
                if (listener) listener({ target: device });
            }
        }
    };
    return device;
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const writes = [];
const device = createWebBluetoothDevice(writes);

globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;
globalThis.navigator = {
    platform: "test",
    bluetooth: {
        async requestDevice() { return device; },
        async getDevices() { return [device]; },
        addEventListener() {}
    }
};

const { createV8Print, initV8Print } = await import("../src/utils/v8-print.js");

function rememberDevice() {
    localStorage.setItem("microi_ble_info", JSON.stringify({
        deviceId: device.id,
        deviceName: device.name,
        writeServiceId: "service-1",
        writeCharaterId: "write-char"
    }));
}

test("连接状态可恢复、可订阅，并在意外断线后自动重连", async () => {
    localStorage.clear();
    sessionStorage.clear();
    writes.length = 0;
    device.gatt.connected = false;
    rememberDevice();

    const printer = createV8Print();
    const states = [];
    const unsubscribe = printer.subscribeConnection((state) => states.push(state.status));

    assert.equal(await printer.initializeConnection(), true);
    assert.equal(printer.isConnected(), true);
    assert.equal(typeof printer.getConnectionState(), "object");
    assert.equal(printer.getConnectionState().deviceName, "测试蓝牙打印机");
    assert.equal(states.includes("reconnecting"), true);
    assert.equal(states.at(-1), "connected");

    device.gatt.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(printer.isConnected(), true);
    assert.equal(printer.getConnectionState().status, "connected");
    unsubscribe();
});

test("整除包长不会写入零字节末包，并发 V8 打印会进入同一串行队列", async () => {
    localStorage.clear();
    sessionStorage.clear();
    writes.length = 0;
    device.gatt.connected = false;
    rememberDevice();

    const printer = createV8Print();
    await printer.initializeConnection();
    printer.setOneTimeData(20);

    await printer.prepareSend(new Uint8Array(40).fill(7));
    assert.deepEqual(writes.map((item) => item.length), [20, 20]);

    writes.length = 0;
    await Promise.all([
        printer.prepareSend(new Uint8Array(20).fill(1)),
        printer.prepareSend(new Uint8Array(20).fill(2))
    ]);
    assert.deepEqual(writes.map((item) => item[0]), [1, 2]);
});

test("主动断开会忘记设备且不再自动重连", async () => {
    localStorage.clear();
    sessionStorage.clear();
    device.gatt.connected = false;
    rememberDevice();

    const printer = createV8Print();
    await printer.initializeConnection();
    printer.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(printer.isConnected(), false);
    assert.equal(printer.getConnectionState().remembered, false);
    assert.equal(localStorage.getItem("microi_ble_info"), null);
});

test("5+App 使用真实连接标记而不是仅凭已保存设备 ID", async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("microi_ble_info", JSON.stringify({
        deviceId: "plus-printer-1",
        deviceName: "移动打印机",
        writeServiceId: "plus-service",
        writeCharaterId: "plus-write"
    }));

    let connectionListener = null;
    const plusBluetooth = {
        onBLEConnectionStateChange(listener) { connectionListener = listener; },
        onBluetoothDeviceFound() {},
        openBluetoothAdapter({ success }) { success({}); },
        createBLEConnection({ success }) { success({}); },
        getBLEDeviceServices({ success }) { success({ services: [{ uuid: "plus-service" }] }); },
        getBLEDeviceCharacteristics({ success }) {
            success({ characteristics: [{ uuid: "plus-write", properties: { write: true } }] });
        },
        closeBLEConnection() {},
        writeBLECharacteristicValue({ success }) { success({}); }
    };
    globalThis.window = {
        plus: { bluetooth: plusBluetooth },
        addEventListener() {}
    };

    const printer = createV8Print();
    assert.equal(printer.isConnected(), false, "持久化 ID 不能冒充实时连接");
    assert.equal(await printer.initializeConnection(), true);
    assert.equal(printer.isConnected(), true);
    assert.equal(typeof connectionListener, "function");

    printer.disconnect();
    assert.equal(printer.isConnected(), false);
    delete globalThis.window;
});

test("所有前端 V8 上下文共享同一个打印连接管理器", () => {
    localStorage.clear();
    sessionStorage.clear();
    const first = { Tips() {} };
    const second = { Tips() {} };
    initV8Print(first);
    initV8Print(second);
    assert.equal(first.Print, second.Print);
});

test("PC 顶栏和移动端我的页都挂载统一蓝牙入口", () => {
    const navbar = readFileSync(new URL("../src/layout/components/Navbar.vue", import.meta.url), "utf8");
    const profile = readFileSync(new URL("../src/views/mobile/profile.vue", import.meta.url), "utf8");
    const entry = readFileSync(new URL("../src/components/BluetoothPrinterEntry/index.vue", import.meta.url), "utf8");

    assert.match(navbar, /<BluetoothPrinterEntry\s*\/>/);
    assert.match(profile, /<BluetoothPrinterEntry\s+variant="profile"\s*\/>/);
    assert.match(entry, /Msg\.BluetoothConnection/);
    assert.match(entry, /Msg\.BluetoothConnected/);
    assert.match(entry, /Msg\.BluetoothDisconnected/);

    const zh = readFileSync(new URL("../src/lang/zh.js", import.meta.url), "utf8");
    const zhTw = readFileSync(new URL("../src/lang/zh-tw.js", import.meta.url), "utf8");
    const en = readFileSync(new URL("../src/lang/en.js", import.meta.url), "utf8");
    assert.match(zh, /BluetoothConnection:\s*"蓝牙连接"/);
    assert.match(zhTw, /BluetoothConnection:\s*"藍牙連線"/);
    assert.match(en, /BluetoothConnection:\s*"Bluetooth printer"/);
});
