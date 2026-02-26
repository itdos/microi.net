/**
 * V8.Print 蓝牙打印模块
 * 
 * 为 PC/Mobile 浏览器提供蓝牙 BLE 打印能力，基于 Web Bluetooth API。
 * 从 microi.uniapp.uni-ui 的蓝牙打印功能移植而来，完整复刻了 V8.Print 的所有 API。
 * 
 * 功能特性：
 * - Web Bluetooth API 搜索/连接/发送
 * - TSC (TSPL) 标签打印指令构建器 (V8.Print.createNew)
 * - ESC/POS 票据打印指令构建器 (V8.Print.createNewESC)
 * - 自动分包发送 (V8.Print.prepareSend)
 * - BLE 设备管理与状态持久化 (sessionStorage)
 * - 蓝牙连接对话框 UI (V8.Print.OpenBluetoothPage)
 * 
 * V8引擎代码使用示例：
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

// 常用打印机 BLE 服务 UUID（佳博/芝柯等热敏打印机通用）
const PRINTER_SERVICE_UUIDS = [
    "000018f0-0000-1000-8000-00805f9b34fb", // 佳博打印机常用
    "0000ff00-0000-1000-8000-00805f9b34fb", // 部分打印机
    "49535343-fe7d-4ae5-8fa9-9fafd205e455", // 透传服务 (Microchip)
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Nordic UART
];

// ====================== 工具函数 ======================

/**
 * 检查当前浏览器是否支持 Web Bluetooth API
 */
function isWebBluetoothSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

/**
 * 从 sessionStorage 恢复 BLE 连接信息
 */
function restoreBLEInfo() {
    try {
        const saved = sessionStorage.getItem(BLE_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) { /* ignore */ }
    return null;
}

/**
 * 保存 BLE 连接信息到 sessionStorage
 */
function saveBLEInfo(info) {
    try {
        sessionStorage.setItem(BLE_STORAGE_KEY, JSON.stringify(info));
    } catch (e) { /* ignore */ }
}

// ====================== 蓝牙连接对话框 UI ======================

/**
 * 创建并显示蓝牙连接对话框
 * @param {Object} Print - V8.Print 对象引用
 * @returns {Promise<boolean>} 连接是否成功
 */
function showBluetoothDialog(Print) {
    return new Promise((resolve) => {
        // 防止重复打开
        if (document.getElementById("microi-bluetooth-overlay")) {
            resolve(false);
            return;
        }

        // 创建覆盖层
        const overlay = document.createElement("div");
        overlay.id = "microi-bluetooth-overlay";
        overlay.innerHTML = `
            <style>
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
                .microi-bt-btn.primary {
                    background: #409eff; color: #fff; border-color: #409eff;
                }
                .microi-bt-btn.primary:hover { background: #337ecc; border-color: #337ecc; }
                .microi-bt-btn.danger { background: #f56c6c; color: #fff; border-color: #f56c6c; }
                .microi-bt-btn.danger:hover { background: #dd4a4a; border-color: #dd4a4a; }
                .microi-bt-btn:disabled {
                    opacity: 0.5; cursor: not-allowed; pointer-events: none;
                }
                #microi-bt-device-list {
                    max-height: 300px; overflow-y: auto;
                }
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
            </style>
            <div id="microi-bt-dialog">
                <div id="microi-bt-header">
                    <h3>🖨️ 蓝牙打印机连接</h3>
                    <button id="microi-bt-close">&times;</button>
                </div>
                <div id="microi-bt-body">
                    <div id="microi-bt-status">
                        <span id="microi-bt-status-icon"></span>
                        <span id="microi-bt-status-text">准备就绪，点击搜索蓝牙设备</span>
                    </div>
                    <div id="microi-bt-actions">
                        <button id="microi-bt-search" class="microi-bt-btn primary">🔍 搜索蓝牙设备</button>
                        <button id="microi-bt-disconnect" class="microi-bt-btn danger" style="display:none;">断开连接</button>
                    </div>
                    <div id="microi-bt-device-list"></div>
                    <div id="microi-bt-info">
                        <div><b>使用说明：</b></div>
                        <div>1. 确保蓝牙打印机已开机</div>
                        <div>2. 点击"搜索蓝牙设备"按钮</div>
                        <div>3. 在浏览器弹出的设备选择框中选择打印机</div>
                        <div>4. 等待连接完成后即可使用打印功能</div>
                        <div style="margin-top:6px;color:#e6a23c;">⚠️ 需要使用 Chrome / Edge 浏览器，且需开启蓝牙权限</div>
                    </div>
                </div>
                <div id="microi-bt-footer">
                    <button id="microi-bt-cancel" class="microi-bt-btn">关闭</button>
                    <button id="microi-bt-test" class="microi-bt-btn" style="display:none;">🧪 打印测试</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // --- UI 控制函数 ---
        const statusEl = document.getElementById("microi-bt-status");
        const statusTextEl = document.getElementById("microi-bt-status-text");
        const statusIconEl = document.getElementById("microi-bt-status-icon");
        const searchBtn = document.getElementById("microi-bt-search");
        const disconnectBtn = document.getElementById("microi-bt-disconnect");
        const deviceListEl = document.getElementById("microi-bt-device-list");
        const testBtn = document.getElementById("microi-bt-test");

        function setStatus(text, type = "info") {
            statusTextEl.textContent = text;
            statusEl.className = type === "connected" ? "connected" : type === "error" ? "error" : type === "searching" ? "searching" : "";
            statusIconEl.innerHTML = type === "searching" ? '<div class="microi-bt-spinner"></div>' : "";
            // 如果已连接，显示断开和测试按钮
            if (type === "connected") {
                disconnectBtn.style.display = "";
                testBtn.style.display = "";
                searchBtn.textContent = "🔄 重新搜索";
            }
        }

        function showConnectedDevice(name, id) {
            deviceListEl.innerHTML = `
                <div class="microi-bt-device active">
                    <div>
                        <div class="microi-bt-device-name">${name || "未知设备"}</div>
                        <div class="microi-bt-device-id">${id || ""}</div>
                    </div>
                    <span class="microi-bt-device-badge">已连接</span>
                </div>
            `;
        }

        // 检查当前连接状态
        if (Print._device && Print._device.gatt && Print._device.gatt.connected) {
            setStatus(`已连接: ${Print._device.name || "蓝牙打印机"}`, "connected");
            showConnectedDevice(Print._device.name, Print._device.id);
        } else if (Print.BLEInformation && Print.BLEInformation.deviceId) {
            setStatus("之前的连接已断开，请重新搜索", "error");
        }

        function closeDialog(success) {
            const el = document.getElementById("microi-bluetooth-overlay");
            if (el) el.remove();
            resolve(success);
        }

        // --- 搜索蓝牙设备 ---
        async function searchDevices() {
            if (!isWebBluetoothSupported()) {
                setStatus("当前浏览器不支持 Web Bluetooth API，请使用 Chrome 或 Edge 浏览器", "error");
                return;
            }

            try {
                setStatus("正在搜索蓝牙设备（请在弹出框中选择打印机）...", "searching");
                searchBtn.disabled = true;

                // Web Bluetooth API 会弹出系统级设备选择器
                const device = await navigator.bluetooth.requestDevice({
                    // 接受所有蓝牙设备（用户在弹框中选择）
                    acceptAllDevices: true,
                    optionalServices: PRINTER_SERVICE_UUIDS
                });

                console.log(`${LOG_PREFIX} 已选择设备:`, device.name, device.id);
                setStatus(`已选择: ${device.name || "未知设备"}，正在连接...`, "searching");

                // 监听断开事件
                device.addEventListener("gattserverdisconnected", () => {
                    console.log(`${LOG_PREFIX} 设备已断开:`, device.name);
                    Print._device = null;
                    Print._server = null;
                    Print._writeCharacteristic = null;
                    Print.BLEInformation.deviceId = "";
                    Print.BLEInformation.writeServiceId = "";
                    Print.BLEInformation.writeCharaterId = "";
                    saveBLEInfo(null);
                });

                // 连接 GATT 服务器
                const server = await device.gatt.connect();
                console.log(`${LOG_PREFIX} GATT 已连接`);

                // 查找可写特征值
                let writeCharacteristic = null;
                let writeServiceId = "";
                let writeCharaterId = "";
                let notifyServiceId = "";
                let notifyCharaterId = "";
                let readServiceId = "";
                let readCharaterId = "";

                // 遍历已知服务UUID，查找写入特征
                const services = await server.getPrimaryServices();
                console.log(`${LOG_PREFIX} 发现 ${services.length} 个服务`);

                for (const service of services) {
                    try {
                        const characteristics = await service.getCharacteristics();
                        for (const char of characteristics) {
                            const props = char.properties;
                            if (props.write || props.writeWithoutResponse) {
                                if (!writeCharacteristic) {
                                    writeCharacteristic = char;
                                    writeServiceId = service.uuid;
                                    writeCharaterId = char.uuid;
                                    console.log(`${LOG_PREFIX} 发现写入特征:`, writeServiceId, writeCharaterId);
                                }
                            }
                            if (props.notify && !notifyServiceId) {
                                notifyServiceId = service.uuid;
                                notifyCharaterId = char.uuid;
                            }
                            if (props.read && !readServiceId) {
                                readServiceId = service.uuid;
                                readCharaterId = char.uuid;
                            }
                        }
                    } catch (e) {
                        console.log(`${LOG_PREFIX} 跳过服务 ${service.uuid}:`, e.message);
                    }
                }

                if (!writeCharacteristic) {
                    setStatus("未找到打印机的写入特征值，该设备可能不是打印机", "error");
                    searchBtn.disabled = false;
                    return;
                }

                // 保存连接信息
                Print._device = device;
                Print._server = server;
                Print._writeCharacteristic = writeCharacteristic;
                Print.BLEInformation = {
                    platform: navigator.platform || "",
                    deviceId: device.id,
                    deviceName: device.name || "未知设备",
                    writeServiceId: writeServiceId,
                    writeCharaterId: writeCharaterId,
                    notifyServiceId: notifyServiceId,
                    notifyCharaterId: notifyCharaterId,
                    readServiceId: readServiceId,
                    readCharaterId: readCharaterId,
                };

                saveBLEInfo({
                    deviceId: device.id,
                    deviceName: device.name,
                    writeServiceId: writeServiceId,
                    writeCharaterId: writeCharaterId,
                });

                setStatus(`已连接: ${device.name || "未知设备"}`, "connected");
                showConnectedDevice(device.name, device.id);
                searchBtn.disabled = false;
                console.log(`${LOG_PREFIX} 蓝牙连接成功！`, Print.BLEInformation);

            } catch (error) {
                console.log(`${LOG_PREFIX} 搜索/连接失败:`, error);
                if (error.name === "NotFoundError") {
                    setStatus("未选择设备或取消了搜索", "info");
                } else if (error.name === "SecurityError") {
                    setStatus("蓝牙权限被拒绝，请在浏览器设置中允许蓝牙访问", "error");
                } else if (error.message && error.message.includes("User cancelled")) {
                    setStatus("已取消搜索", "info");
                } else {
                    setStatus(`连接失败: ${error.message || error}`, "error");
                }
                searchBtn.disabled = false;
            }
        }

        // --- 断开连接 ---
        async function disconnectDevice() {
            try {
                if (Print._device && Print._device.gatt && Print._device.gatt.connected) {
                    Print._device.gatt.disconnect();
                }
                Print._device = null;
                Print._server = null;
                Print._writeCharacteristic = null;
                Print.BLEInformation.deviceId = "";
                Print.BLEInformation.writeServiceId = "";
                Print.BLEInformation.writeCharaterId = "";
                saveBLEInfo(null);
                disconnectBtn.style.display = "none";
                testBtn.style.display = "none";
                searchBtn.textContent = "🔍 搜索蓝牙设备";
                deviceListEl.innerHTML = "";
                setStatus("已断开连接", "info");
                console.log(`${LOG_PREFIX} 已断开蓝牙连接`);
            } catch (e) {
                console.log(`${LOG_PREFIX} 断开失败:`, e);
            }
        }

        // --- 打印测试 ---
        async function testPrint() {
            try {
                setStatus("正在发送测试打印...", "searching");
                var command = tsc.jpPrinter.createNew();
                command.setSize(75, 65);
                command.setGap(2);
                command.setCls();
                command.setText(180, 10, "TSS24.BF2", 1, 1, "Microi.net 蓝牙打印测试");
                command.setText(10, 60, "TSS24.BF2", 1, 1, "平台版本：吾码 v3.0");
                command.setText(10, 100, "TSS24.BF2", 1, 1, "打印时间：" + new Date().toLocaleString());
                command.setQR(180, 200, "L", 5, "A", "https://microi.net");
                command.setText(10, 200, "TSS24.BF2", 1, 1, "扫码访问");
                command.setText(10, 240, "TSS24.BF2", 1, 1, "官网地址：");
                command.setPagePrint();
                await Print.prepareSend(command.getData());
                setStatus("测试打印发送成功！", "connected");
            } catch (e) {
                setStatus(`测试打印失败: ${e.message}`, "error");
            }
        }

        // --- 绑定事件 ---
        document.getElementById("microi-bt-close").addEventListener("click", () => closeDialog(!!Print.BLEInformation.deviceId));
        document.getElementById("microi-bt-cancel").addEventListener("click", () => closeDialog(!!Print.BLEInformation.deviceId));
        searchBtn.addEventListener("click", searchDevices);
        disconnectBtn.addEventListener("click", disconnectDevice);
        testBtn.addEventListener("click", testPrint);

        // ESC 关闭
        const escHandler = (e) => {
            if (e.key === "Escape") {
                closeDialog(!!Print.BLEInformation.deviceId);
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);

        // 点击背景关闭
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeDialog(!!Print.BLEInformation.deviceId);
            }
        });
    });
}


// ====================== V8.Print 核心模块 ======================

/**
 * 创建 V8.Print 对象
 * @param {Object} V8 - V8引擎对象引用
 * @returns {Object} Print 对象
 */
function createV8Print(V8) {
    const Print = {
        // ========== TSC/ESC 指令构建器 ==========
        
        /** 创建 TSC(TSPL) 标签打印指令构建器 */
        createNew: tsc.jpPrinter.createNew,
        
        /** 创建 ESC/POS 票据打印指令构建器 */
        createNewESC: esc.jpPrinter.createNew,

        // ========== BLE 连接状态 ==========
        
        sendContent: "",
        looptime: 0,
        currentTime: 1,
        lastData: 0,
        oneTimeData: 20,
        buffSize: [],
        buffIndex: 0,
        printNum: [],
        printNumIndex: 0,
        printerNum: 1,
        currentPrint: 1,
        isReceiptSend: false,
        isLabelSend: false,

        /** BLE 设备连接信息 */
        BLEInformation: {
            platform: (typeof navigator !== "undefined" ? navigator.platform : "") || "",
            deviceId: "",
            deviceName: "",
            writeCharaterId: "",
            writeServiceId: "",
            notifyCharaterId: "",
            notifyServiceId: "",
            readCharaterId: "",
            readServiceId: "",
        },

        // Web Bluetooth 内部引用
        _device: null,
        _server: null,
        _writeCharacteristic: null,

        // ========== 核心 API ==========

        /**
         * 打开蓝牙连接页面
         * 弹出蓝牙设备搜索/连接对话框
         */
        OpenBluetoothPage: function () {
            console.log(`${LOG_PREFIX} 打开蓝牙连接页面`);
            return showBluetoothDialog(Print);
        },

        /**
         * 检测蓝牙是否已连接
         * @returns {boolean}
         */
        isConnected: function () {
            return !!(Print._device && Print._device.gatt && Print._device.gatt.connected && Print._writeCharacteristic);
        },

        /**
         * 准备发送打印数据（自动分包）
         * @param {Array|Uint8Array} buff - 打印指令字节数组
         * @returns {Promise<void>}
         */
        prepareSend: async function (buff) {
            if (!Print.isConnected()) {
                console.error(`${LOG_PREFIX} 蓝牙未连接，无法发送打印数据`);
                if (V8 && V8.Tips) {
                    V8.Tips("蓝牙未连接，请先连接打印机", false);
                }
                // 自动打开连接页面
                await Print.OpenBluetoothPage();
                if (!Print.isConnected()) {
                    throw new Error("蓝牙未连接");
                }
            }

            let time = Print.oneTimeData;
            let looptime = parseInt(buff.length / time);
            let lastData = parseInt(buff.length % time);
            Print.looptime = looptime + 1;
            Print.lastData = lastData;
            Print.currentTime = 1;

            console.log(`${LOG_PREFIX} 准备发送: 总${buff.length}字节, 每包${time}字节, 共${looptime + 1}包`);
            await Print.Send(buff);
        },

        /**
         * 分包发送数据（Web Bluetooth 版本）
         * 使用 async/await 替代原有的回调递归模式
         * @param {Array|Uint8Array} buff - 完整打印指令字节数组
         * @returns {Promise<void>}
         */
        Send: async function (buff) {
            var { currentTime, looptime: loopTime, lastData, oneTimeData: onTimeData, printerNum: printNum, currentPrint } = Print;

            console.log(`${LOG_PREFIX} 发送数据`, {
                currentTime, loopTime, lastData, oneTimeData: onTimeData, printerNum: printNum, currentPrint
            });

            while (Print.currentTime <= Print.looptime) {
                let buf;
                let dataView;

                if (Print.currentTime < Print.looptime) {
                    buf = new ArrayBuffer(onTimeData);
                    dataView = new DataView(buf);
                    for (var i = 0; i < onTimeData; ++i) {
                        dataView.setUint8(i, buff[(Print.currentTime - 1) * onTimeData + i]);
                    }
                } else {
                    buf = new ArrayBuffer(Print.lastData);
                    dataView = new DataView(buf);
                    for (var i = 0; i < Print.lastData; ++i) {
                        dataView.setUint8(i, buff[(Print.currentTime - 1) * onTimeData + i]);
                    }
                }

                console.log(`${LOG_PREFIX} 第${Print.currentTime}次发送，数据大小：${buf.byteLength}字节`);

                try {
                    // 使用 Web Bluetooth API 写入数据
                    if (Print._writeCharacteristic.properties.writeWithoutResponse) {
                        await Print._writeCharacteristic.writeValueWithoutResponse(buf);
                    } else {
                        await Print._writeCharacteristic.writeValue(buf);
                    }
                    console.log(`${LOG_PREFIX} 第${Print.currentTime}包发送成功`);
                } catch (error) {
                    console.error(`${LOG_PREFIX} 第${Print.currentTime}包发送失败:`, error);
                    throw error;
                }

                Print.currentTime++;

                // 短暂延时，避免蓝牙通道拥塞
                if (Print.currentTime <= Print.looptime) {
                    await new Promise(r => setTimeout(r, 20));
                }
            }

            // 发送完成
            console.log(`${LOG_PREFIX} 已打印第${Print.currentPrint}张`);

            if (Print.currentPrint < Print.printerNum) {
                // 多份打印
                Print.currentPrint++;
                Print.currentTime = 1;
                await new Promise(r => setTimeout(r, 100));
                await Print.Send(buff);
            } else {
                // 全部完成，重置状态
                Print.looptime = 0;
                Print.lastData = 0;
                Print.currentTime = 1;
                Print.isReceiptSend = false;
                Print.isLabelSend = false;
                Print.currentPrint = 1;
            }
        },

        /**
         * 设置每次发送的字节数
         * @param {number} bytes - 每次发送字节数 (建议20-200)
         */
        setOneTimeData: function (bytes) {
            Print.oneTimeData = bytes;
        },

        /**
         * 设置打印份数
         * @param {number} num - 打印份数
         */
        setPrinterNum: function (num) {
            Print.printerNum = num;
        },

        /**
         * 断开蓝牙连接
         */
        disconnect: function () {
            try {
                if (Print._device && Print._device.gatt && Print._device.gatt.connected) {
                    Print._device.gatt.disconnect();
                }
            } catch (e) { /* ignore */ }
            Print._device = null;
            Print._server = null;
            Print._writeCharacteristic = null;
            Print.BLEInformation.deviceId = "";
            Print.BLEInformation.writeServiceId = "";
            Print.BLEInformation.writeCharaterId = "";
            saveBLEInfo(null);
            console.log(`${LOG_PREFIX} 已断开连接`);
        },
    };

    // 初始化发送字节数选项和打印份数选项
    let list = [];
    let numList = [];
    let j = 0;
    for (let i = 20; i < 200; i += 10) {
        list[j] = i;
        j++;
    }
    for (let i = 1; i < 10; i++) {
        numList[i - 1] = i;
    }
    Print.buffSize = list;
    Print.oneTimeData = list[0]; // 默认20字节/包
    Print.printNum = numList;
    Print.printerNum = numList[0]; // 默认1份

    return Print;
}


// ====================== V8 集成 ======================

/**
 * 初始化 V8.Print 对象
 * 用于在 V8 引擎初始化时注册蓝牙打印功能
 * 
 * @param {Object} V8 - V8引擎对象
 */
export function initV8Print(V8) {
    if (!V8) return;

    // 如果 V8.Print 已存在且是完整的打印对象，直接返回（防止重复初始化）
    if (V8.Print && typeof V8.Print.createNew === "function" && typeof V8.Print.prepareSend === "function") {
        return;
    }

    V8.Print = createV8Print(V8);
    console.log(`${LOG_PREFIX} V8.Print 已初始化（Web Bluetooth API ${isWebBluetoothSupported() ? "可用" : "不可用"}）`);
}

export { tsc, esc, isWebBluetoothSupported };
