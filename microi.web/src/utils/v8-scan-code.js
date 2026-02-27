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
                    <video id="microiScanVideo" playsinline muted></video>
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
                padding-top: calc(16px + constant(safe-area-inset-top));
                padding-top: calc(16px + env(safe-area-inset-top));
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
                position: relative;
            }
            #microiScanVideo {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: none;
                border-radius: 8px;
            }
            /* 摄像头未启动时显示加载提示 */
            .microi-scan-reader::before {
                content: '\\1F4F7  正在连接摄像头...';
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                color: rgba(255,255,255,0.5);
                font-size: 14px;
                z-index: 1;
                pointer-events: none;
            }
            .microi-scan-reader.camera-active::before {
                display: none;
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
                    height: 100vh;
                }
                .microi-scan-body { min-height: 40vh; padding: 10px; }
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
 * 停止摄像头和扫码循环
 */
function stopScanner() {
    _isScanning = false
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
        _videoElement.style.display = 'none'
        _videoElement.srcObject = null
        _videoElement = null
    }
    // 移除摄像头激活标记
    var readerEl = document.getElementById('microiScanReader')
    if (readerEl) readerEl.classList.remove('camera-active')
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
 * 检测当前页面是否在 iframe 中且缺少摄像头权限
 * @returns {boolean}
 */
function isBlockedByIframe() {
    try {
        if (window.self !== window.top) {
            // 在 iframe 中，检查是否有摄像头权限
            // Permissions Policy 可能阻止 getUserMedia
            return true // 在 iframe 中
        }
    } catch (e) {
        // 跨域 iframe
        return true
    }
    return false
}

/**
 * 将 getUserMedia 的流绑定到 video 元素并启动扫描
 * 与旧版 mumu-getQrcode 组件一致的方式
 * @param {MediaStream} stream
 * @param {HTMLElement} statusEl
 * @returns {boolean}
 */
function bindStreamAndStartScan(stream, statusEl) {
    _mediaStream = stream
    _videoElement.srcObject = stream
    _videoElement.setAttribute('playsinline', 'true')
    _videoElement.setAttribute('webkit-playsinline', 'true')

    // 与旧版一致：不 await play()，使用 .play().catch() 避免在某些浏览器中阻塞
    _videoElement.play().catch(function (playErr) {
        console.warn('[ScanCode] video.play() 警告:', playErr.message)
    })

    _videoElement.style.display = 'block'
    var readerEl = document.getElementById('microiScanReader')
    if (readerEl) readerEl.classList.add('camera-active')

    if (statusEl) statusEl.textContent = '对准二维码/条形码...'

    initBarcodeDetector()
    _isScanning = true
    _scanAnimFrameId = requestAnimationFrame(scanTick)
    return true
}

/**
 * 启动摄像头扫码（完全重写）
 *
 * 对比旧版 mumu-getQrcode 组件的 openScan() 方法，
 * 采用相同的 getUserMedia 约束格式和调用方式。
 *
 * 策略优先级：
 * 1. 5+App 环境 → plus.barcode （在线模式会失败，自动降级）
 * 2. 微信 JSSDK → wx.scanQRCode
 * 3. getUserMedia 多约束依次尝试：
 *    a) { facingMode: { exact: 'environment' } }  （与旧版 mumu-getQrcode 一致）
 *    b) { facingMode: 'environment' }               （简化约束）
 *    c) { facingMode: 'user' }                      （前置摄像头）
 *    d) { video: true }                             （任意摄像头）
 * 4. 全部失败 → 拍照识别降级
 *
 * @param {HTMLElement} statusEl 状态文本元素
 */
async function startCameraScanner(statusEl) {
    // === 前置检查：iframe 限制 ===
    var inIframe = isBlockedByIframe()
    if (inIframe) {
        console.warn('[ScanCode] 页面在 iframe 中加载，摄像头可能被 Permissions Policy 阻止')
    }

    // === 策略1: 5+App 原生扫码 ===
    // plus.barcode.scan 依赖本地 barcode.html，在线模式 APK 无此文件，会失败后降级
    if (isPlusApp() && window.plus && plus.barcode) {
        if (statusEl) statusEl.textContent = '正在启动扫码...'
        try {
            var plusResult = await plusBarcodeScan()
            if (plusResult) { completeScan(plusResult); return }
        } catch (e) {
            console.log('[ScanCode] plus.barcode 扫码失败，降级到 getUserMedia:', e)
        }
        if (statusEl) statusEl.textContent = '正在尝试摄像头...'
    }

    // === 策略2: 微信 JSSDK 扫码 ===
    if (isWeChatBrowser() && typeof wx !== 'undefined' && wx.scanQRCode) {
        if (statusEl) statusEl.textContent = '正在调用微信扫一扫...'
        try {
            var wxResult = await wechatScanCode()
            if (wxResult) { completeScan(wxResult); return }
            if (statusEl) statusEl.textContent = '微信扫码已取消，正在尝试摄像头...'
        } catch (e) {
            console.log('[ScanCode] 微信 JSSDK 扫码失败，尝试 getUserMedia:', e)
        }
    }

    // === 策略3: getUserMedia 直接调用摄像头 ===
    // 校验 API 是否可用
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[ScanCode] navigator.mediaDevices.getUserMedia 不存在')
        if (statusEl) {
            statusEl.textContent = '当前浏览器不支持摄像头（需要 HTTPS 环境），请使用图片识别或手动输入'
        }
        _cameraFailed = true
        return
    }

    // 检查安全上下文
    if (window.isSecureContext === false) {
        console.error('[ScanCode] 非安全上下文 (非 HTTPS)，getUserMedia 不可用')
        if (statusEl) statusEl.textContent = '需要 HTTPS 环境才能使用摄像头，请使用图片识别或手动输入'
        _cameraFailed = true
        return
    }

    // 获取 DOM 元素
    _videoElement = document.getElementById('microiScanVideo')
    _canvasElement = document.getElementById('microiScanCanvas')
    if (!_videoElement || !_canvasElement) {
        if (statusEl) statusEl.textContent = '扫码界面初始化异常，请刷新重试'
        return
    }
    _canvas2d = _canvasElement.getContext('2d', { willReadFrequently: true })

    // 与旧版 mumu-getQrcode 一致的约束策略列表（依次尝试）
    // 旧版原始约束: { audio: false, video: { facingMode: { exact: 'environment' }, width: N, height: N } }
    var constraintsList = [
        // a) 与旧版 mumu-getQrcode 完全一致：exact environment，不指定分辨率
        { label: '后置摄像头(exact)', constraints: { audio: false, video: { facingMode: { exact: 'environment' } } } },
        // b) 简化：environment 不用 exact（某些 WebView 不支持 exact）
        { label: '后置摄像头(ideal)', constraints: { audio: false, video: { facingMode: 'environment' } } },
        // c) 前置摄像头
        { label: '前置摄像头', constraints: { audio: false, video: { facingMode: 'user' } } },
        // d) 最简约束：任意摄像头
        { label: '任意摄像头', constraints: { audio: false, video: true } },
    ]

    var lastError = null
    for (var i = 0; i < constraintsList.length; i++) {
        var item = constraintsList[i]
        if (statusEl) statusEl.textContent = '正在请求摄像头权限（' + item.label + '）...'
        console.log('[ScanCode] 尝试策略 ' + (i + 1) + '/' + constraintsList.length + ': ' + item.label)

        try {
            // 确保上一次尝试的资源已释放
            if (_mediaStream) {
                _mediaStream.getTracks().forEach(function (t) { t.stop() })
                _mediaStream = null
            }

            var stream = await navigator.mediaDevices.getUserMedia(item.constraints)
            console.log('[ScanCode] ✓ 成功: ' + item.label)
            bindStreamAndStartScan(stream, statusEl)
            return // 成功，退出
        } catch (err) {
            lastError = err
            console.warn('[ScanCode] ✗ 策略「' + item.label + '」失败:', err.name, '-', err.message)

            // OverconstrainedError = 约束不满足，可继续尝试其他约束
            // NotAllowedError = 权限被拒绝
            // NotFoundError = 无摄像头设备
            // NotReadableError = 摄像头被占用
            // AbortError / SecurityError = 安全策略阻止

            // 如果是权限被拒绝且在 iframe 中，可能是 Permissions Policy 阻止
            if (err.name === 'NotAllowedError' && inIframe) {
                console.error('[ScanCode] 在 iframe 中摄像头权限被拒绝，可能是缺少 allow="camera" 属性')
                if (statusEl) {
                    statusEl.textContent = '摄像头被浏览器安全策略阻止（iframe缺少camera权限），请联系管理员配置 allow="camera"'
                }
                _cameraFailed = true
                return
            }

            // 如果是硬性权限拒绝（用户主动拒绝），不需要继续尝试其他约束
            if (err.name === 'NotAllowedError') {
                break // 跳出循环，进入降级流程
            }
        }
    }

    // === 所有 getUserMedia 策略均失败 ===
    console.error('[ScanCode] 所有摄像头策略均失败，最后错误:', lastError?.name, lastError?.message)
    _cameraFailed = true

    // 构造清晰的错误提示
    var errorDetail = lastError ? ('(' + lastError.name + ': ' + lastError.message + ')') : ''

    // === 策略4: 移动端降级为拍照识别 ===
    if (isMobile()) {
        if (statusEl) {
            statusEl.textContent = '摄像头不可用 ' + errorDetail + '\n请点击下方【📸 拍照识别】按钮拍照'
        }
        setTimeout(function () {
            try {
                var captureInput = document.getElementById('microiScanCaptureInput')
                if (captureInput) captureInput.click()
            } catch (e) { /* 自动触发失败无碍 */ }
        }, 500)
        return
    }

    // PC 端：显示详细错误
    if (statusEl) {
        statusEl.textContent = '无法访问摄像头 ' + errorDetail + '，请检查权限设置后重试，或使用图片识别/手动输入条码'
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
    _currentFacingMode = (_currentFacingMode === 'environment') ? 'user' : 'environment'
    if (statusEl) statusEl.textContent = '切换摄像头中...'

    // 获取 DOM 元素
    _videoElement = document.getElementById('microiScanVideo')
    _canvasElement = document.getElementById('microiScanCanvas')
    if (!_videoElement || !_canvasElement) return
    _canvas2d = _canvasElement.getContext('2d', { willReadFrequently: true })

    try {
        var stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { exact: _currentFacingMode } }
        })
        bindStreamAndStartScan(stream, statusEl)
    } catch (e) {
        // exact 失败，尝试 ideal
        try {
            var stream2 = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: _currentFacingMode }
            })
            bindStreamAndStartScan(stream2, statusEl)
        } catch (e2) {
            // 切换失败，尝试切回原来的
            _currentFacingMode = (_currentFacingMode === 'environment') ? 'user' : 'environment'
            try {
                var stream3 = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: { exact: _currentFacingMode } }
                })
                bindStreamAndStartScan(stream3, statusEl)
            } catch (e3) {
                try {
                    var stream4 = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                    bindStreamAndStartScan(stream4, statusEl)
                } catch (e4) { /* ignore */ }
            }
            if (statusEl) statusEl.textContent = '只有一个摄像头，无法切换'
            setTimeout(function () { if (statusEl) statusEl.textContent = '对准二维码/条形码...' }, 1500)
        }
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
