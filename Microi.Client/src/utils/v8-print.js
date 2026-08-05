/**
 * V8.Print 蓝牙打印模块（双引擎版）
 * ================================================
 * 自动检测运行环境，在不同平台使用对应的蓝牙 API：
 *   - 5+App (APK/IPA): 使用 plus.bluetooth API（与旧 uni-app 完全一致）
 *   - PC/H5 浏览器:    使用 Web Bluetooth API（Chrome/Edge）
 *
 * 功能特性：
 * - TSC (TSPL) 标签打印指令构建器 (V8.Print.createNew)
 * - ESC/POS 票据打印指令构建器 (V8.Print.createNewESC)
 * - 自动分包发送 (V8.Print.prepareSend)
 * - BLE 设备管理、应用级共享连接状态与受控自动重连
 * - 蓝牙连接对话框 UI (V8.Print.OpenBluetoothPage)
 *
 * V8 引擎代码使用示例（必须在用户手势触发的 async 事件中执行）：
 *   if (!V8.Print) throw new Error("当前客户端未加载蓝牙打印能力");
 *   if (!V8.Print.isConnected()) {
 *       var connected = await V8.Print.OpenBluetoothPage();
 *       if (!connected || !V8.Print.isConnected()) return;
 *   }
 *   var cmd = V8.Print.createNew();
 *   cmd.setSize(75, 65);
 *   cmd.setGap(2);
 *   cmd.setCls();
 *   cmd.setText(220, 10, "TSS24.BF2", 1, 1, "产品标识卡");
 *   cmd.setQR(420, 300, "L", 5, "A", "https://microi.net");
 *   cmd.setPagePrint();
 *   await V8.Print.prepareSend(cmd.getData());
 *
 * Print 的分包游标是共享可变状态，所有业务发送必须串行 await，禁止 Promise.all。
 */

import { tsc } from "./ble/tsc.js";
import { esc } from "./ble/esc.js";

// ====================== 常量 ======================
const BLE_STORAGE_KEY = "microi_ble_info";
const LOG_PREFIX = "Microi：【蓝牙打印】";
const RECONNECT_DELAYS = [0, 1000, 2500, 5000, 10000, 30000];
const EMPTY_BLE_INFO = Object.freeze({
    platform: "", deviceId: "", deviceName: "",
    writeCharaterId: "", writeServiceId: "",
    notifyCharaterId: "", notifyServiceId: "",
    readCharaterId: "", readServiceId: "",
});

let sharedPrintInstance = null;

// 常用打印机 BLE 服务 UUID
const PRINTER_SERVICE_UUIDS = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

// ====================== 环境检测 ======================

/** 检测是否在 5+App 环境中运行（APK/IPA） */
function isPlusApp() {
    return typeof window !== "undefined" && !!window.plus && !!window.plus.bluetooth;
}

/** 检查是否支持 Web Bluetooth API */
function isWebBluetoothSupported() {
    return typeof navigator !== "undefined" && !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

/** 获取蓝牙引擎类型标识 */
function getBLEEngine() {
    if (isPlusApp()) return "plus";
    if (isWebBluetoothSupported()) return "web";
    return "none";
}

// ====================== 持久化 ======================

function normalizeBLEInfo(info) {
    if (!info || typeof info !== "object" || !info.deviceId) return null;
    return {
        platform: String(info.platform || ""),
        deviceId: String(info.deviceId || ""),
        deviceName: String(info.deviceName || ""),
        writeCharaterId: String(info.writeCharaterId || ""),
        writeServiceId: String(info.writeServiceId || ""),
        notifyCharaterId: String(info.notifyCharaterId || ""),
        notifyServiceId: String(info.notifyServiceId || ""),
        readCharaterId: String(info.readCharaterId || ""),
        readServiceId: String(info.readServiceId || ""),
    };
}

function getStorage(name) {
    try {
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    } catch (e) { }
    return null;
}

function saveBLEInfo(info) {
    var normalized = normalizeBLEInfo(info);
    [getStorage("localStorage"), getStorage("sessionStorage")].forEach(function (storage) {
        if (!storage) return;
        try {
            if (normalized) storage.setItem(BLE_STORAGE_KEY, JSON.stringify(normalized));
            else storage.removeItem(BLE_STORAGE_KEY);
        } catch (e) { }
    });
}

function restoreBLEInfo() {
    var storages = [getStorage("localStorage"), getStorage("sessionStorage")];
    for (var i = 0; i < storages.length; i++) {
        if (!storages[i]) continue;
        try {
            var value = storages[i].getItem(BLE_STORAGE_KEY);
            var normalized = value ? normalizeBLEInfo(JSON.parse(value)) : null;
            if (normalized) return normalized;
        } catch (e) { }
    }
    return null;
}

function emptyBLEInfo() {
    return Object.assign({}, EMPTY_BLE_INFO, {
        platform: (typeof navigator !== "undefined" ? navigator.platform : "") || "",
    });
}

function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ====================== plus 蓝牙错误提示 ======================

function bleErrorTip(code) {
    var map = {
        10000: "未初始化蓝牙适配器", 10001: "当前蓝牙适配器不可用",
        10002: "没有找到指定设备", 10003: "连接失败",
        10004: "没有找到指定服务", 10005: "没有找到指定特征值",
        10006: "当前连接已断开", 10007: "当前特征值不支持此操作",
        10008: "其余所有系统上报的异常", 10009: "Android 系统版本低于 4.3 不支持 BLE",
    };
    return map[code] || ("蓝牙错误码: " + code);
}

// ====================== 共享连接状态与重连 ======================

function getConnectionSnapshot(Print) {
    return Object.assign({}, Print._connectionState || {});
}

function updateConnectionState(Print, status, detail) {
    detail = detail || {};
    var engine = getBLEEngine();
    var connected = typeof Print.isConnected === "function" ? Print.isConnected() : false;
    if (status === "connected" && !connected) status = "disconnected";
    var remembered = normalizeBLEInfo(Print._rememberedInfo);
    var current = connected ? normalizeBLEInfo(Print.BLEInformation) : remembered;
    var next = {
        engine: engine,
        supported: engine !== "none",
        status: status || (connected ? "connected" : (engine === "none" ? "unsupported" : "disconnected")),
        connected: connected,
        remembered: !!remembered,
        deviceId: current ? current.deviceId : "",
        deviceName: current ? current.deviceName : "",
        autoReconnect: !!remembered && !Print._manualDisconnect,
        error: Object.prototype.hasOwnProperty.call(detail, "error") ? String(detail.error || "") : "",
        changedAt: Date.now(),
    };
    Print._connectionState = next;
    (Print._connectionListeners || []).forEach(function (listener) {
        try { listener(Object.assign({}, next)); } catch (error) { console.error(LOG_PREFIX + " 状态监听失败:", error); }
    });
    return next;
}

function applyConnectedInfo(Print, info) {
    var normalized = normalizeBLEInfo(info);
    if (!normalized) throw new Error("蓝牙设备信息不完整");
    Print.BLEInformation = Object.assign(emptyBLEInfo(), normalized);
    Print._rememberedInfo = Object.assign({}, normalized);
    Print._manualDisconnect = false;
    Print._reconnectAttempt = 0;
    saveBLEInfo(normalized);
    updateConnectionState(Print, "connected", { error: "" });
}

function clearLiveConnection(Print) {
    Print._plusConnected = false;
    Print._webServer = null;
    Print._webWriteChar = null;
    Print.BLEInformation = emptyBLEInfo();
}

function markUnexpectedDisconnect(Print, reason) {
    clearLiveConnection(Print);
    updateConnectionState(Print, "disconnected", { error: reason || "蓝牙连接已断开" });
    if (!Print._manualDisconnect && typeof Print._scheduleReconnect === "function") {
        Print._scheduleReconnect(reason || "蓝牙连接已断开");
    }
}

function ensurePlusEventBridge(Print) {
    if (!isPlusApp() || Print._plusBridgeRegistered) return;
    Print._plusBridgeRegistered = true;

    if (typeof window.plus.bluetooth.onBLEConnectionStateChange === "function") {
        window.plus.bluetooth.onBLEConnectionStateChange(function (event) {
            var activeId = Print.BLEInformation.deviceId || (Print._rememberedInfo && Print._rememberedInfo.deviceId);
            if (!event || !activeId || event.deviceId !== activeId) return;
            if (event.connected) {
                if (Print.BLEInformation.writeCharaterId) {
                    Print._plusConnected = true;
                    updateConnectionState(Print, "connected", { error: "" });
                }
                return;
            }
            if (Date.now() < Print._suppressDisconnectUntil) return;
            markUnexpectedDisconnect(Print, "蓝牙打印机连接已断开");
        });
    }

    if (typeof window.plus.bluetooth.onBluetoothDeviceFound === "function") {
        window.plus.bluetooth.onBluetoothDeviceFound(function (event) {
            (Print._plusDeviceFoundListeners || []).forEach(function (listener) {
                try { listener(event || {}); } catch (error) { console.error(LOG_PREFIX + " 设备发现监听失败:", error); }
            });
        });
    }
}

function openPlusBluetoothAdapter() {
    return new Promise(function (resolve, reject) {
        window.plus.bluetooth.openBluetoothAdapter({
            success: resolve,
            fail: function (error) { reject(new Error(bleErrorTip(error && (error.errCode || error.code)))); }
        });
    });
}

function createPlusConnection(deviceId) {
    return new Promise(function (resolve, reject) {
        window.plus.bluetooth.createBLEConnection({
            deviceId: deviceId,
            timeout: 12000,
            success: resolve,
            fail: function (error) {
                var code = error && (error.errCode || error.code);
                if (Number(code) === 10010) resolve(error);
                else reject(new Error(bleErrorTip(code)));
            }
        });
    });
}

async function connectPlusDevice(Print, device, options) {
    options = options || {};
    if (!isPlusApp()) throw new Error("当前终端不支持 5+App 蓝牙");
    var deviceId = String(device && device.deviceId || "");
    if (!deviceId) throw new Error("蓝牙设备 ID 不能为空");
    var deviceName = String(device && device.name || (Print._rememberedInfo && Print._rememberedInfo.deviceName) || "蓝牙打印机");
    if (Print.isConnected() && Print.BLEInformation.deviceId === deviceId) return true;

    ensurePlusEventBridge(Print);
    updateConnectionState(Print, options.reconnecting ? "reconnecting" : "connecting", { error: "" });
    if (typeof options.onStatus === "function") options.onStatus((options.reconnecting ? "正在重新连接 " : "正在连接 ") + deviceName + "...", "searching");

    await openPlusBluetoothAdapter();
    if (Print._plusConnected && Print.BLEInformation.deviceId && Print.BLEInformation.deviceId !== deviceId) {
        Print._suppressDisconnectUntil = Date.now() + 1500;
        try { window.plus.bluetooth.closeBLEConnection({ deviceId: Print.BLEInformation.deviceId }); } catch (e) { }
        clearLiveConnection(Print);
    }

    try {
        await createPlusConnection(deviceId);
        await delay(800);
        var services = await new Promise(function (resolve, reject) {
            window.plus.bluetooth.getBLEDeviceServices({
                deviceId: deviceId,
                success: function (result) { resolve(result.services || []); },
                fail: function (error) { reject(new Error(bleErrorTip(error && (error.errCode || error.code)))); }
            });
        });

        var info = emptyBLEInfo();
        info.deviceId = deviceId;
        info.deviceName = deviceName;
        var writeFound = false;
        for (var serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
            var serviceId = services[serviceIndex].uuid;
            var characteristics = await new Promise(function (resolve) {
                window.plus.bluetooth.getBLEDeviceCharacteristics({
                    deviceId: deviceId,
                    serviceId: serviceId,
                    success: function (result) { resolve(result.characteristics || []); },
                    fail: function () { resolve([]); }
                });
            });
            for (var charIndex = 0; charIndex < characteristics.length; charIndex++) {
                var characteristic = characteristics[charIndex];
                var properties = characteristic.properties || {};
                if (!info.notifyCharaterId && properties.notify) {
                    info.notifyCharaterId = characteristic.uuid;
                    info.notifyServiceId = serviceId;
                }
                if (!writeFound && (properties.write || properties.writeNoResponse)) {
                    info.writeCharaterId = characteristic.uuid;
                    info.writeServiceId = serviceId;
                    writeFound = true;
                }
                if (!info.readCharaterId && properties.read) {
                    info.readCharaterId = characteristic.uuid;
                    info.readServiceId = serviceId;
                }
            }
        }
        if (!writeFound) throw new Error("未找到打印机写入特征值，请换一个设备");

        Print._plusConnected = true;
        applyConnectedInfo(Print, info);
        if (typeof options.onStatus === "function") options.onStatus("已连接: " + deviceName, "connected");
        console.log(LOG_PREFIX + " [plus] 蓝牙连接成功");
        return true;
    } catch (error) {
        Print._suppressDisconnectUntil = Date.now() + 1500;
        try { window.plus.bluetooth.closeBLEConnection({ deviceId: deviceId }); } catch (e) { }
        clearLiveConnection(Print);
        updateConnectionState(Print, "disconnected", { error: error.message || error });
        throw error;
    }
}

function attachWebDisconnectListener(Print, device) {
    if (!device || typeof device.addEventListener !== "function") return;
    if (Print._webDisconnectDevice && Print._webDisconnectHandler && typeof Print._webDisconnectDevice.removeEventListener === "function") {
        Print._webDisconnectDevice.removeEventListener("gattserverdisconnected", Print._webDisconnectHandler);
    }
    Print._webDisconnectDevice = device;
    Print._webDisconnectHandler = function () {
        if (Print._webDevice !== device) return;
        if (Date.now() < Print._suppressDisconnectUntil) return;
        markUnexpectedDisconnect(Print, "蓝牙打印机连接已断开");
    };
    device.addEventListener("gattserverdisconnected", Print._webDisconnectHandler);
}

async function connectWebDevice(Print, device, options) {
    options = options || {};
    if (!device || !device.gatt) throw new Error("未取得可连接的蓝牙设备");
    if (Print.isConnected() && Print._webDevice === device) return true;
    var deviceName = String(device.name || (Print._rememberedInfo && Print._rememberedInfo.deviceName) || "蓝牙打印机");

    if (Print._webDevice && Print._webDevice !== device && Print._webDevice.gatt && Print._webDevice.gatt.connected) {
        Print._suppressDisconnectUntil = Date.now() + 1500;
        try { Print._webDevice.gatt.disconnect(); } catch (e) { }
    }
    Print._webDevice = device;
    Print._webServer = null;
    Print._webWriteChar = null;
    attachWebDisconnectListener(Print, device);
    updateConnectionState(Print, options.reconnecting ? "reconnecting" : "connecting", { error: "" });
    if (typeof options.onStatus === "function") options.onStatus((options.reconnecting ? "正在重新连接 " : "正在连接 ") + deviceName + "...", "searching");

    try {
        var server = device.gatt.connected ? device.gatt : await device.gatt.connect();
        var services = await server.getPrimaryServices();
        var writeChar = null;
        var info = emptyBLEInfo();
        info.deviceId = String(device.id || "");
        info.deviceName = deviceName;

        for (var serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
            try {
                var characteristics = await services[serviceIndex].getCharacteristics();
                for (var charIndex = 0; charIndex < characteristics.length; charIndex++) {
                    var characteristic = characteristics[charIndex];
                    var properties = characteristic.properties || {};
                    if (!writeChar && (properties.write || properties.writeWithoutResponse)) {
                        writeChar = characteristic;
                        info.writeServiceId = services[serviceIndex].uuid;
                        info.writeCharaterId = characteristic.uuid;
                    }
                    if (!info.notifyCharaterId && properties.notify) {
                        info.notifyServiceId = services[serviceIndex].uuid;
                        info.notifyCharaterId = characteristic.uuid;
                    }
                    if (!info.readCharaterId && properties.read) {
                        info.readServiceId = services[serviceIndex].uuid;
                        info.readCharaterId = characteristic.uuid;
                    }
                }
            } catch (error) {
                console.log(LOG_PREFIX + " 跳过不可访问的蓝牙服务");
            }
        }
        if (!writeChar) throw new Error("未找到打印机的写入特征值，该设备可能不是打印机");

        Print._webServer = server;
        Print._webWriteChar = writeChar;
        applyConnectedInfo(Print, info);
        if (typeof options.onStatus === "function") options.onStatus("已连接: " + deviceName, "connected");
        console.log(LOG_PREFIX + " [web] 蓝牙连接成功");
        return true;
    } catch (error) {
        Print._webServer = null;
        Print._webWriteChar = null;
        updateConnectionState(Print, "disconnected", { error: error.message || error });
        throw error;
    }
}

// ====================== 公共对话框样式 ======================

const BT_DIALOG_CSS = `
    #microi-bluetooth-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.5); z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    #microi-bt-dialog {
        background: #fff; border-radius: 12px; width: 420px; max-width: 92vw;
        max-height: 80vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
    }
    #microi-bt-header {
        padding: 16px 20px; background: linear-gradient(135deg, #409EFF, #337ecc);
        color: #fff; display: flex; align-items: center; justify-content: space-between;
    }
    #microi-bt-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
    #microi-bt-close {
        background: none; border: none; color: #fff; font-size: 22px;
        cursor: pointer; padding: 0 4px; opacity: 0.8; transition: opacity 0.2s;
    }
    #microi-bt-close:hover { opacity: 1; }
    #microi-bt-body { padding: 16px 20px; flex: 1; overflow-y: auto; }
    #microi-bt-status {
        padding: 10px 14px; border-radius: 8px; margin-bottom: 12px;
        font-size: 13px; color: #606266; background: #f4f4f5;
        display: flex; align-items: center; gap: 8px;
    }
    #microi-bt-status.connected { background: #f0f9eb; color: #67c23a; }
    #microi-bt-status.error { background: #fef0f0; color: #f56c6c; }
    #microi-bt-status.searching { background: #ecf5ff; color: #409eff; }
    .microi-bt-spinner {
        width: 16px; height: 16px; border: 2px solid currentColor;
        border-top-color: transparent; border-radius: 50%;
        animation: microi-bt-spin 0.8s linear infinite; flex-shrink: 0;
    }
    @keyframes microi-bt-spin { to { transform: rotate(360deg); } }
    #microi-bt-actions { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .microi-bt-btn {
        padding: 8px 16px; border-radius: 6px; border: 1px solid #dcdfe6;
        background: #fff; color: #606266; font-size: 13px; cursor: pointer;
        transition: all 0.2s; flex: 1; min-width: 100px; text-align: center;
    }
    .microi-bt-btn:hover { border-color: #409eff; color: #409eff; }
    .microi-bt-btn.primary { background: #409eff; color: #fff; border-color: #409eff; }
    .microi-bt-btn.primary:hover { background: #337ecc; border-color: #337ecc; }
    .microi-bt-btn.danger { background: #f56c6c; color: #fff; border-color: #f56c6c; }
    .microi-bt-btn.danger:hover { background: #dd4a4a; border-color: #dd4a4a; }
    .microi-bt-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    #microi-bt-device-list { max-height: 300px; overflow-y: auto; }
    .microi-bt-device {
        padding: 10px 14px; border: 1px solid #ebeef5; border-radius: 8px;
        margin-bottom: 8px; cursor: pointer; transition: all 0.2s;
        display: flex; align-items: center; justify-content: space-between;
    }
    .microi-bt-device:hover { border-color: #409eff; background: #ecf5ff; }
    .microi-bt-device.active { border-color: #67c23a; background: #f0f9eb; }
    .microi-bt-device-name { font-size: 13px; font-weight: 500; color: #303133; }
    .microi-bt-device-id { font-size: 11px; color: #909399; margin-top: 2px; }
    .microi-bt-device-badge {
        font-size: 11px; padding: 2px 8px; border-radius: 10px;
        background: #67c23a; color: #fff; flex-shrink: 0;
    }
    #microi-bt-info {
        margin-top: 12px; padding: 10px 14px; background: #fafafa;
        border-radius: 8px; font-size: 12px; color: #909399; line-height: 1.8;
    }
    #microi-bt-footer {
        padding: 12px 20px; border-top: 1px solid #ebeef5;
        display: flex; justify-content: flex-end; gap: 8px;
    }
    @media (max-width: 480px) {
        #microi-bt-dialog { width: 96vw; max-height: 90vh; }
        #microi-bt-actions { flex-direction: column; }
        .microi-bt-btn { min-width: auto; }
    }
`;

// ====================== 公共 UI 辅助 ======================

function _showConnectedDevice(el, name, id) {
    el.replaceChildren();
    var row = document.createElement("div");
    row.className = "microi-bt-device active";
    var content = document.createElement("div");
    var nameEl = document.createElement("div");
    nameEl.className = "microi-bt-device-name";
    nameEl.textContent = name || "未知设备";
    var idEl = document.createElement("div");
    idEl.className = "microi-bt-device-id";
    idEl.textContent = id || "";
    var badge = document.createElement("span");
    badge.className = "microi-bt-device-badge";
    badge.textContent = "已连接";
    content.append(nameEl, idEl);
    row.append(content, badge);
    el.appendChild(row);
}


// ======================================================================
//  5+App 蓝牙对话框（APK — plus.bluetooth，复刻旧 uni-app）
// ======================================================================

function showPlusBluetoothDialog(Print) {
    return new Promise(function (resolve) {
        if (document.getElementById("microi-bluetooth-overlay")) { resolve(false); return; }

        var overlay = document.createElement("div");
        overlay.id = "microi-bluetooth-overlay";
        overlay.innerHTML = '<style>' + BT_DIALOG_CSS + '</style>' +
            '<div id="microi-bt-dialog">' +
            '<div id="microi-bt-header"><h3>\uD83D\uDDA8\uFE0F 蓝牙打印机连接</h3><button id="microi-bt-close">&times;</button></div>' +
            '<div id="microi-bt-body">' +
            '<div id="microi-bt-status"><span id="microi-bt-status-icon"></span><span id="microi-bt-status-text">准备就绪，点击搜索蓝牙设备</span></div>' +
            '<div id="microi-bt-actions">' +
            '<button id="microi-bt-search" class="microi-bt-btn primary">\uD83D\uDD0D 开始搜索蓝牙</button>' +
            '<button id="microi-bt-stop" class="microi-bt-btn" style="display:none;">\u23F9\uFE0F 停止搜索</button>' +
            '<button id="microi-bt-disconnect" class="microi-bt-btn danger" style="display:none;">断开连接</button></div>' +
            '<div id="microi-bt-device-list"></div>' +
            '<div id="microi-bt-info"><div><b>使用说明：</b></div>' +
            '<div>1. 确保蓝牙打印机已开机</div>' +
            '<div>2. 点击搜索按钮，等待设备列表出现</div>' +
            '<div>3. 点击设备名称进行连接</div>' +
            '<div>4. 等待连接完成后即可使用打印功能</div></div></div>' +
            '<div id="microi-bt-footer">' +
            '<button id="microi-bt-cancel" class="microi-bt-btn">关闭</button>' +
            '<button id="microi-bt-test" class="microi-bt-btn" style="display:none;">\uD83E\uDDEA 打印测试</button></div></div>';
        document.body.appendChild(overlay);

        var statusEl = document.getElementById("microi-bt-status");
        var statusTextEl = document.getElementById("microi-bt-status-text");
        var statusIconEl = document.getElementById("microi-bt-status-icon");
        var searchBtn = document.getElementById("microi-bt-search");
        var stopBtn = document.getElementById("microi-bt-stop");
        var disconnectBtn = document.getElementById("microi-bt-disconnect");
        var deviceListEl = document.getElementById("microi-bt-device-list");
        var testBtn = document.getElementById("microi-bt-test");
        var unsubscribeConnection = null;
        var isSearching = false;
        var discoveredDevices = [];
        var searchRefreshTimer = null;

        function setStatus(text, type) {
            type = type || "info";
            statusTextEl.textContent = text;
            statusEl.className = type === "connected" ? "connected" : type === "error" ? "error" : type === "searching" ? "searching" : "";
            statusIconEl.innerHTML = type === "searching" ? '<div class="microi-bt-spinner"></div>' : "";
            if (type === "connected") { disconnectBtn.style.display = ""; testBtn.style.display = ""; stopBtn.style.display = "none"; }
        }

        function closeDialog(success) {
            if (isSearching) try { plus.bluetooth.stopBluetoothDevicesDiscovery(); } catch (e) { }
            if (searchRefreshTimer) clearTimeout(searchRefreshTimer);
            Print._plusDeviceFoundListeners.delete(onDevicesFound);
            if (unsubscribeConnection) unsubscribeConnection();
            document.removeEventListener("keydown", escHandler);
            var el = document.getElementById("microi-bluetooth-overlay");
            if (el) el.remove();
            resolve(success);
        }

        function renderDeviceList() {
            deviceListEl.replaceChildren();
            discoveredDevices.forEach(function (device) {
                var row = document.createElement("div");
                row.className = "microi-bt-device";
                var content = document.createElement("div");
                var nameEl = document.createElement("div");
                nameEl.className = "microi-bt-device-name";
                nameEl.textContent = device.name || "未知设备";
                var idEl = document.createElement("div");
                idEl.className = "microi-bt-device-id";
                idEl.textContent = device.deviceId || "";
                content.append(nameEl, idEl);
                row.appendChild(content);
                row.addEventListener("click", function () { connectDevice(device); });
                deviceListEl.appendChild(row);
            });
        }

        function onDevicesFound(result) {
            var list = result.devices || [];
            for (var i = 0; i < list.length; i++) {
                if (!list[i].name || list[i].name === "未知设备") continue;
                var exists = discoveredDevices.some(function (item) { return item.deviceId === list[i].deviceId; });
                if (!exists) discoveredDevices.push(list[i]);
            }
            renderDeviceList();
        }

        ensurePlusEventBridge(Print);
        Print._plusDeviceFoundListeners.add(onDevicesFound);

        // --- 搜索蓝牙设备（plus.bluetooth API）---
        function startSearch() {
            discoveredDevices = [];
            deviceListEl.innerHTML = "";
            isSearching = true;
            searchBtn.style.display = "none";
            stopBtn.style.display = "";

            plus.bluetooth.openBluetoothAdapter({
                success: function () {
                    plus.bluetooth.getBluetoothAdapterState({
                        success: function (res) {
                            if (!res.available) {
                                isSearching = false;
                                searchBtn.style.display = "";
                                stopBtn.style.display = "none";
                                setStatus("本机蓝牙不可用，请打开蓝牙", "error");
                                return;
                            }
                            setStatus("正在搜索蓝牙设备...", "searching");

                            plus.bluetooth.startBluetoothDevicesDiscovery({
                                success: function () {
                                    searchRefreshTimer = setTimeout(function () {
                                        plus.bluetooth.getBluetoothDevices({
                                            success: function (res2) {
                                                onDevicesFound(res2);
                                                if (discoveredDevices.length === 0) setStatus("未发现蓝牙设备，请确认打印机已开机", "searching");
                                                else setStatus("发现 " + discoveredDevices.length + " 个设备，点击连接", "searching");
                                            }
                                        });
                                    }, 3000);
                                },
                                fail: function (e) {
                                    isSearching = false;
                                    searchBtn.style.display = "";
                                    stopBtn.style.display = "none";
                                    setStatus("搜索失败: " + (e.errMsg || e.message || JSON.stringify(e)), "error");
                                }
                            });
                        }
                    });
                },
                fail: function () {
                    setStatus("蓝牙初始化失败，请打开蓝牙后重试", "error");
                    isSearching = false; searchBtn.style.display = ""; stopBtn.style.display = "none";
                }
            });
        }

        function stopSearch() {
            isSearching = false;
            try { plus.bluetooth.stopBluetoothDevicesDiscovery(); } catch (e) { }
            searchBtn.style.display = ""; stopBtn.style.display = "none";
            setStatus(discoveredDevices.length > 0 ? ("搜索已停止，发现 " + discoveredDevices.length + " 个设备") : "搜索已停止");
        }

        // --- 连接设备（与全局连接管理器共用同一条链路）---
        async function connectDevice(device) {
            if (isSearching) { try { plus.bluetooth.stopBluetoothDevicesDiscovery(); } catch (e) { } isSearching = false; }
            stopBtn.style.display = "none"; searchBtn.style.display = "none";
            try {
                await connectPlusDevice(Print, device, { onStatus: setStatus });
                _showConnectedDevice(deviceListEl, Print.BLEInformation.deviceName, Print.BLEInformation.deviceId);
            } catch (err) {
                setStatus("连接失败: " + err.message, "error");
                console.error(LOG_PREFIX + " [plus] 连接失败:", err);
                searchBtn.style.display = "";
            }
        }

        function disconnectDevice() {
            Print.disconnect();
            disconnectBtn.style.display = "none"; testBtn.style.display = "none";
            deviceListEl.innerHTML = ""; setStatus("已断开连接"); searchBtn.style.display = "";
        }

        async function testPrint() {
            try {
                setStatus("正在发送测试打印...", "searching");
                var command = tsc.jpPrinter.createNew();
                command.setSize(75, 65); command.setGap(2); command.setCls();
                command.setText(180, 10, "TSS24.BF2", 1, 1, "Microi.net 蓝牙打印测试");
                command.setText(10, 60, "TSS24.BF2", 1, 1, "平台版本：吾码 v3.0");
                command.setText(10, 100, "TSS24.BF2", 1, 1, "打印时间：" + new Date().toLocaleString());
                command.setQR(180, 200, "L", 5, "A", "https://microi.net");
                command.setPagePrint();
                await Print.prepareSend(command.getData());
                setStatus("测试打印发送成功！", "connected");
            } catch (e) { setStatus("测试打印失败: " + e.message, "error"); }
        }

        document.getElementById("microi-bt-close").addEventListener("click", function () { closeDialog(Print.isConnected()); });
        document.getElementById("microi-bt-cancel").addEventListener("click", function () { closeDialog(Print.isConnected()); });
        searchBtn.addEventListener("click", startSearch);
        stopBtn.addEventListener("click", stopSearch);
        disconnectBtn.addEventListener("click", disconnectDevice);
        testBtn.addEventListener("click", testPrint);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDialog(Print.isConnected()); });
        var escHandler = function (e) { if (e.key === "Escape") closeDialog(Print.isConnected()); };
        document.addEventListener("keydown", escHandler);

        unsubscribeConnection = Print.subscribeConnection(function (state) {
            if (state.connected) {
                setStatus("已连接: " + (state.deviceName || "蓝牙设备"), "connected");
                _showConnectedDevice(deviceListEl, state.deviceName, state.deviceId);
            } else if (state.status === "reconnecting") {
                setStatus("连接已断开，正在自动重连 " + (state.deviceName || "蓝牙设备") + "...", "searching");
            } else if (!isSearching && state.error) {
                disconnectBtn.style.display = "none";
                testBtn.style.display = "none";
                searchBtn.style.display = "";
                setStatus(state.error, "error");
            }
        });

        if (Print.isConnected()) {
            setStatus("已连接: " + (Print.BLEInformation.deviceName || "蓝牙设备"), "connected");
            _showConnectedDevice(deviceListEl, Print.BLEInformation.deviceName, Print.BLEInformation.deviceId);
        } else {
            var remembered = Print.getConnectionState();
            if (remembered.remembered) setStatus("已记住 " + (remembered.deviceName || "蓝牙打印机") + "，可点击搜索重新连接", "info");
        }
    });
}


// ======================================================================
//  Web Bluetooth 蓝牙对话框（PC/H5 浏览器）
// ======================================================================

function showWebBluetoothDialog(Print) {
    return new Promise(function (resolve) {
        if (document.getElementById("microi-bluetooth-overlay")) { resolve(false); return; }

        var overlay = document.createElement("div");
        overlay.id = "microi-bluetooth-overlay";
        overlay.innerHTML = '<style>' + BT_DIALOG_CSS + '</style>' +
            '<div id="microi-bt-dialog">' +
            '<div id="microi-bt-header"><h3>\uD83D\uDDA8\uFE0F 蓝牙打印机连接</h3><button id="microi-bt-close">&times;</button></div>' +
            '<div id="microi-bt-body">' +
            '<div id="microi-bt-status"><span id="microi-bt-status-icon"></span><span id="microi-bt-status-text">准备就绪，点击搜索蓝牙设备</span></div>' +
            '<div id="microi-bt-actions">' +
            '<button id="microi-bt-search" class="microi-bt-btn primary">\uD83D\uDD0D 搜索蓝牙设备</button>' +
            '<button id="microi-bt-disconnect" class="microi-bt-btn danger" style="display:none;">断开连接</button></div>' +
            '<div id="microi-bt-device-list"></div>' +
            '<div id="microi-bt-info"><div><b>使用说明：</b></div>' +
            '<div>1. 确保蓝牙打印机已开机</div>' +
            '<div>2. 点击"搜索蓝牙设备"按钮</div>' +
            '<div>3. 在浏览器弹出的设备选择框中选择打印机</div>' +
            '<div>4. 等待连接完成后即可使用打印功能</div>' +
            '<div style="margin-top:6px;color:#e6a23c;">\u26A0\uFE0F 需要使用 Chrome / Edge 浏览器，且需开启蓝牙权限</div></div></div>' +
            '<div id="microi-bt-footer">' +
            '<button id="microi-bt-cancel" class="microi-bt-btn">关闭</button>' +
            '<button id="microi-bt-test" class="microi-bt-btn" style="display:none;">\uD83E\uDDEA 打印测试</button></div></div>';
        document.body.appendChild(overlay);

        var statusTextEl = document.getElementById("microi-bt-status-text");
        var statusEl = document.getElementById("microi-bt-status");
        var statusIconEl = document.getElementById("microi-bt-status-icon");
        var searchBtn = document.getElementById("microi-bt-search");
        var disconnectBtn = document.getElementById("microi-bt-disconnect");
        var deviceListEl = document.getElementById("microi-bt-device-list");
        var testBtn = document.getElementById("microi-bt-test");
        var unsubscribeConnection = null;

        function setStatus(text, type) {
            type = type || "info";
            statusTextEl.textContent = text;
            statusEl.className = type === "connected" ? "connected" : type === "error" ? "error" : type === "searching" ? "searching" : "";
            statusIconEl.innerHTML = type === "searching" ? '<div class="microi-bt-spinner"></div>' : "";
            if (type === "connected") { disconnectBtn.style.display = ""; testBtn.style.display = ""; searchBtn.textContent = "\uD83D\uDD04 重新搜索"; }
        }

        function closeDialog(success) {
            if (unsubscribeConnection) unsubscribeConnection();
            document.removeEventListener("keydown", escHandler);
            var el = document.getElementById("microi-bluetooth-overlay");
            if (el) el.remove();
            resolve(success);
        }

        if (Print.isConnected()) {
            setStatus("已连接: " + (Print._webDevice.name || "蓝牙打印机"), "connected");
            _showConnectedDevice(deviceListEl, Print._webDevice.name, Print._webDevice.id);
        } else if (Print.getConnectionState().remembered) {
            setStatus("已记住 " + (Print.getConnectionState().deviceName || "蓝牙打印机") + "，可点击搜索重新连接", "info");
        }

        async function searchDevices() {
            if (!isWebBluetoothSupported()) {
                setStatus("当前浏览器不支持 Web Bluetooth API，请使用 Chrome 或 Edge 浏览器", "error"); return;
            }
            try {
                setStatus("正在搜索蓝牙设备（请在弹出框中选择打印机）...", "searching");
                searchBtn.disabled = true;

                var device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS });
                setStatus("已选择: " + (device.name || "未知设备") + "，正在连接...", "searching");
                await connectWebDevice(Print, device, { onStatus: setStatus });
                _showConnectedDevice(deviceListEl, device.name, device.id);
                searchBtn.disabled = false;
            } catch (error) {
                if (error.name === "NotFoundError") setStatus("未选择设备或取消了搜索", "info");
                else if (error.name === "SecurityError") setStatus("蓝牙权限被拒绝，请在浏览器设置中允许蓝牙访问", "error");
                else if (error.message && error.message.includes("User cancelled")) setStatus("已取消搜索", "info");
                else setStatus("连接失败: " + (error.message || error), "error");
                searchBtn.disabled = false;
            }
        }

        function disconnectDevice() {
            Print.disconnect();
            disconnectBtn.style.display = "none"; testBtn.style.display = "none";
            searchBtn.textContent = "\uD83D\uDD0D 搜索蓝牙设备";
            deviceListEl.innerHTML = ""; setStatus("已断开连接", "info");
        }

        async function testPrint() {
            try {
                setStatus("正在发送测试打印...", "searching");
                var command = tsc.jpPrinter.createNew();
                command.setSize(75, 65); command.setGap(2); command.setCls();
                command.setText(180, 10, "TSS24.BF2", 1, 1, "Microi.net 蓝牙打印测试");
                command.setText(10, 60, "TSS24.BF2", 1, 1, "平台版本：吾码 v3.0");
                command.setText(10, 100, "TSS24.BF2", 1, 1, "打印时间：" + new Date().toLocaleString());
                command.setQR(180, 200, "L", 5, "A", "https://microi.net");
                command.setText(10, 200, "TSS24.BF2", 1, 1, "扫码访问");
                command.setText(10, 240, "TSS24.BF2", 1, 1, "官网地址：");
                command.setPagePrint();
                await Print.prepareSend(command.getData());
                setStatus("测试打印发送成功！", "connected");
            } catch (e) { setStatus("测试打印失败: " + e.message, "error"); }
        }

        document.getElementById("microi-bt-close").addEventListener("click", function () { closeDialog(Print.isConnected()); });
        document.getElementById("microi-bt-cancel").addEventListener("click", function () { closeDialog(Print.isConnected()); });
        searchBtn.addEventListener("click", searchDevices);
        disconnectBtn.addEventListener("click", disconnectDevice);
        testBtn.addEventListener("click", testPrint);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDialog(Print.isConnected()); });
        var escHandler = function (e) { if (e.key === "Escape") closeDialog(Print.isConnected()); };
        document.addEventListener("keydown", escHandler);

        unsubscribeConnection = Print.subscribeConnection(function (state) {
            if (state.connected) {
                setStatus("已连接: " + (state.deviceName || "蓝牙打印机"), "connected");
                _showConnectedDevice(deviceListEl, state.deviceName, state.deviceId);
            } else if (state.status === "reconnecting") {
                setStatus("连接已断开，正在自动重连 " + (state.deviceName || "蓝牙打印机") + "...", "searching");
            } else if (state.error) {
                disconnectBtn.style.display = "none";
                testBtn.style.display = "none";
                searchBtn.textContent = "\uD83D\uDD0D 搜索蓝牙设备";
                setStatus(state.error, "error");
            }
        });
    });
}


// ======================================================================
//  V8.Print 核心模块（双引擎自适应）
// ======================================================================

function createV8Print(V8) {
    var rememberedInfo = restoreBLEInfo();
    var Print = {
        // ========== TSC/ESC 指令构建器 ==========
        createNew: tsc.jpPrinter.createNew,
        createNewESC: esc.jpPrinter.createNew,

        // ========== 历史公开发送字段（继续兼容） ==========
        sendContent: "", looptime: 0, currentTime: 1, lastData: 0, oneTimeData: 20,
        buffSize: [], buffIndex: 0, printNum: [], printNumIndex: 0,
        printerNum: 1, currentPrint: 1, isReceiptSend: false, isLabelSend: false,
        BLEInformation: emptyBLEInfo(),

        // ========== 应用级连接与发送状态 ==========
        _isMicroiSharedPrint: true,
        _rememberedInfo: rememberedInfo,
        _connectionState: null,
        _connectionListeners: new Set(),
        _plusDeviceFoundListeners: new Set(),
        _plusBridgeRegistered: false,
        _plusConnected: false,
        _webDevice: null,
        _webServer: null,
        _webWriteChar: null,
        _webDisconnectDevice: null,
        _webDisconnectHandler: null,
        _manualDisconnect: false,
        _suppressDisconnectUntil: 0,
        _reconnectAttempt: 0,
        _reconnectTimer: null,
        _reconnectPromise: null,
        _initializePromise: null,
        _initializedEngine: "",
        _runtimeListenersReady: false,
        _dialogPromise: null,
        _sendQueue: Promise.resolve(),
        _tipHandler: V8 && typeof V8.Tips === "function" ? V8.Tips : null,

        setTipHandler: function (handler) {
            if (typeof handler === "function") Print._tipHandler = handler;
        },

        /** 获取可订阅的权威连接快照。 */
        getConnectionState: function () {
            return getConnectionSnapshot(Print);
        },

        /** 订阅连接变化；立即回调一次当前快照，返回取消订阅函数。 */
        subscribeConnection: function (listener) {
            if (typeof listener !== "function") return function () { };
            Print._connectionListeners.add(listener);
            try { listener(getConnectionSnapshot(Print)); } catch (error) { console.error(LOG_PREFIX + " 状态监听失败:", error); }
            return function () { Print._connectionListeners.delete(listener); };
        },

        /** 打开统一蓝牙连接页。 */
        OpenBluetoothPage: function () {
            if (typeof document === "undefined") return Promise.resolve(false);
            if (Print._dialogPromise) return Print._dialogPromise;
            var dialogPromise = isPlusApp() ? showPlusBluetoothDialog(Print) : showWebBluetoothDialog(Print);
            Print._dialogPromise = Promise.resolve(dialogPromise).finally(function () { Print._dialogPromise = null; });
            return Print._dialogPromise;
        },

        /** 检测当前写通道是否仍可用。 */
        isConnected: function () {
            if (isPlusApp()) {
                return !!(Print._plusConnected && Print.BLEInformation.deviceId && Print.BLEInformation.writeCharaterId);
            }
            return !!(Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected && Print._webWriteChar);
        },

        /** 注册生命周期监听，并尝试恢复上次用户授权的设备。 */
        initializeConnection: function () {
            if (!Print._runtimeListenersReady) {
                Print._runtimeListenersReady = true;
                var resumeConnection = function () {
                    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
                    if (!Print.isConnected() && Print._rememberedInfo && !Print._manualDisconnect) {
                        Print._reconnectAttempt = 0;
                        Print._scheduleReconnect("页面恢复后重新连接蓝牙打印机");
                    } else {
                        updateConnectionState(Print, Print.isConnected() ? "connected" : undefined, { error: "" });
                    }
                };
                if (typeof document !== "undefined") {
                    document.addEventListener("plusready", function () {
                        ensurePlusEventBridge(Print);
                        resumeConnection();
                    }, false);
                    document.addEventListener("visibilitychange", resumeConnection, false);
                }
                if (typeof window !== "undefined") {
                    window.addEventListener("focus", resumeConnection, false);
                    window.addEventListener("pageshow", resumeConnection, false);
                }
                if (typeof navigator !== "undefined" && navigator.bluetooth && typeof navigator.bluetooth.addEventListener === "function") {
                    navigator.bluetooth.addEventListener("availabilitychanged", resumeConnection);
                }
            }
            if (Print._initializePromise) return Print._initializePromise;
            var currentEngine = getBLEEngine();
            if (Print._initializedEngine === currentEngine) return Promise.resolve(Print.isConnected());
            Print._initializedEngine = currentEngine;
            Print._initializePromise = (async function () {
                if (isPlusApp()) ensurePlusEventBridge(Print);
                if (!Print._rememberedInfo) {
                    updateConnectionState(Print, getBLEEngine() === "none" ? "unsupported" : "disconnected", { error: "" });
                    return false;
                }
                var connected = await Print.reconnect({ silent: true });
                if (!connected) Print._scheduleReconnect("恢复上次连接的蓝牙打印机失败");
                return connected;
            })().finally(function () { Print._initializePromise = null; });
            return Print._initializePromise;
        },

        /** 使用已记住的授权或设备 ID 重连，不触发浏览器设备选择框。 */
        reconnect: function (options) {
            options = options || {};
            if (Print.isConnected()) return Promise.resolve(true);
            if (Print._reconnectPromise) return Print._reconnectPromise;
            var remembered = normalizeBLEInfo(Print._rememberedInfo);
            if (!remembered) {
                updateConnectionState(Print, getBLEEngine() === "none" ? "unsupported" : "disconnected", { error: "未记住蓝牙打印机，请点击蓝牙图标连接" });
                return Promise.resolve(false);
            }

            Print._manualDisconnect = false;
            Print._reconnectPromise = (async function () {
                try {
                    if (isPlusApp()) {
                        return await connectPlusDevice(Print, {
                            deviceId: remembered.deviceId,
                            name: remembered.deviceName,
                        }, { reconnecting: true });
                    }
                    if (!isWebBluetoothSupported()) {
                        throw new Error("当前浏览器不支持 Web Bluetooth，无法自动重连");
                    }
                    var device = Print._webDevice && Print._webDevice.id === remembered.deviceId ? Print._webDevice : null;
                    if (!device && typeof navigator.bluetooth.getDevices === "function") {
                        var grantedDevices = await navigator.bluetooth.getDevices();
                        device = grantedDevices.find(function (item) { return item.id === remembered.deviceId; }) || null;
                    }
                    if (!device) throw new Error("浏览器未保留该设备授权，请点击蓝牙图标重新连接");
                    return await connectWebDevice(Print, device, { reconnecting: true });
                } catch (error) {
                    updateConnectionState(Print, "disconnected", { error: error.message || error });
                    if (!options.silent) console.error(LOG_PREFIX + " 自动重连失败:", error);
                    return false;
                }
            })().finally(function () { Print._reconnectPromise = null; });
            return Print._reconnectPromise;
        },

        _scheduleReconnect: function (reason) {
            if (Print._manualDisconnect || !Print._rememberedInfo || Print.isConnected()) return;
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            if (Print._reconnectTimer || Print._reconnectPromise) return;
            if (Print._reconnectAttempt >= RECONNECT_DELAYS.length) {
                updateConnectionState(Print, "disconnected", {
                    error: (reason || "蓝牙连接已断开") + "，自动重连未成功，请点击蓝牙图标重试"
                });
                return;
            }
            var reconnectDelay = RECONNECT_DELAYS[Print._reconnectAttempt];
            updateConnectionState(Print, "reconnecting", { error: "" });
            Print._reconnectTimer = setTimeout(async function () {
                Print._reconnectTimer = null;
                var connected = await Print.reconnect({ silent: true });
                if (!connected) {
                    Print._reconnectAttempt++;
                    Print._scheduleReconnect(reason);
                }
            }, reconnectDelay);
        },

        /** 自动恢复连接，并将所有 V8 调用排进同一条写队列。 */
        prepareSend: function (buff) {
            if (!buff || typeof buff.length !== "number" || buff.length <= 0) {
                return Promise.reject(new Error("打印数据不能为空"));
            }
            var run = async function () {
                if (!Print.isConnected()) {
                    if (Print._tipHandler) Print._tipHandler("蓝牙未连接，正在尝试恢复打印机连接", false);
                    var restored = await Print.reconnect({ silent: true });
                    if (!restored) await Print.OpenBluetoothPage();
                    if (!Print.isConnected()) throw new Error("蓝牙未连接");
                }
                await Print.Send(buff);
            };
            var task = Print._sendQueue.then(run, run);
            Print._sendQueue = task.catch(function () { });
            return task;
        },

        /** 内部分包写入；业务代码应调用 prepareSend。 */
        Send: async function (buff) {
            if (!Print.isConnected()) throw new Error("蓝牙未连接");
            var packetSize = Number(Print.oneTimeData);
            if (!Number.isInteger(packetSize) || packetSize <= 0) throw new Error("蓝牙分包字节数必须是正整数");
            var packetCount = Math.ceil(buff.length / packetSize);
            Print.looptime = packetCount;
            Print.lastData = buff.length % packetSize;
            Print.currentTime = 1;

            try {
                for (var copyIndex = 0; copyIndex < Print.printerNum; copyIndex++) {
                    Print.currentPrint = copyIndex + 1;
                    for (var packetIndex = 0; packetIndex < packetCount; packetIndex++) {
                        var start = packetIndex * packetSize;
                        var end = Math.min(start + packetSize, buff.length);
                        var chunk = new Uint8Array(end - start);
                        for (var byteIndex = start; byteIndex < end; byteIndex++) {
                            chunk[byteIndex - start] = Number(buff[byteIndex]) & 0xff;
                        }
                        Print.currentTime = packetIndex + 1;
                        if (isPlusApp()) {
                            await new Promise(function (resolve, reject) {
                                window.plus.bluetooth.writeBLECharacteristicValue({
                                    deviceId: Print.BLEInformation.deviceId,
                                    serviceId: Print.BLEInformation.writeServiceId,
                                    characteristicId: Print.BLEInformation.writeCharaterId,
                                    value: chunk.buffer,
                                    success: resolve,
                                    fail: function (error) { reject(new Error(error.errMsg || bleErrorTip(error.errCode || error.code))); }
                                });
                            });
                        } else {
                            if (!Print._webWriteChar) throw new Error("蓝牙写入特征已失效");
                            if (Print._webWriteChar.properties && Print._webWriteChar.properties.writeWithoutResponse && typeof Print._webWriteChar.writeValueWithoutResponse === "function") {
                                await Print._webWriteChar.writeValueWithoutResponse(chunk.buffer);
                            } else {
                                await Print._webWriteChar.writeValue(chunk.buffer);
                            }
                        }
                        if (packetIndex + 1 < packetCount) await delay(20);
                    }
                    if (copyIndex + 1 < Print.printerNum) await delay(100);
                }
            } catch (error) {
                if (!Print.isConnected() || /10006|断开|disconnected|GATT/i.test(String(error.message || error))) {
                    markUnexpectedDisconnect(Print, "蓝牙写入失败，连接已断开");
                }
                throw error;
            } finally {
                Print.looptime = 0;
                Print.lastData = 0;
                Print.currentTime = 1;
                Print.currentPrint = 1;
                Print.isReceiptSend = false;
                Print.isLabelSend = false;
            }
        },

        setOneTimeData: function (bytes) {
            var value = Number(bytes);
            if (!Number.isInteger(value) || value <= 0 || value > 512) throw new Error("蓝牙分包字节数必须是 1-512 的整数");
            Print.oneTimeData = value;
        },

        setPrinterNum: function (num) {
            var value = Number(num);
            if (!Number.isInteger(value) || value < 1 || value > 99) throw new Error("打印份数必须是 1-99 的整数");
            Print.printerNum = value;
        },

        /** 主动断开并忘记设备；不会触发自动重连。 */
        disconnect: function () {
            Print._manualDisconnect = true;
            Print._suppressDisconnectUntil = Date.now() + 2000;
            if (Print._reconnectTimer) {
                clearTimeout(Print._reconnectTimer);
                Print._reconnectTimer = null;
            }
            if (isPlusApp()) {
                try { if (Print.BLEInformation.deviceId) window.plus.bluetooth.closeBLEConnection({ deviceId: Print.BLEInformation.deviceId }); } catch (e) { }
            }
            try {
                if (Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected) Print._webDevice.gatt.disconnect();
            } catch (e) { }
            Print._webDevice = null;
            Print._rememberedInfo = null;
            clearLiveConnection(Print);
            saveBLEInfo(null);
            updateConnectionState(Print, getBLEEngine() === "none" ? "unsupported" : "disconnected", { error: "" });
            console.log(LOG_PREFIX + " 已主动断开连接");
        },
    };

    for (var packet = 20; packet < 200; packet += 10) Print.buffSize.push(packet);
    for (var copies = 1; copies < 10; copies++) Print.printNum.push(copies);
    Print.oneTimeData = Print.buffSize[0];
    Print.printerNum = Print.printNum[0];
    Print._connectionState = {
        engine: getBLEEngine(),
        supported: getBLEEngine() !== "none",
        status: getBLEEngine() === "none" ? "unsupported" : "disconnected",
        connected: false,
        remembered: !!rememberedInfo,
        deviceId: rememberedInfo ? rememberedInfo.deviceId : "",
        deviceName: rememberedInfo ? rememberedInfo.deviceName : "",
        autoReconnect: !!rememberedInfo,
        error: "",
        changedAt: Date.now(),
    };

    return Print;
}


// ====================== V8 与界面集成 ======================

export function getV8Print(V8) {
    if (!sharedPrintInstance) sharedPrintInstance = createV8Print(V8);
    if (V8 && typeof V8.Tips === "function") sharedPrintInstance.setTipHandler(V8.Tips);
    void sharedPrintInstance.initializeConnection();
    return sharedPrintInstance;
}

export function initV8Print(V8) {
    if (!V8) return;
    V8.Print = getV8Print(V8);
}

export { createV8Print, tsc, esc, isPlusApp, isWebBluetoothSupported, getBLEEngine };
