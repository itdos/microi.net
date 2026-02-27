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
 * - BLE 设备管理与状态持久化 (sessionStorage)
 * - 蓝牙连接对话框 UI (V8.Print.OpenBluetoothPage)
 *
 * V8引擎代码使用示例（与旧 uni-app 完全兼容）：
 *   if (!V8.Print || !V8.Print.BLEInformation || !V8.Print.BLEInformation.deviceId) {
 *       V8.Print.OpenBluetoothPage();
 *   } else {
 *       var cmd = V8.Print.createNew();
 *       cmd.setSize(75, 65);
 *       cmd.setGap(2);
 *       cmd.setCls();
 *       cmd.setText(220, 10, "TSS24.BF2", 1, 1, "产品标识卡");
 *       cmd.setQR(420, 300, "L", 5, "A", "https://microi.net");
 *       cmd.setPagePrint();
 *       V8.Print.prepareSend(cmd.getData());
 *   }
 */

import { tsc } from "./ble/tsc.js";
import { esc } from "./ble/esc.js";

// ====================== 常量 ======================
const BLE_STORAGE_KEY = "microi_ble_info";
const LOG_PREFIX = "Microi：【蓝牙打印】";

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
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

/** 获取蓝牙引擎类型标识 */
function getBLEEngine() {
    if (isPlusApp()) return "plus";
    if (isWebBluetoothSupported()) return "web";
    return "none";
}

// ====================== 持久化 ======================

function saveBLEInfo(info) {
    try { sessionStorage.setItem(BLE_STORAGE_KEY, JSON.stringify(info)); } catch (e) { }
}
function restoreBLEInfo() {
    try { var s = sessionStorage.getItem(BLE_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
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
    .microi-bt-device-name { font-size: 14px; font-weight: 500; color: #303133; }
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
    el.innerHTML = '<div class="microi-bt-device active"><div>' +
        '<div class="microi-bt-device-name">' + (name || "未知设备") + '</div>' +
        '<div class="microi-bt-device-id">' + (id || "") + '</div></div>' +
        '<span class="microi-bt-device-badge">已连接</span></div>';
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
        var isSearching = false;
        var discoveredDevices = [];

        function setStatus(text, type) {
            type = type || "info";
            statusTextEl.textContent = text;
            statusEl.className = type === "connected" ? "connected" : type === "error" ? "error" : type === "searching" ? "searching" : "";
            statusIconEl.innerHTML = type === "searching" ? '<div class="microi-bt-spinner"></div>' : "";
            if (type === "connected") { disconnectBtn.style.display = ""; testBtn.style.display = ""; stopBtn.style.display = "none"; }
        }

        function closeDialog(success) {
            if (isSearching) try { plus.bluetooth.stopBluetoothDevicesDiscovery(); } catch (e) { }
            var el = document.getElementById("microi-bluetooth-overlay");
            if (el) el.remove();
            resolve(success);
        }

        function renderDeviceList() {
            var html = "";
            for (var i = 0; i < discoveredDevices.length; i++) {
                var d = discoveredDevices[i];
                html += '<div class="microi-bt-device" data-idx="' + i + '"><div>' +
                    '<div class="microi-bt-device-name">' + (d.name || "未知设备") + '</div>' +
                    '<div class="microi-bt-device-id">' + d.deviceId + '</div></div></div>';
            }
            deviceListEl.innerHTML = html;
            deviceListEl.querySelectorAll(".microi-bt-device").forEach(function (el) {
                el.addEventListener("click", function () {
                    connectDevice(discoveredDevices[parseInt(el.dataset.idx)]);
                });
            });
        }

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
                            if (!res.available) { setStatus("本机蓝牙不可用，请打开蓝牙", "error"); return; }
                            setStatus("正在搜索蓝牙设备...", "searching");

                            plus.bluetooth.onBluetoothDeviceFound(function (result) {
                                var list = result.devices || [];
                                for (var i = 0; i < list.length; i++) {
                                    if (list[i].name && list[i].name !== "未知设备") {
                                        var exists = false;
                                        for (var j = 0; j < discoveredDevices.length; j++) {
                                            if (discoveredDevices[j].deviceId === list[i].deviceId) { exists = true; break; }
                                        }
                                        if (!exists) discoveredDevices.push(list[i]);
                                    }
                                }
                                renderDeviceList();
                            });

                            plus.bluetooth.startBluetoothDevicesDiscovery({
                                success: function () {
                                    setTimeout(function () {
                                        plus.bluetooth.getBluetoothDevices({
                                            success: function (res2) {
                                                var list = res2.devices || [];
                                                for (var i = 0; i < list.length; i++) {
                                                    if (list[i].name && list[i].name !== "未知设备") {
                                                        var exists = false;
                                                        for (var j = 0; j < discoveredDevices.length; j++) {
                                                            if (discoveredDevices[j].deviceId === list[i].deviceId) { exists = true; break; }
                                                        }
                                                        if (!exists) discoveredDevices.push(list[i]);
                                                    }
                                                }
                                                renderDeviceList();
                                                if (discoveredDevices.length === 0) setStatus("未发现蓝牙设备，请确认打印机已开机", "searching");
                                                else setStatus("发现 " + discoveredDevices.length + " 个设备，点击连接", "searching");
                                            }
                                        });
                                    }, 3000);
                                },
                                fail: function (e) { setStatus("搜索失败: " + (e.errMsg || e.message || JSON.stringify(e)), "error"); }
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

        // --- 连接设备（复刻 bleConnect.vue 完整流程）---
        async function connectDevice(device) {
            if (isSearching) { try { plus.bluetooth.stopBluetoothDevicesDiscovery(); } catch (e) { } isSearching = false; }
            stopBtn.style.display = "none"; searchBtn.style.display = "none";
            setStatus("正在连接 " + (device.name || "蓝牙设备") + "...", "searching");
            var deviceId = device.deviceId;

            try {
                await new Promise(function (ok, fail) {
                    plus.bluetooth.createBLEConnection({ deviceId: deviceId, success: ok, fail: function (e) { fail(new Error(bleErrorTip(e.errCode || e.code))); } });
                });
                Print.BLEInformation.deviceId = deviceId;

                await new Promise(function (r) { setTimeout(r, 1500); });

                var services = await new Promise(function (ok, fail) {
                    plus.bluetooth.getBLEDeviceServices({ deviceId: deviceId,
                        success: function (res) { ok(res.services || []); },
                        fail: function (e) { fail(new Error(bleErrorTip(e.errCode || e.code))); }
                    });
                });
                console.log(LOG_PREFIX + " 发现 " + services.length + " 个服务");

                var writeFound = false, readFound = false, notifyFound = false;
                for (var num = 0; num < services.length; num++) {
                    if (writeFound && readFound && notifyFound) break;
                    var chars = await new Promise(function (ok) {
                        plus.bluetooth.getBLEDeviceCharacteristics({ deviceId: deviceId, serviceId: services[num].uuid,
                            success: function (res) { ok(res.characteristics || []); }, fail: function () { ok([]); }
                        });
                    });
                    for (var ci = 0; ci < chars.length; ci++) {
                        var c = chars[ci], p = c.properties;
                        if (!notifyFound && p.notify) { Print.BLEInformation.notifyCharaterId = c.uuid; Print.BLEInformation.notifyServiceId = services[num].uuid; notifyFound = true; }
                        if (!writeFound && p.write) { Print.BLEInformation.writeCharaterId = c.uuid; Print.BLEInformation.writeServiceId = services[num].uuid; writeFound = true; }
                        if (!readFound && p.read) { Print.BLEInformation.readCharaterId = c.uuid; Print.BLEInformation.readServiceId = services[num].uuid; readFound = true; }
                    }
                }

                if (!writeFound) { setStatus("未找到打印机写入特征值，请换一个设备", "error"); searchBtn.style.display = ""; return; }

                Print.BLEInformation.deviceName = device.name || "未知设备";
                Print.BLEInformation.platform = navigator.platform || "";
                saveBLEInfo(Print.BLEInformation);
                setStatus("已连接: " + (device.name || "蓝牙设备"), "connected");
                _showConnectedDevice(deviceListEl, device.name, deviceId);
                console.log(LOG_PREFIX + " [plus] 蓝牙连接成功！", JSON.stringify(Print.BLEInformation));
            } catch (err) {
                setStatus("连接失败: " + err.message, "error");
                console.error(LOG_PREFIX + " [plus] 连接失败:", err);
                searchBtn.style.display = "";
            }
        }

        function disconnectDevice() {
            try { if (Print.BLEInformation.deviceId) plus.bluetooth.closeBLEConnection({ deviceId: Print.BLEInformation.deviceId }); } catch (e) { }
            Print.BLEInformation.deviceId = ""; Print.BLEInformation.writeServiceId = ""; Print.BLEInformation.writeCharaterId = "";
            saveBLEInfo(null); disconnectBtn.style.display = "none"; testBtn.style.display = "none";
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

        document.getElementById("microi-bt-close").addEventListener("click", function () { closeDialog(!!Print.BLEInformation.deviceId); });
        document.getElementById("microi-bt-cancel").addEventListener("click", function () { closeDialog(!!Print.BLEInformation.deviceId); });
        searchBtn.addEventListener("click", startSearch);
        stopBtn.addEventListener("click", stopSearch);
        disconnectBtn.addEventListener("click", disconnectDevice);
        testBtn.addEventListener("click", testPrint);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDialog(!!Print.BLEInformation.deviceId); });
        var escHandler = function (e) { if (e.key === "Escape") { closeDialog(!!Print.BLEInformation.deviceId); document.removeEventListener("keydown", escHandler); } };
        document.addEventListener("keydown", escHandler);

        if (Print.BLEInformation && Print.BLEInformation.deviceId) {
            setStatus("已连接: " + (Print.BLEInformation.deviceName || "蓝牙设备"), "connected");
            _showConnectedDevice(deviceListEl, Print.BLEInformation.deviceName, Print.BLEInformation.deviceId);
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

        function setStatus(text, type) {
            type = type || "info";
            statusTextEl.textContent = text;
            statusEl.className = type === "connected" ? "connected" : type === "error" ? "error" : type === "searching" ? "searching" : "";
            statusIconEl.innerHTML = type === "searching" ? '<div class="microi-bt-spinner"></div>' : "";
            if (type === "connected") { disconnectBtn.style.display = ""; testBtn.style.display = ""; searchBtn.textContent = "\uD83D\uDD04 重新搜索"; }
        }

        function closeDialog(success) {
            var el = document.getElementById("microi-bluetooth-overlay");
            if (el) el.remove();
            resolve(success);
        }

        if (Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected) {
            setStatus("已连接: " + (Print._webDevice.name || "蓝牙打印机"), "connected");
            _showConnectedDevice(deviceListEl, Print._webDevice.name, Print._webDevice.id);
        } else if (Print.BLEInformation && Print.BLEInformation.deviceId) {
            setStatus("之前的连接已断开，请重新搜索", "error");
        }

        async function searchDevices() {
            if (!isWebBluetoothSupported()) {
                setStatus("当前浏览器不支持 Web Bluetooth API，请使用 Chrome 或 Edge 浏览器", "error"); return;
            }
            try {
                setStatus("正在搜索蓝牙设备（请在弹出框中选择打印机）...", "searching");
                searchBtn.disabled = true;

                var device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS });
                console.log(LOG_PREFIX + " 已选择设备:", device.name, device.id);
                setStatus("已选择: " + (device.name || "未知设备") + "，正在连接...", "searching");

                device.addEventListener("gattserverdisconnected", function () {
                    Print._webDevice = null; Print._webServer = null; Print._webWriteChar = null;
                    Print.BLEInformation.deviceId = ""; Print.BLEInformation.writeServiceId = ""; Print.BLEInformation.writeCharaterId = "";
                    saveBLEInfo(null);
                });

                var server = await device.gatt.connect();
                var services = await server.getPrimaryServices();
                console.log(LOG_PREFIX + " 发现 " + services.length + " 个服务");

                var writeChar = null, writeServiceId = "", writeCharId = "";
                var notifyServiceId = "", notifyCharId = "", readServiceId = "", readCharId = "";

                for (var si = 0; si < services.length; si++) {
                    try {
                        var chars = await services[si].getCharacteristics();
                        for (var ci = 0; ci < chars.length; ci++) {
                            var props = chars[ci].properties;
                            if (!writeChar && (props.write || props.writeWithoutResponse)) {
                                writeChar = chars[ci]; writeServiceId = services[si].uuid; writeCharId = chars[ci].uuid;
                                console.log(LOG_PREFIX + " 发现写入特征:", writeServiceId, writeCharId);
                            }
                            if (!notifyServiceId && props.notify) { notifyServiceId = services[si].uuid; notifyCharId = chars[ci].uuid; }
                            if (!readServiceId && props.read) { readServiceId = services[si].uuid; readCharId = chars[ci].uuid; }
                        }
                    } catch (e) { console.log(LOG_PREFIX + " 跳过服务 " + services[si].uuid + ":", e.message); }
                }

                if (!writeChar) { setStatus("未找到打印机的写入特征值，该设备可能不是打印机", "error"); searchBtn.disabled = false; return; }

                Print._webDevice = device; Print._webServer = server; Print._webWriteChar = writeChar;
                Print.BLEInformation = {
                    platform: navigator.platform || "", deviceId: device.id, deviceName: device.name || "未知设备",
                    writeServiceId: writeServiceId, writeCharaterId: writeCharId,
                    notifyServiceId: notifyServiceId, notifyCharaterId: notifyCharId,
                    readServiceId: readServiceId, readCharaterId: readCharId,
                };
                saveBLEInfo(Print.BLEInformation);
                setStatus("已连接: " + (device.name || "未知设备"), "connected");
                _showConnectedDevice(deviceListEl, device.name, device.id);
                searchBtn.disabled = false;
                console.log(LOG_PREFIX + " [web] 蓝牙连接成功！", Print.BLEInformation);
            } catch (error) {
                if (error.name === "NotFoundError") setStatus("未选择设备或取消了搜索", "info");
                else if (error.name === "SecurityError") setStatus("蓝牙权限被拒绝，请在浏览器设置中允许蓝牙访问", "error");
                else if (error.message && error.message.includes("User cancelled")) setStatus("已取消搜索", "info");
                else setStatus("连接失败: " + (error.message || error), "error");
                searchBtn.disabled = false;
            }
        }

        function disconnectDevice() {
            try { if (Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected) Print._webDevice.gatt.disconnect(); } catch (e) { }
            Print._webDevice = null; Print._webServer = null; Print._webWriteChar = null;
            Print.BLEInformation.deviceId = ""; Print.BLEInformation.writeServiceId = ""; Print.BLEInformation.writeCharaterId = "";
            saveBLEInfo(null); disconnectBtn.style.display = "none"; testBtn.style.display = "none";
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

        document.getElementById("microi-bt-close").addEventListener("click", function () { closeDialog(!!Print.BLEInformation.deviceId); });
        document.getElementById("microi-bt-cancel").addEventListener("click", function () { closeDialog(!!Print.BLEInformation.deviceId); });
        searchBtn.addEventListener("click", searchDevices);
        disconnectBtn.addEventListener("click", disconnectDevice);
        testBtn.addEventListener("click", testPrint);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDialog(!!Print.BLEInformation.deviceId); });
        var escHandler = function (e) { if (e.key === "Escape") { closeDialog(!!Print.BLEInformation.deviceId); document.removeEventListener("keydown", escHandler); } };
        document.addEventListener("keydown", escHandler);
    });
}


// ======================================================================
//  V8.Print 核心模块（双引擎自适应）
// ======================================================================

function createV8Print(V8) {
    var engine = getBLEEngine();
    console.log(LOG_PREFIX + " 蓝牙引擎: " + engine + " (" + (engine === "plus" ? "5+App / APK" : engine === "web" ? "Web Bluetooth" : "不可用") + ")");

    var Print = {
        // ========== TSC/ESC 指令构建器 ==========
        createNew: tsc.jpPrinter.createNew,
        createNewESC: esc.jpPrinter.createNew,

        // ========== BLE 连接状态 ==========
        sendContent: "", looptime: 0, currentTime: 1, lastData: 0, oneTimeData: 20,
        buffSize: [], buffIndex: 0, printNum: [], printNumIndex: 0,
        printerNum: 1, currentPrint: 1, isReceiptSend: false, isLabelSend: false,

        BLEInformation: {
            platform: (typeof navigator !== "undefined" ? navigator.platform : "") || "",
            deviceId: "", deviceName: "",
            writeCharaterId: "", writeServiceId: "",
            notifyCharaterId: "", notifyServiceId: "",
            readCharaterId: "", readServiceId: "",
        },

        // Web Bluetooth 内部引用
        _webDevice: null, _webServer: null, _webWriteChar: null,

        // ========== 核心 API ==========

        /** 打开蓝牙连接页面 */
        OpenBluetoothPage: function () {
            console.log(LOG_PREFIX + " 打开蓝牙连接页面 (engine: " + getBLEEngine() + ")");
            if (isPlusApp()) return showPlusBluetoothDialog(Print);
            return showWebBluetoothDialog(Print);
        },

        /** 检测蓝牙是否已连接 */
        isConnected: function () {
            if (isPlusApp()) {
                return !!(Print.BLEInformation && Print.BLEInformation.deviceId && Print.BLEInformation.writeCharaterId);
            }
            return !!(Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected && Print._webWriteChar);
        },

        /** 准备发送打印数据（自动分包） */
        prepareSend: async function (buff) {
            if (!Print.isConnected()) {
                console.error(LOG_PREFIX + " 蓝牙未连接，无法发送打印数据");
                if (V8 && V8.Tips) V8.Tips("蓝牙未连接，请先连接打印机", false);
                await Print.OpenBluetoothPage();
                if (!Print.isConnected()) throw new Error("蓝牙未连接");
            }
            var time = Print.oneTimeData;
            var looptime = parseInt(buff.length / time);
            var lastData = parseInt(buff.length % time);
            Print.looptime = looptime + 1;
            Print.lastData = lastData;
            Print.currentTime = 1;
            console.log(LOG_PREFIX + " 准备发送: 总" + buff.length + "字节, 每包" + time + "字节, 共" + (looptime + 1) + "包");
            await Print.Send(buff);
        },

        /** 分包发送数据（双引擎自适应） */
        Send: async function (buff) {
            var onTimeData = Print.oneTimeData;

            while (Print.currentTime <= Print.looptime) {
                var buf, dataView;
                if (Print.currentTime < Print.looptime) {
                    buf = new ArrayBuffer(onTimeData);
                    dataView = new DataView(buf);
                    for (var i = 0; i < onTimeData; ++i) dataView.setUint8(i, buff[(Print.currentTime - 1) * onTimeData + i]);
                } else {
                    buf = new ArrayBuffer(Print.lastData);
                    dataView = new DataView(buf);
                    for (var i = 0; i < Print.lastData; ++i) dataView.setUint8(i, buff[(Print.currentTime - 1) * onTimeData + i]);
                }

                console.log(LOG_PREFIX + " 第" + Print.currentTime + "次发送: " + buf.byteLength + "字节");

                if (isPlusApp()) {
                    // === 5+App: plus.bluetooth.writeBLECharacteristicValue ===
                    await new Promise(function (ok, fail) {
                        plus.bluetooth.writeBLECharacteristicValue({
                            deviceId: Print.BLEInformation.deviceId,
                            serviceId: Print.BLEInformation.writeServiceId,
                            characteristicId: Print.BLEInformation.writeCharaterId,
                            value: buf,
                            success: function (res) { console.log(LOG_PREFIX + " [plus] 第" + Print.currentTime + "包成功"); ok(res); },
                            fail: function (e) { console.error(LOG_PREFIX + " [plus] 第" + Print.currentTime + "包失败:", e); fail(new Error(e.errMsg || JSON.stringify(e))); }
                        });
                    });
                } else {
                    // === Web Bluetooth: writeValue ===
                    try {
                        if (Print._webWriteChar.properties.writeWithoutResponse) {
                            await Print._webWriteChar.writeValueWithoutResponse(buf);
                        } else {
                            await Print._webWriteChar.writeValue(buf);
                        }
                    } catch (error) {
                        console.error(LOG_PREFIX + " [web] 第" + Print.currentTime + "包失败:", error);
                        throw error;
                    }
                }

                Print.currentTime++;
                if (Print.currentTime <= Print.looptime) await new Promise(function (r) { setTimeout(r, 20); });
            }

            console.log(LOG_PREFIX + " 已打印第" + Print.currentPrint + "张");
            if (Print.currentPrint < Print.printerNum) {
                Print.currentPrint++;
                Print.currentTime = 1;
                await new Promise(function (r) { setTimeout(r, 100); });
                await Print.Send(buff);
            } else {
                Print.looptime = 0; Print.lastData = 0; Print.currentTime = 1;
                Print.isReceiptSend = false; Print.isLabelSend = false; Print.currentPrint = 1;
            }
        },

        setOneTimeData: function (bytes) { Print.oneTimeData = bytes; },
        setPrinterNum: function (num) { Print.printerNum = num; },

        /** 断开蓝牙连接 */
        disconnect: function () {
            if (isPlusApp()) {
                try { if (Print.BLEInformation.deviceId) plus.bluetooth.closeBLEConnection({ deviceId: Print.BLEInformation.deviceId }); } catch (e) { }
            } else {
                try { if (Print._webDevice && Print._webDevice.gatt && Print._webDevice.gatt.connected) Print._webDevice.gatt.disconnect(); } catch (e) { }
                Print._webDevice = null; Print._webServer = null; Print._webWriteChar = null;
            }
            Print.BLEInformation.deviceId = ""; Print.BLEInformation.writeServiceId = ""; Print.BLEInformation.writeCharaterId = "";
            saveBLEInfo(null);
            console.log(LOG_PREFIX + " 已断开连接");
        },
    };

    // 初始化分包参数
    var list = [], numList = [], j = 0;
    for (var i = 20; i < 200; i += 10) { list[j] = i; j++; }
    for (var i = 1; i < 10; i++) { numList[i - 1] = i; }
    Print.buffSize = list;
    Print.oneTimeData = list[0];
    Print.printNum = numList;
    Print.printerNum = numList[0];

    return Print;
}


// ====================== V8 集成 ======================

export function initV8Print(V8) {
    if (!V8) return;
    if (V8.Print && typeof V8.Print.createNew === "function" && typeof V8.Print.prepareSend === "function") return;
    V8.Print = createV8Print(V8);
    console.log(LOG_PREFIX + " V8.Print 已初始化 (engine: " + getBLEEngine() + ")");
}

export { tsc, esc, isPlusApp, isWebBluetoothSupported, getBLEEngine };
