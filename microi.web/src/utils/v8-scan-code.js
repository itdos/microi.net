/**
 * V8 扫码功能模块 — ScanCode
 * ========================================
 * 为 V8 引擎提供 V8.Method.ScanCode() 扫码能力
 * 支持:
 *   1. 摄像头扫码（二维码 + 条形码）
 *   2. 手动输入条码
 *   3. 图片上传识别
 *
 * PC 浏览器端使用 html5-qrcode 库实现摄像头调用
 * 移动端 H5 同样通过此模块调用后置摄像头
 *
 * 用法（V8 引擎代码中）:
 *   if (V8.Method?.ScanCode) {
 *       await V8.Method.ScanCode();
 *       if (V8.ScanCodeRes) {
 *           V8.FormSet('FieldName', V8.ScanCodeRes);
 *       }
 *   }
 * ========================================
 */

import { ElMessageBox } from 'element-plus'

let _scanDialogInstance = null
let _resolveCallback = null

/**
 * 创建扫码弹窗 DOM 结构
 * @returns {HTMLElement} 弹窗容器
 */
function createScanDialog() {
    if (_scanDialogInstance) {
        return _scanDialogInstance
    }

    const overlay = document.createElement('div')
    overlay.id = 'microi-scan-overlay'
    overlay.innerHTML = `
        <div class="microi-scan-dialog">
            <div class="microi-scan-header">
                <span class="microi-scan-title">📷 扫一扫</span>
                <div class="microi-scan-header-btns">
                    <button class="microi-scan-switch-btn" id="microiScanSwitchBtn" title="切换摄像头">🔄</button>
                    <button class="microi-scan-close-btn" id="microiScanCloseBtn">✕</button>
                </div>
            </div>
            <div class="microi-scan-body">
                <div id="microiScanReader" class="microi-scan-reader"></div>
                <div class="microi-scan-status" id="microiScanStatus">正在初始化摄像头...</div>
            </div>
            <div class="microi-scan-footer">
                <div class="microi-scan-manual">
                    <input type="text" id="microiScanManualInput" class="microi-scan-input" placeholder="或手动输入条码/编号" />
                    <button class="microi-scan-confirm-btn" id="microiScanConfirmBtn">确定</button>
                </div>
                <div class="microi-scan-actions">
                    <button class="microi-scan-upload-btn" id="microiScanUploadBtn">📁 从图片识别</button>
                    <input type="file" id="microiScanFileInput" accept="image/*" style="display:none" />
                </div>
            </div>
        </div>
    `

    // 注入样式
    if (!document.getElementById('microi-scan-style')) {
        const style = document.createElement('style')
        style.id = 'microi-scan-style'
        style.textContent = `
            #microi-scan-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: microiScanFadeIn 0.2s ease;
            }
            @keyframes microiScanFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .microi-scan-dialog {
                background: #fff;
                border-radius: 12px;
                width: 520px;
                max-width: 95vw;
                max-height: 90vh;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .microi-scan-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid #f0f0f0;
                background: #fafafa;
            }
            .microi-scan-title {
                font-size: 16px;
                font-weight: 600;
                color: #303133;
            }
            .microi-scan-header-btns {
                display: flex;
                gap: 8px;
            }
            .microi-scan-switch-btn, .microi-scan-close-btn {
                width: 32px; height: 32px;
                border: none;
                background: #f0f0f0;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .microi-scan-switch-btn:hover, .microi-scan-close-btn:hover {
                background: #e0e0e0;
            }
            .microi-scan-body {
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 300px;
            }
            .microi-scan-reader {
                width: 100%;
                max-width: 460px;
                min-height: 280px;
                border-radius: 8px;
                overflow: hidden;
                background: #000;
            }
            /* 覆盖 html5-qrcode 内部样式 */
            #microiScanReader video {
                border-radius: 8px;
            }
            #microiScanReader img[alt="Info icon"] {
                display: none !important;
            }
            #html5-qrcode-button-camera-permission,
            #html5-qrcode-button-camera-start,
            #html5-qrcode-button-camera-stop,
            #html5-qrcode-anchor-scan-type-change {
                display: none !important;
            }
            .microi-scan-status {
                margin-top: 12px;
                font-size: 13px;
                color: #909399;
                text-align: center;
            }
            .microi-scan-footer {
                padding: 16px 20px;
                border-top: 1px solid #f0f0f0;
                background: #fafafa;
            }
            .microi-scan-manual {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }
            .microi-scan-input {
                flex: 1;
                height: 36px;
                padding: 0 12px;
                border: 1px solid #dcdfe6;
                border-radius: 6px;
                font-size: 14px;
                outline: none;
                transition: border 0.2s;
            }
            .microi-scan-input:focus {
                border-color: var(--el-color-primary, #409eff);
            }
            .microi-scan-confirm-btn {
                padding: 0 20px;
                height: 36px;
                border: none;
                background: var(--el-color-primary, #409eff);
                color: #fff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                white-space: nowrap;
                transition: opacity 0.2s;
            }
            .microi-scan-confirm-btn:hover { opacity: 0.85; }
            .microi-scan-actions {
                display: flex;
                justify-content: center;
            }
            .microi-scan-upload-btn {
                padding: 6px 16px;
                border: 1px solid #dcdfe6;
                background: #fff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                color: #606266;
                transition: all 0.2s;
            }
            .microi-scan-upload-btn:hover {
                border-color: var(--el-color-primary, #409eff);
                color: var(--el-color-primary, #409eff);
            }
            /* 移动端自适应 */
            @media (max-width: 600px) {
                .microi-scan-dialog { 
                    width: 100%; 
                    max-width: 100vw;
                    max-height: 100vh;
                    border-radius: 0; 
                    height: 100vh;
                }
                .microi-scan-body { min-height: 40vh; }
                .microi-scan-reader { min-height: 35vh; }
            }
        `
        document.head.appendChild(style)
    }

    document.body.appendChild(overlay)
    _scanDialogInstance = overlay
    return overlay
}

/**
 * 销毁扫码弹窗
 */
function destroyScanDialog() {
    if (_scanDialogInstance) {
        _scanDialogInstance.remove()
        _scanDialogInstance = null
    }
}

/**
 * 完成扫码，返回结果并关闭弹窗
 * @param {string} result 扫码结果
 */
function completeScan(result) {
    stopScanner()
    destroyScanDialog()
    if (_resolveCallback) {
        _resolveCallback(result)
        _resolveCallback = null
    }
}

/**
 * 取消扫码
 */
function cancelScan() {
    stopScanner()
    destroyScanDialog()
    if (_resolveCallback) {
        _resolveCallback(null)
        _resolveCallback = null
    }
}

let _html5QrCode = null
let _currentCameraIndex = 0
let _cameraList = []

/**
 * 检测是否在微信内置浏览器中
 */
function isWeChatBrowser() {
    return /MicroMessenger/i.test(navigator.userAgent)
}

/**
 * 检测是否在 5+App 环境中
 */
function isPlusApp() {
    return typeof window !== 'undefined' && !!window.plus
}

/**
 * 检测是否为移动端
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * 微信 JSSDK 扫码（微信内置浏览器环境）
 * 需要页面已通过 wx.config 初始化 JSSDK
 * @returns {Promise<string|null>}
 */
function wechatScanCode() {
    return new Promise(function (resolve) {
        if (typeof wx === 'undefined' || !wx.scanQRCode) {
            resolve(null)
            return
        }
        wx.scanQRCode({
            needResult: 1,
            scanType: ["qrCode", "barCode"],
            success: function (res) {
                var result = res.resultStr || ''
                // 微信条码结果格式可能是 "TYPE,VALUE"
                if (result.indexOf(',') > 0) {
                    result = result.split(',').slice(1).join(',')
                }
                resolve(result)
            },
            fail: function () { resolve(null) },
            cancel: function () { resolve(null) }
        })
    })
}

/**
 * 5+App 原生扫码（APK 环境）
 * @returns {Promise<string|null>}
 */
function plusBarcodeScan() {
    return new Promise(function (resolve) {
        if (!window.plus || !plus.barcode) {
            resolve(null)
            return
        }
        plus.barcode.scan(
            '_www/barcode.html',
            function (type, result) { resolve(result || null) },
            function () { resolve(null) }
        )
    })
}

/**
 * 停止扫码器
 */
async function stopScanner() {
    if (_html5QrCode) {
        try {
            const state = _html5QrCode.getState()
            // state 2 = SCANNING, 3 = PAUSED
            if (state === 2 || state === 3) {
                await _html5QrCode.stop()
            }
        } catch (e) {
            // ignore
        }
        try {
            _html5QrCode.clear()
        } catch (e) {
            // ignore
        }
        _html5QrCode = null
    }
}

/**
 * 启动摄像头扫码（兼容移动端）
 * 
 * 策略优先级：
 * 1. 5+App 环境 → plus.barcode 原生扫码
 * 2. 微信内置浏览器 → wx.scanQRCode JSSDK
 * 3. 其他浏览器 → html5-qrcode（先 getCameras，失败则用 facingMode）
 * 
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function startCameraScanner(statusEl) {
    // === 策略1: 5+App 原生扫码 ===
    if (isPlusApp() && window.plus && plus.barcode) {
        if (statusEl) statusEl.textContent = '正在启动原生扫码...'
        try {
            var result = await plusBarcodeScan()
            if (result) { completeScan(result); return }
            if (statusEl) statusEl.textContent = '扫码已取消，请手动输入条码'
        } catch (e) {
            if (statusEl) statusEl.textContent = '原生扫码失败，请手动输入条码'
        }
        return
    }

    // === 策略2: 微信 JSSDK 扫码 ===
    if (isWeChatBrowser() && typeof wx !== 'undefined' && wx.scanQRCode) {
        if (statusEl) statusEl.textContent = '正在调用微信扫一扫...'
        try {
            var result = await wechatScanCode()
            if (result) { completeScan(result); return }
            if (statusEl) statusEl.textContent = '微信扫码已取消，请手动输入条码'
        } catch (e) {
            if (statusEl) statusEl.textContent = '微信扫码失败，请手动输入条码'
        }
        return
    }

    // === 策略3: html5-qrcode 摄像头扫码 ===
    try {
        const { Html5Qrcode } = await import('html5-qrcode')
        
        _html5QrCode = new Html5Qrcode('microiScanReader', { verbose: false })

        var scanConfig = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        }
        var onSuccess = function (decodedText) { completeScan(decodedText) }
        var onError = function () { /* 扫码中，忽略空结果 */ }

        // 先尝试获取摄像头列表
        var cameraListOk = false
        try {
            _cameraList = await Html5Qrcode.getCameras()
            if (_cameraList && _cameraList.length > 0) cameraListOk = true
        } catch (e) {
            console.log('[ScanCode] getCameras 失败（移动端常见），将使用 facingMode 兜底:', e.message || e)
            _cameraList = []
        }

        if (cameraListOk) {
            // 获取到摄像头列表 — 优先使用后置摄像头
            let cameraId = _cameraList[_currentCameraIndex % _cameraList.length].id
            for (const cam of _cameraList) {
                if (cam.label && (cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('rear') || cam.label.toLowerCase().includes('environment'))) {
                    cameraId = cam.id
                    break
                }
            }
            if (statusEl) statusEl.textContent = '对准二维码/条形码...'
            await _html5QrCode.start(cameraId, scanConfig, onSuccess, onError)
        } else {
            // 获取摄像头列表失败（移动端浏览器常见）— 使用 facingMode 约束直接启动
            // 这种方式会触发浏览器摄像头权限弹窗，不需要先 enumerateDevices
            if (statusEl) statusEl.textContent = '正在请求摄像头权限...'
            try {
                await _html5QrCode.start(
                    { facingMode: "environment" },
                    scanConfig,
                    onSuccess,
                    onError
                )
                if (statusEl) statusEl.textContent = '对准二维码/条形码...'
            } catch (facingErr) {
                console.log('[ScanCode] facingMode=environment 失败，尝试 user:', facingErr.message)
                // 后置摄像头失败，尝试前置摄像头
                try {
                    await _html5QrCode.start(
                        { facingMode: "user" },
                        scanConfig,
                        onSuccess,
                        onError
                    )
                    if (statusEl) statusEl.textContent = '对准二维码/条形码...'
                } catch (userErr) {
                    console.error('[ScanCode] 所有摄像头启动方式均失败:', userErr)
                    // 最终降级：提示用户手动输入或使用图片识别
                    if (statusEl) {
                        if (isWeChatBrowser()) {
                            statusEl.textContent = '微信浏览器暂不支持网页摄像头，请使用图片识别或手动输入条码'
                        } else {
                            statusEl.textContent = '无法访问摄像头，请使用图片识别或手动输入条码'
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('[ScanCode] 摄像头启动失败:', err)
        if (statusEl) {
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头，或手动输入条码'
            } else if (err.name === 'NotFoundError') {
                statusEl.textContent = '未找到摄像头设备，请手动输入条码'
            } else {
                statusEl.textContent = '摄像头初始化失败: ' + (err.message || err) + '，请手动输入条码'
            }
        }
    }
}

/**
 * 从图片文件识别二维码/条形码
 * @param {File} file 图片文件
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function scanFromFile(file, statusEl) {
    try {
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!_html5QrCode) {
            _html5QrCode = new Html5Qrcode('microiScanReader', { verbose: false })
        }

        // 先停止摄像头
        try {
            const state = _html5QrCode.getState()
            if (state === 2 || state === 3) {
                await _html5QrCode.stop()
            }
        } catch (e) {}

        if (statusEl) statusEl.textContent = '正在识别图片中的码...'

        const result = await _html5QrCode.scanFile(file, true)
        completeScan(result)
    } catch (err) {
        console.error('[ScanCode] 图片识别失败:', err)
        if (statusEl) statusEl.textContent = '图片中未识别到有效的二维码/条形码，请重试'
        // 重新启动摄像头
        setTimeout(() => startCameraScanner(statusEl), 1000)
    }
}

/**
 * 切换摄像头（前置/后置）
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function switchCamera(statusEl) {
    if (_cameraList.length <= 1 && _cameraList.length > 0) {
        if (statusEl) statusEl.textContent = '只有一个摄像头，无法切换'
        setTimeout(() => { if (statusEl) statusEl.textContent = '对准二维码/条形码...' }, 1500)
        return
    }
    // 停止当前
    await stopScanner()
    if (_cameraList.length > 1) {
        _currentCameraIndex = (_currentCameraIndex + 1) % _cameraList.length
    }
    if (statusEl) statusEl.textContent = '切换摄像头中...'
    await startCameraScanner(statusEl)
}

/**
 * V8.Method.ScanCode — 主入口
 * 打开扫码弹窗，成功后将结果写入 V8.ScanCodeRes
 * @param {object} V8 — V8 引擎对象
 * @returns {Promise<void>}
 */
export function createScanCodeMethod(V8) {
    return function ScanCode() {
        return new Promise((resolve) => {
            _resolveCallback = (result) => {
                V8.ScanCodeRes = result || ''
                resolve()
            }

            // 创建弹窗
            const overlay = createScanDialog()
            const statusEl = document.getElementById('microiScanStatus')
            const closeBtn = document.getElementById('microiScanCloseBtn')
            const switchBtn = document.getElementById('microiScanSwitchBtn')
            const confirmBtn = document.getElementById('microiScanConfirmBtn')
            const manualInput = document.getElementById('microiScanManualInput')
            const uploadBtn = document.getElementById('microiScanUploadBtn')
            const fileInput = document.getElementById('microiScanFileInput')

            // 关闭按钮
            closeBtn.onclick = () => cancelScan()

            // 点击遮罩关闭
            overlay.onclick = (e) => {
                if (e.target === overlay) cancelScan()
            }

            // ESC 关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    cancelScan()
                    document.removeEventListener('keydown', escHandler)
                }
            }
            document.addEventListener('keydown', escHandler)

            // 切换摄像头
            switchBtn.onclick = () => switchCamera(statusEl)

            // 手动输入确认
            confirmBtn.onclick = () => {
                const val = manualInput.value.trim()
                if (val) {
                    completeScan(val)
                }
            }
            // 回车确认
            manualInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const val = manualInput.value.trim()
                    if (val) {
                        completeScan(val)
                    }
                }
            }

            // 图片上传识别
            uploadBtn.onclick = () => fileInput.click()
            fileInput.onchange = (e) => {
                const file = e.target.files && e.target.files[0]
                if (file) {
                    scanFromFile(file, statusEl)
                }
                fileInput.value = '' // reset
            }

            // 启动摄像头
            startCameraScanner(statusEl)
        })
    }
}

/**
 * 初始化 V8.Method 对象并注册 ScanCode
 * 在 SetV8DefaultValue 或 InitV8CodeSync 中调用
 * @param {object} V8 — V8 引擎对象
 */
export function initV8ScanCode(V8) {
    if (!V8.Method) {
        V8.Method = {}
    }
    V8.Method.ScanCode = createScanCodeMethod(V8)
    // 初始化 ScanCodeRes 属性
    if (V8.ScanCodeRes === undefined) {
        V8.ScanCodeRes = null
    }
}

export default {
    createScanCodeMethod,
    initV8ScanCode
}
