import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encode } from "../src/utils/ble/encoding.js";

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

function rememberDevice(overrides = {}) {
    localStorage.setItem("microi_ble_info", JSON.stringify({
        deviceId: device.id,
        deviceName: device.name,
        writeServiceId: "service-1",
        writeCharaterId: "write-char",
        ...overrides
    }));
}

function flattenWrites(items = writes) {
    return items.flatMap((item) => Array.from(item));
}

function decodeGb18030(bytes) {
    return new encode.TextDecoder("gb18030").decode(new Uint8Array(bytes));
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

test("佳博 GP-M322 继续逐字节发送原始 TSPL，不经过协议改写", async () => {
    localStorage.clear();
    sessionStorage.clear();
    writes.length = 0;
    device.gatt.connected = false;
    device.name = "GP-M322";
    rememberDevice();

    const printer = createV8Print();
    await printer.initializeConnection();
    printer.setOneTimeData(512);
    const command = printer.createNew();
    command.setSize(60, 40);
    command.setGap(2);
    command.setCls();
    command.setText(20, 20, "TSS24.BF2", 1, 1, "佳博回归");
    command.setQR(280, 20, "L", 5, "A", "GP-M322");
    command.setPagePrint();
    const originalBytes = Array.from(command.getData());

    await printer.prepareSend(command.getData());
    assert.deepEqual(flattenWrites(), originalBytes);
    assert.equal(printer.getConnectionState().profileId, "gprinter-gp-m322");
    assert.equal(printer.getConnectionState().commandLanguage, "tspl");
    device.name = "测试蓝牙打印机";
});

test("ZICOX CC4 在不改旧 V8 调用的情况下把 TSC 标签转换为厂家 CPCL", async () => {
    localStorage.clear();
    sessionStorage.clear();
    writes.length = 0;
    device.gatt.connected = false;
    device.name = "ZICOX CC4";
    rememberDevice();

    const printer = createV8Print();
    await printer.initializeConnection();
    printer.setOneTimeData(512);
    const command = printer.createNew();
    command.setSize(60, 40);
    command.setSpeed(4);
    command.setDensity(8);
    command.setGap(2);
    command.setDirection(1);
    command.setCls();
    command.setText(20, 20, "TSS24.BF2", 2, 2, "芝柯兼容");
    command.setBar(20, 80, 200, 3);
    command.setBox(10, 10, 470, 300, 2);
    command.setReverse(20, 120, 100, 24);
    command.setBarCode(20, 170, "128", 60, 1, 2, 4, "1234567890");
    command.setQR(340, 30, "M", 5, "A", "CC4");
    command.setPagePrint();

    const tscBytes = Array.from(command.getData());
    assert.equal(Object.keys(command.getData()).some((key) => key.startsWith("__microi")), false);
    await printer.prepareSend(command.getData());
    const cpclBytes = flattenWrites();
    const cpcl = decodeGb18030(cpclBytes);

    assert.notDeepEqual(cpclBytes, tscBytes);
    assert.match(cpcl, /^! 0 200 200 320 1\r\nPAGE-WIDTH 480\r\nZPROTATE180\r\nGAP-SENSE\r\n/);
    assert.match(cpcl, /SPEED 4\r\n/);
    assert.match(cpcl, /CONTRAST 8\r\n/);
    assert.match(cpcl, /ZPROTATE180\r\nGAP-SENSE\r\n/);
    assert.match(cpcl, /SETMAG 2 2\r\nT 24 0 20 20 芝柯兼容\r\nSETMAG 0 0\r\n/);
    assert.match(cpcl, /BARCODE 128 2 2 60 20 170 1234567890\r\n/);
    assert.match(cpcl, /BARCODE QR 340 30 M 2 U 5\r\nMA,CC4\r\nENDQR\r\n/);
    assert.match(cpcl, /FORM\r\nPRINT\r\n$/);
    assert.doesNotMatch(cpcl, /SIZE 60 mm|QRCODE|PRINT 1,1/);
    assert.equal(printer.getConnectionState().profileId, "zicox-cc4");
    assert.equal(printer.getConnectionState().commandLanguage, "cpcl");

    writes.length = 0;
    const receipt = printer.createNewESC();
    receipt.init();
    receipt.setText("CC4 ESC/POS");
    receipt.setPrint();
    const escBytes = Array.from(receipt.getData());
    await printer.prepareSend(receipt.getData());
    assert.deepEqual(flattenWrites(), escBytes, "CC4 原生支持的 ESC/POS 不应被转换");

    writes.length = 0;
    const unsupported = printer.createNew();
    unsupported.setSize(60, 40);
    unsupported.setErase(0, 0, 20, 20);
    unsupported.setPagePrint();
    await assert.rejects(printer.prepareSend(unsupported.getData()), /暂不支持自动转换 TSC 方法 setErase/);
    assert.equal(writes.length, 0, "不支持的指令必须在写入前失败，不能产生半张乱码标签");

    const unsupportedFeed = printer.createNew();
    unsupportedFeed.setSize(60, 40);
    unsupportedFeed.setHome();
    unsupportedFeed.setPagePrint();
    await assert.rejects(printer.prepareSend(unsupportedFeed.getData()), /暂不支持自动转换 TSC 方法 setHome/);
    assert.equal(writes.length, 0, "语义不能安全映射的走纸命令也必须零写入失败");
    device.name = "测试蓝牙打印机";
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

test("5+App 中 CC4 的 BLE 不可用时可用厂家同款 RFCOMM/SPP 通道发送 CPCL", async () => {
    localStorage.clear();
    sessionStorage.clear();
    const sppWrites = [];
    const output = {
        write(bytes) { sppWrites.push(Array.from(bytes)); },
        flush() {},
        close() {}
    };
    const socket = {
        connected: false,
        connect() { this.connected = true; },
        isConnected() { return this.connected; },
        getOutputStream() { return output; },
        close() { this.connected = false; }
    };
    const nativeDevice = {
        createInsecureRfcommSocketToServiceRecord() { return socket; }
    };
    const adapter = {
        isEnabled() { return true; },
        cancelDiscovery() {},
        getRemoteDevice() { return nativeDevice; }
    };
    const BluetoothAdapter = { getDefaultAdapter() { return adapter; } };
    const UUID = { fromString(value) { return value; } };
    const invokedMethods = [];
    const plusAndroid = {
        importClass(value) {
            if (value === "android.bluetooth.BluetoothAdapter") return BluetoothAdapter;
            if (value === "java.util.UUID") return UUID;
            return value;
        },
        invoke(target, method, argument) {
            invokedMethods.push([method, argument]);
            if (target === nativeDevice && method === "createRfcommSocket") {
                assert.equal(argument, 1);
                return socket;
            }
            assert.equal(method, "getBytes");
            assert.equal(argument, "ISO-8859-1");
            return Uint8Array.from(Array.from(target, (char) => char.charCodeAt(0) & 0xff));
        }
    };
    globalThis.window = {
        plus: {
            os: { name: "Android" },
            android: plusAndroid,
            bluetooth: {
                onBLEConnectionStateChange() {},
                onBluetoothDeviceFound() {},
                closeBLEConnection() {}
            }
        },
        addEventListener() {}
    };
    localStorage.setItem("microi_ble_info", JSON.stringify({
        deviceId: "00:11:22:33:44:55",
        deviceName: "ZICOX CC4",
        transport: "spp",
        profileMode: "auto"
    }));

    const printer = createV8Print();
    assert.equal(await printer.initializeConnection(), true);
    assert.equal(printer.isConnected(), true);
    assert.equal(printer.getConnectionState().transport, "spp");
    printer.setOneTimeData(512);
    const command = printer.createNew();
    command.setSize(60, 40);
    command.setGap(2);
    command.setText(20, 20, "TSS24.BF2", 1, 1, "SPP");
    command.setPagePrint();
    await printer.prepareSend(command.getData());

    const cpcl = decodeGb18030(flattenWrites(sppWrites));
    assert.match(cpcl, /^! 0 200 200 320 1\r\nPAGE-WIDTH 480\r\nZPROTATE\r\nGAP-SENSE\r\n/);
    assert.match(cpcl, /T 24 0 20 20 SPP\r\n/);
    assert.match(cpcl, /FORM\r\nPRINT\r\n$/);
    assert.deepEqual(invokedMethods[0], ["createRfcommSocket", 1], "应优先使用厂家 Demo 的 RFCOMM 通道 1");
    printer.disconnect();
    assert.equal(socket.connected, false);
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

test("Android 权限、V8 编辑器、官网菜单与 Skills 保持同一双型号契约", () => {
    const runtime = readFileSync(new URL("../src/utils/v8-print.js", import.meta.url), "utf8");
    assert.match(runtime, /android\.permission\.BLUETOOTH_SCAN/);
    assert.match(runtime, /android\.permission\.BLUETOOTH_CONNECT/);
    assert.match(runtime, /只在用户主动点击搜索时申请权限/);

    const definitions = readFileSync(new URL("../src/views/form-engine/diy-components/v8-api-definitions.js", import.meta.url), "utf8");
    assert.match(definitions, /ZICOX CC4/);
    assert.match(definitions, /getPrinterProfile/);
    assert.match(definitions, /setPrinterProfile/);

    const mapping = readFileSync(new URL("../../microi.doc/docs/mapping_zh.json", import.meta.url), "utf8");
    const guide = readFileSync(new URL("../../microi.doc/docs/doc/system-engine/bluetooth-printer.md", import.meta.url), "utf8");
    assert.equal(JSON.parse(mapping.replace(/^\uFEFF/, ""))["bluetooth-printer.md"], "蓝牙打印机");
    assert.match(guide, /GP-M322/);
    assert.match(guide, /ZICOX CC4/);
    assert.match(guide, /BLUETOOTH_SCAN/);

    const skill = readFileSync(new URL("../../microi.skills/v8-frontend-events/references/bluetooth-print.md", import.meta.url), "utf8");
    const bundledSkill = readFileSync(new URL("../../Microi.VSCode/plugins/microi/skills/v8-frontend-events/references/bluetooth-print.md", import.meta.url), "utf8");
    assert.equal(bundledSkill, skill);
    assert.match(skill, /GP-M322/);
    assert.match(skill, /ZICOX CC4/);
    assert.match(skill, /BLUETOOTH_CONNECT/);
});
