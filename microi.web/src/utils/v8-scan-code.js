/**
 * V8 扫码功能模块 — ScanCode
 * ========================================
 * 为 V8 引擎提供 V8.Method.ScanCode() 扫码能力
 * 支持:
 *   1. 摄像头扫码（二维码 + 条形码）
 *   2. 手动输入条码
 *   3. 图片上传识别
 *
 * 摄像头扫码使用 navigator.mediaDevices.getUserMedia 直接调用
 * + jsQR 逐帧解码（与旧版 mumu-getQrcode 方案一致，兼容性最佳）
 * + BarcodeDetector API 识别条形码（现代浏览器支持）
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

import jsQR from 'jsqr'

let _scanDialogInstance = null
let _resolveCallback = null
let _videoElement = null
let _canvasElement = null
let _canvas2d = null
let _scanAnimFrameId = null
let _mediaStream = null
let _currentFacingMode = 'environment' // 当前摄像头方向
let _barcodeDetector = null // BarcodeDetector 实例（如浏览器支持）
let _isScanning = false
let _cameraFailed = false // 标记摄像头是否已确认不可用（用于控制拍照失败后是否重启摄像头）
let _nativeBarcodeInstance = null // 原生 plus.barcode 扫码控件实例

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
                <div id="microiScanReader" class="microi-scan-reader">
                    <video id="microiScanVideo" autoplay playsinline muted></video>
                    <div class="microi-scan-box">
                        <div class="microi-scan-line"></div>
                        <div class="microi-scan-angle"></div>
                    </div>
                </div>
                <canvas id="microiScanCanvas" style="display:none;"></canvas>
                <div class="microi-scan-status" id="microiScanStatus">正在初始化摄像头...</div>
            </div>
            <div class="microi-scan-footer">
                <div class="microi-scan-manual">
                    <input type="text" id="microiScanManualInput" class="microi-scan-input" placeholder="或手动输入条码/编号" />
                    <button class="microi-scan-confirm-btn" id="microiScanConfirmBtn">确定</button>
                </div>
                <div class="microi-scan-actions">
                    <button class="microi-scan-capture-btn" id="microiScanCaptureBtn">📸 拍照识别</button>
                    <button class="microi-scan-upload-btn" id="microiScanUploadBtn">📁 从图片识别</button>
                    <input type="file" id="microiScanFileInput" accept="image/*" style="display:none" />
                    <input type="file" id="microiScanCaptureInput" accept="image/*" capture="environment" style="display:none" />
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
                top: 0; 
                left: 0; 
                right: 0; 
                bottom: 0;
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
                padding-top: 16px;
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
                // min-height: 300px;
            }
            .microi-scan-reader {
                width: 100%;
                max-width: 460px;
                // min-height: 280px;
                border-radius: 8px;
                overflow: hidden;
                background: #000;
                position: relative;
            }
            #microiScanVideo {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                border-radius: 8px;
            }
            /* 扫描框动画 */
            .microi-scan-box {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 200px; height: 200px;
                border: 1px solid rgba(0, 255, 51, 0.3);
                z-index: 2;
                overflow: hidden;
            }
            .microi-scan-line {
                width: 100%; height: calc(100% - 2px);
                background: linear-gradient(180deg, rgba(0,255,51,0) 43%, #00ff33 211%);
                border-bottom: 3px solid #00ff33;
                transform: translateY(-100%);
                animation: microiScanBeam 2s infinite alternate;
                animation-timing-function: cubic-bezier(0.53,0,0.43,0.99);
                animation-delay: 0.5s;
            }
            @keyframes microiScanBeam {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(0); }
            }
            .microi-scan-box::before, .microi-scan-box::after,
            .microi-scan-angle::before, .microi-scan-angle::after {
                content: ''; display: block; position: absolute;
                width: 20px; height: 20px; z-index: 3;
                border: 2px solid transparent;
            }
            .microi-scan-box::before, .microi-scan-box::after {
                top: 0; border-top-color: #00ff33;
            }
            .microi-scan-angle::before, .microi-scan-angle::after {
                bottom: 0; border-bottom-color: #00ff33;
            }
            .microi-scan-box::before, .microi-scan-angle::before {
                left: 0; border-left-color: #00ff33;
            }
            .microi-scan-box::after, .microi-scan-angle::after {
                right: 0; border-right-color: #00ff33;
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
                gap: 10px;
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
            .microi-scan-capture-btn {
                padding: 6px 16px;
                border: 1px solid var(--el-color-primary, #409eff);
                background: var(--el-color-primary, #409eff);
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                color: #fff;
                transition: all 0.2s;
            }
            .microi-scan-capture-btn:hover {
                opacity: 0.85;
            }
            /* 移动端自适应：全屏模式 */
            @media (max-width: 600px) {
                .microi-scan-dialog { 
                    width: 100%; 
                    max-width: 100vw;
                    max-height: 100vh;
                    border-radius: 0; 
                    // height: 100vh;
                    margin:10px;
                }
                .microi-scan-body { 
                    // min-height: 40vh; 
                    padding: 10px; 
                }
                // .microi-scan-reader { min-height: 35vh; }
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
 * 5+App 原生扫码——嵌入式（APK 环境）
 *
 * 将 plus.barcode.create() 定位到弹窗内 #microiScanReader 元素的精确区域，
 * 只覆盖视频区域，弹窗的头部（关闭按钮）和底部（手动输入）仍为 HTML，完全可交互。
 *
 * - 不需要 HTTPS（原生摄像头，绕过 WebView 安全限制）
 * - 返回 true 表示启动成功，false 表示模块不可用（调用方应 fall through 到 getUserMedia）
 *
 * @param {HTMLElement} statusEl 状态文本元素
 * @returns {Promise<boolean>}
 */
async function startNativeBarcodeScanner(statusEl) {
    if (!window.plus) return false

    // 获取 barcode 模块（远程页面可能需要 plus.require 手动加载）
    var barcodeModule = null
    try { barcodeModule = plus.barcode } catch(e) {}
    if (!barcodeModule) {
        try { barcodeModule = plus.require('barcode') } catch(e) {}
    }
    if (!barcodeModule || typeof barcodeModule.create !== 'function') {
        console.log('[ScanCode] plus.barcode 模块不可用')
        return false
    }

    // 获取弹窗内视频区域的位置，将原生控件定位到此处
    var readerEl = document.getElementById('microiScanReader')
    if (!readerEl) return false
    var rect = readerEl.getBoundingClientRect()

    if (statusEl) statusEl.textContent = '正在启动摄像头...'

    try {
        // 支持的码制（数字常量作后备）
        var filters = [0, 1, 2, 5, 6, 7, 8, 9, 10, 11]
        try {
            filters = [
                barcodeModule.QR, barcodeModule.EAN13, barcodeModule.EAN8,
                barcodeModule.UPCA, barcodeModule.UPCE, barcodeModule.CODABAR,
                barcodeModule.CODE39, barcodeModule.CODE93, barcodeModule.CODE128,
                barcodeModule.ITF
            ].filter(function(f) { return f !== undefined && f !== null })
        } catch(e) {}
        if (filters.length === 0) filters = [0, 1, 2, 10]

        var barcode = barcodeModule.create('microiScanNative', filters, {
            top: Math.round(rect.top) + 'px',
            left: Math.round(rect.left) + 'px',
            width: Math.round(rect.width) + 'px',
            height: Math.round(rect.height) + 'px',
            position: 'static',
            frameColor: '#00CC00',
            scanbarColor: '#00CC00'
        })

        _nativeBarcodeInstance = barcode

        barcode.onmarked = function(type, result) {
            try { plus.device.vibrate(100) } catch(e) {}
            completeScan(result || null)
        }

        barcode.onerror = function(error) {
            console.error('[ScanCode] plus.barcode error:', error)
            if (statusEl) statusEl.textContent = '摄像头启动失败，请手动输入条码或拍照识别'
        }

        plus.webview.currentWebview().append(barcode)
        barcode.start()

        if (statusEl) statusEl.textContent = '对准二维码/条形码...'
        return true
    } catch(e) {
        console.error('[ScanCode] plus.barcode 创建失败:', e)
        _nativeBarcodeInstance = null
        return false
    }
}

/**
 * 停止摄像头和扫码循环（同时清理原生 barcode 控件）
 */
function stopScanner() {
    _isScanning = false
    // 停止原生 barcode 控件（HTTP 模式下使用）
    if (_nativeBarcodeInstance) {
        try { _nativeBarcodeInstance.cancel() } catch(e) {}
        try { _nativeBarcodeInstance.close() } catch(e) {}
        _nativeBarcodeInstance = null
    }
    // 停止逐帧扫描
    if (_scanAnimFrameId) {
        cancelAnimationFrame(_scanAnimFrameId)
        _scanAnimFrameId = null
    }
    // 停止摄像头流
    if (_mediaStream) {
        _mediaStream.getTracks().forEach(function (track) {
            track.stop()
        })
        _mediaStream = null
    }
    // 清理 video 元素
    if (_videoElement) {
        _videoElement.srcObject = null
        _videoElement = null
    }
    _canvasElement = null
    _canvas2d = null
}

/**
 * 初始化 BarcodeDetector（用于条形码识别，现代浏览器支持）
 * QR码由 jsQR 处理，条形码由 BarcodeDetector 处理
 */
function initBarcodeDetector() {
    if (_barcodeDetector) return
    try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            _barcodeDetector = new BarcodeDetector({
                formats: [
                    'code_128', 'code_39', 'code_93',
                    'ean_13', 'ean_8',
                    'upc_a', 'upc_e',
                    'itf', 'codabar',
                    'data_matrix', 'aztec', 'pdf417'
                ]
            })
            console.log('[ScanCode] BarcodeDetector 已初始化（支持条形码识别）')
        }
    } catch (e) {
        console.log('[ScanCode] BarcodeDetector 不可用，仅支持 QR 码:', e.message)
        _barcodeDetector = null
    }
}

/**
 * 逐帧扫码循环（核心逻辑，与旧版 mumu-getQrcode 一致）
 * 每帧从 video 绘制到 canvas，然后用 jsQR 检测二维码 + BarcodeDetector 检测条形码
 */
function scanTick() {
    if (!_isScanning || !_videoElement || !_canvas2d) return

    if (_videoElement.readyState === _videoElement.HAVE_ENOUGH_DATA) {
        // 同步 canvas 尺寸与 video 实际尺寸
        var vw = _videoElement.videoWidth
        var vh = _videoElement.videoHeight
        if (vw > 0 && vh > 0) {
            _canvasElement.width = vw
            _canvasElement.height = vh
            _canvas2d.drawImage(_videoElement, 0, 0, vw, vh)
            var imageData = _canvas2d.getImageData(0, 0, vw, vh)

            // === 1. jsQR 检测二维码 ===
            var qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            })
            if (qrResult && qrResult.data) {
                console.log('[ScanCode] jsQR 识别成功:', qrResult.data)
                completeScan(qrResult.data)
                return
            }

            // === 2. BarcodeDetector 检测条形码（异步，不阻塞帧循环）===
            if (_barcodeDetector && _canvasElement) {
                _barcodeDetector.detect(_canvasElement).then(function (barcodes) {
                    if (!_isScanning) return
                    if (barcodes && barcodes.length > 0) {
                        var code = barcodes[0].rawValue
                        if (code) {
                            console.log('[ScanCode] BarcodeDetector 识别成功:', code, '格式:', barcodes[0].format)
                            completeScan(code)
                        }
                    }
                }).catch(function () { /* ignore */ })
            }
        }
    }
    _scanAnimFrameId = requestAnimationFrame(scanTick)
}

/**
 * 使用 getUserMedia 直接启动摄像头（兼容性最佳方案）
 *
 * 与旧版 mumu-getQrcode 组件使用相同的方式：
 * - 直接调用 navigator.mediaDevices.getUserMedia
 * - 不依赖 enumerateDevices / getCameras
 * - facingMode 使用 { ideal: "environment" } 而非 { exact: "environment" }
 *   以避免在无后置摄像头时直接失败
 *
 * @param {HTMLElement} statusEl 状态文本元素
 * @param {string} facingMode 摄像头方向 'environment'|'user'
 */
async function startUserMedia(statusEl, facingMode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusEl) statusEl.textContent = '当前浏览器不支持摄像头，请使用图片识别或手动输入条码'
        return false
    }

    // 获取 DOM 元素
    _videoElement = document.getElementById('microiScanVideo')
    _canvasElement = document.getElementById('microiScanCanvas')
    if (!_videoElement || !_canvasElement) {
        if (statusEl) statusEl.textContent = '扫码界面初始化异常，请刷新重试'
        return false
    }
    _canvas2d = _canvasElement.getContext('2d', { willReadFrequently: true })

    if (statusEl) statusEl.textContent = '正在请求摄像头权限...'

    try {
        // 使用 ideal 而非 exact，提高兼容性（微信、手机浏览器）
        _mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: facingMode || 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        })

        _videoElement.srcObject = _mediaStream
        _videoElement.setAttribute('playsinline', 'true')
        _videoElement.setAttribute('webkit-playsinline', 'true')
        await _videoElement.play()

        // 修复 Android WebView 首次获取的视频流不渲染画面的问题
        // 等待 video 实际输出帧（videoWidth > 0），超时后自动重启流
        var renderOk = await new Promise(function(waitResolve) {
            var count = 0
            function check() {
                if (_videoElement && _videoElement.videoWidth > 0 && _videoElement.videoHeight > 0) {
                    waitResolve(true)
                    return
                }
                count++
                if (count > 15) { waitResolve(false); return } // 1.5 秒超时
                setTimeout(check, 100)
            }
            setTimeout(check, 100)
        })
        if (!renderOk && _videoElement) {
            console.log('[ScanCode] 视频未渲染，重启流...')
            if (_mediaStream) {
                _mediaStream.getTracks().forEach(function(t) { t.stop() })
            }
            _mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: facingMode || 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })
            _videoElement.srcObject = _mediaStream
            await _videoElement.play()
        }

        if (statusEl) statusEl.textContent = '对准二维码/条形码...'

        // 初始化 BarcodeDetector（条形码）
        initBarcodeDetector()

        // 开始逐帧扫描
        _isScanning = true
        _scanAnimFrameId = requestAnimationFrame(scanTick)
        return true
    } catch (err) {
        console.error('[ScanCode] getUserMedia 失败 (facingMode=' + facingMode + '):', err.name, err.message)
        // 移动端尝试最简约束（不指定摄像头方向和分辨率，提高兼容性）
        if (isMobile() && facingMode === 'environment') {
            try {
                console.log('[ScanCode] 尝试最简约束 { video: true }...')
                if (statusEl) statusEl.textContent = '尝试其他摄像头配置...'
                _mediaStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                _videoElement.srcObject = _mediaStream
                _videoElement.setAttribute('playsinline', 'true')
                _videoElement.setAttribute('webkit-playsinline', 'true')
                await _videoElement.play()
                if (statusEl) statusEl.textContent = '对准二维码/条形码...'
                initBarcodeDetector()
                _isScanning = true
                _scanAnimFrameId = requestAnimationFrame(scanTick)
                return true
            } catch (err2) {
                console.error('[ScanCode] 最简约束也失败:', err2.name, err2.message)
            }
        }
        return false
    }
}

/**
 * 启动摄像头扫码（兼容移动端）
 *
 * 策略优先级：
 * 1. 5+App 环境 → plus.barcode 原生扫码
 * 2. 微信内置浏览器 + JSSDK 已配置 → wx.scanQRCode
 * 3. 所有浏览器（含微信） → getUserMedia 直接调用 + jsQR 逐帧解码
 *    - 先尝试后置摄像头 facingMode: ideal "environment"
 *    - 失败则尝试前置摄像头 facingMode: ideal "user"
 *    - 全部失败则提示使用图片识别或手动输入
 *
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function startCameraScanner(statusEl) {
    // === 策略1: 5+App 原生扫码（嵌入对话框 #microiScanReader 区域，不需要 HTTPS） ===
    if (isPlusApp()) {
        var nativeOk = await startNativeBarcodeScanner(statusEl)
        if (nativeOk) return
        // 原生模块不可用 → fall through 到 getUserMedia（HTTPS 下可用）
        console.log('[ScanCode] 原生扫码不可用，尝试 getUserMedia')
    }

    // === 策略2: 微信 JSSDK 扫码（仅当 JSSDK 已正确配置时） ===
    if (isWeChatBrowser() && typeof wx !== 'undefined' && wx.scanQRCode) {
        if (statusEl) statusEl.textContent = '正在调用微信扫一扫...'
        try {
            var wxResult = await wechatScanCode()
            if (wxResult) { completeScan(wxResult); return }
            // 微信扫码取消时，不 return，继续尝试 getUserMedia
            if (statusEl) statusEl.textContent = '微信扫码已取消，正在尝试摄像头...'
        } catch (e) {
            // JSSDK 调用失败，继续尝试 getUserMedia
            console.log('[ScanCode] 微信 JSSDK 扫码失败，尝试 getUserMedia:', e)
        }
    }

    // === 策略3: getUserMedia 直接调用摄像头 + jsQR 逐帧解码 ===

    // 3a: 先尝试后置摄像头（含移动端最简约束降级）
    var success = await startUserMedia(statusEl, 'environment')
    if (success) return

    // 3b: 后置失败，尝试前置摄像头
    console.log('[ScanCode] 后置摄像头失败，尝试前置...')
    stopScanner() // 确保上一次尝试的资源已释放
    success = await startUserMedia(statusEl, 'user')
    if (success) return

    // 3c: 全部失败
    console.error('[ScanCode] 所有摄像头启动方式均失败')
    _cameraFailed = true

    // === 策略4: 移动端降级为拍照识别 ===
    // 使用 <input type="file" capture="environment"> 调起原生相机拍照后识别
    // 该方式不需要 getUserMedia 权限，在所有移动端浏览器（含微信）中均可用
    if (isMobile()) {
        if (statusEl) {
            statusEl.textContent = '摄像头不可用，请点击下方【📸 拍照识别】按钮拍照'
        }
        // 尝试自动弹出拍照（部分浏览器可能拦截非用户手势触发的 click）
        setTimeout(function () {
            try {
                var captureInput = document.getElementById('microiScanCaptureInput')
                if (captureInput) captureInput.click()
            } catch (e) { /* 自动触发失败无碍，用户可手动点击按钮 */ }
        }, 500)
        return
    }

    // PC 端：提示检查权限
    if (statusEl) {
        statusEl.textContent = '无法访问摄像头，请检查权限设置后重试，或使用图片识别/手动输入条码'
    }
}

/**
 * 从图片文件识别二维码/条形码
 * @param {File} file 图片文件
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function scanFromFile(file, statusEl) {
    if (statusEl) statusEl.textContent = '正在识别图片中的码...'

    try {
        // 将文件读取为 Image
        var imgUrl = URL.createObjectURL(file)
        var img = new Image()
        img.src = imgUrl

        await new Promise(function (resolve, reject) {
            img.onload = resolve
            img.onerror = reject
        })

        // 绘制到 canvas 上
        var tempCanvas = document.createElement('canvas')
        tempCanvas.width = img.naturalWidth
        tempCanvas.height = img.naturalHeight
        var tempCtx = tempCanvas.getContext('2d')
        tempCtx.drawImage(img, 0, 0)
        URL.revokeObjectURL(imgUrl)

        var imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

        // 1. jsQR 检测二维码
        var qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        })
        if (qrResult && qrResult.data) {
            completeScan(qrResult.data)
            return
        }

        // 2. BarcodeDetector 检测条形码
        initBarcodeDetector()
        if (_barcodeDetector) {
            var barcodes = await _barcodeDetector.detect(tempCanvas)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                completeScan(barcodes[0].rawValue)
                return
            }
        }

        // 3. 兜底：使用 html5-qrcode 的 scanFile（支持更多条形码格式）
        try {
            var { Html5Qrcode } = await import('html5-qrcode')
            // 需要一个 DOM 元素 ID
            var tempDiv = document.createElement('div')
            tempDiv.id = 'microi-scan-temp-' + Date.now()
            tempDiv.style.display = 'none'
            document.body.appendChild(tempDiv)
            var h5qr = new Html5Qrcode(tempDiv.id, { verbose: false })
            var h5Result = await h5qr.scanFile(file, true)
            tempDiv.remove()
            if (h5Result) {
                completeScan(h5Result)
                return
            }
        } catch (h5Err) {
            console.log('[ScanCode] html5-qrcode scanFile 也未识别:', h5Err.message)
        }

        // 全部失败
        if (statusEl) statusEl.textContent = '图片中未识别到有效的二维码/条形码，请重试'
        // 仅在摄像头可用时才重新启动；否则提示用户重新拍照
        if (!_cameraFailed) {
            setTimeout(function () { startCameraScanner(statusEl) }, 1500)
        } else if (statusEl) {
            setTimeout(function () { statusEl.textContent = '请点击【📸 拍照识别】重新拍照，或手动输入条码' }, 1500)
        }
    } catch (err) {
        console.error('[ScanCode] 图片识别失败:', err)
        if (statusEl) statusEl.textContent = '图片识别出错: ' + (err.message || err)
        if (!_cameraFailed) {
            setTimeout(function () { startCameraScanner(statusEl) }, 1500)
        } else if (statusEl) {
            setTimeout(function () { statusEl.textContent = '请点击【📸 拍照识别】重新拍照，或手动输入条码' }, 1500)
        }
    }
}

/**
 * 切换摄像头（前置/后置）
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function switchCamera(statusEl) {
    stopScanner()
    // 切换方向
    _currentFacingMode = (_currentFacingMode === 'environment') ? 'user' : 'environment'
    if (statusEl) statusEl.textContent = '切换摄像头中...'
    var success = await startUserMedia(statusEl, _currentFacingMode)
    if (!success) {
        // 切换失败，尝试切回原来的
        _currentFacingMode = (_currentFacingMode === 'environment') ? 'user' : 'environment'
        await startUserMedia(statusEl, _currentFacingMode)
        if (statusEl) statusEl.textContent = '只有一个摄像头，无法切换'
        setTimeout(function () { if (statusEl) statusEl.textContent = '对准二维码/条形码...' }, 1500)
    }
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

            // 重置摄像头方向
            _currentFacingMode = 'environment'

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
                    // 先停止摄像头再识别图片
                    stopScanner()
                    scanFromFile(file, statusEl)
                }
                fileInput.value = '' // reset
            }

            // 拍照识别（使用 capture="environment" 调起原生相机）
            const captureBtn = document.getElementById('microiScanCaptureBtn')
            const captureInput = document.getElementById('microiScanCaptureInput')
            if (captureBtn && captureInput) {
                captureBtn.onclick = () => captureInput.click()
                captureInput.onchange = (e) => {
                    const file = e.target.files && e.target.files[0]
                    if (file) {
                        stopScanner()
                        scanFromFile(file, statusEl)
                    }
                    captureInput.value = '' // reset
                }
            }

            // 重置摄像头失败标记
            _cameraFailed = false

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
