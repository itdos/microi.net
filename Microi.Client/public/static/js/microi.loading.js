/*
    * Microi Loading Animation Script
    注意：修改此文件一定要去【Microi.Client\index.html】修改
    【/static/js/microi.loading.js?d=2026081703】时间戳，防止浏览器缓存不更新
*/
var isApkEnv = !!(window.plus || navigator.userAgent.indexOf('Html5Plus') > -1);
var loadingRate = window.__microi_apk_start || 0;
var firstLoginCover = true;
var isNeedLogin = false;
var rateEl = document.getElementById('loadPercent');
var barEl = document.getElementById('progressBar');
var completionStarted = false;
var loadingFinished = false;
var appBootError = '';
var appReadyTimer = null;
var finishTimer = null;
var startupFailed = false;
var appMounted = window.__MICROI_APP_MOUNTED__ === true;
var bootWaitStartedAt = 0;
var lastWaitingSecond = -1;

function updateLoadUI(rate) {
    if (startupFailed) return;
    var r = Math.min(rate, 100);
    if (rateEl) rateEl.textContent = r + '%';
    if (barEl) barEl.style.width = r + '%';
}

function isMicroiAppReady() {
    return window.__MICROI_APP_READY__ === true;
}

function setStartupCopy(title, status, value) {
    var subtitleEl = document.querySelector('.mci-app-subtitle');
    var statusEl = document.getElementById('startupStatus');
    if (subtitleEl && title) subtitleEl.textContent = title;
    if (statusEl && status) statusEl.textContent = status;
    if (rateEl && value) {
        rateEl.textContent = value;
        rateEl.classList.add('is-status');
    }
}

function updateWaitingCopy(waited) {
    var seconds = Math.max(0, Math.floor(waited / 1000));
    if (seconds === lastWaitingSecond) return;
    lastWaitingSecond = seconds;
    if (!appMounted) {
        setStartupCopy('正在启动应用', '正在等待页面脚本加载…', '启动中');
        return;
    }
    if (seconds < 8) {
        setStartupCopy('正在连接后端服务', '正在读取租户配置与基础数据，请稍候…', '连接中');
    } else if (seconds < 30) {
        setStartupCopy('后端服务响应较慢', '已等待 ' + seconds + ' 秒，连接仍在继续，请不要关闭页面。', '等待响应');
    } else {
        setStartupCopy('仍在等待后端服务', '已等待 ' + seconds + ' 秒。服务可能繁忙或暂不可用，您可以继续等待或刷新重试。', '等待服务');
    }
}

function unlockPageScroll() {
    // 层1：标准 classList（大多数浏览器）
    try { document.documentElement.classList.remove('is-loading'); } catch(e) {}
    // 层2：className 字符串替换（兼容部分旧版移动端 WebView classList 静默失效）
    try {
        if (document.documentElement.className.indexOf('is-loading') !== -1) {
            document.documentElement.className =
                document.documentElement.className.replace(/\bis-loading\b/g, '').trim();
        }
    } catch(e) {}
    // 层3：requestAnimationFrame 下一帧再移除一次
    try {
        requestAnimationFrame(function () {
            document.documentElement.classList.remove('is-loading');
            if (document.documentElement.className.indexOf('is-loading') !== -1) {
                document.documentElement.style.setProperty('overflow', 'auto', 'important');
                document.documentElement.style.setProperty('height', 'auto', 'important');
                document.body.style.setProperty('overflow', 'auto', 'important');
                document.body.style.setProperty('height', 'auto', 'important');
            }
        });
    } catch(e) {}
}

function finishLoading() {
    if (loadingFinished || finishTimer) return;
    // 即使业务初始化很快，也必须先把 100% 真实绘制出来，再退出启动层。
    // 直接在 app-ready 事件里移除遮罩会让用户看到“进度未满 -> 白屏”的闪烁。
    loadingRate = 100;
    startupFailed = false;
    updateLoadUI(100);
    if (rateEl) {
        rateEl.classList.remove('is-status');
        rateEl.textContent = '100%';
    }
    var subtitleEl = document.querySelector('.mci-app-subtitle');
    var statusEl = document.getElementById('startupStatus');
    if (subtitleEl) subtitleEl.textContent = '启动完成';
    if (statusEl) statusEl.textContent = '应用已就绪，正在进入…';
    if (appReadyTimer) {
        clearInterval(appReadyTimer);
        appReadyTimer = null;
    }
    // 至少保留一个可感知的完整进度帧；同时给路由首屏完成布局和绘制的时间。
    finishTimer = setTimeout(function () {
        finishTimer = null;
        loadingFinished = true;
        unlockPageScroll();
        var loadEl = document.getElementById('microi_loading');
        if (loadEl != null) {
            loadEl.classList.add('fade-out');
            setTimeout(function () {
                if (loadEl.parentNode) {
                    loadEl.parentNode.removeChild(loadEl);
                }
                if (isNeedLogin) {
                    var loginEl = document.getElementById('divLogin');
                    if (loginEl) loginEl.style.top = '0%';
                }
                firstLoginCover = false;
            }, 500);
        }
    }, 360);
}

function getBrowserCoreDescription() {
    var ua = navigator.userAgent || '';
    var match = ua.match(/(?:Chrome|Chromium)\/(\d+)/i);
    if (match && match[1]) {
        return '检测到 Chromium 内核 ' + match[1] + '。';
    }
    return '';
}

function showStartupFailure(kind) {
    if (loadingFinished || isMicroiAppReady()) {
        finishLoading();
        return;
    }
    if (appReadyTimer) {
        clearInterval(appReadyTimer);
        appReadyTimer = null;
    }
    startupFailed = true;
    completionStarted = true;
    loadingRate = 100;
    var loadEl = document.getElementById('microi_loading');
    var subtitleEl = document.querySelector('.mci-app-subtitle');
    var statusEl = document.getElementById('startupStatus');
    var messageEl = document.getElementById('startupErrorMessage');
    var retryEl = document.getElementById('startupRetry');
    if (loadEl) loadEl.classList.add('startup-failed');
    var isServiceFailure = kind === 'service';
    if (subtitleEl) subtitleEl.textContent = isServiceFailure ? '后端服务暂时不可用' : '页面脚本未能启动';
    if (statusEl) statusEl.textContent = isServiceFailure
        ? '系统初始化尚未完成，请检查服务后重新加载。'
        : '页面脚本未能完成挂载，请刷新或更换浏览器后重试。';
    if (rateEl) {
        rateEl.textContent = '连接失败';
        rateEl.classList.add('is-status');
    }
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#E8294A';
    }
    if (messageEl) {
        var detail = appBootError ? '错误信息：' + appBootError + ' ' : '';
        messageEl.textContent = isServiceFailure
            ? detail + '请检查后端服务与网络连接后重试。页面不会再停留在无提示的空白状态。'
            : detail + getBrowserCoreDescription()
                + '请先按 Ctrl+F5 强制刷新；如仍无法打开，请升级到此电脑可安装的较新 Chrome，'
                + '或将 360 安全浏览器切换到较新的极速内核。';
    }
    if (retryEl) {
        retryEl.onclick = function () {
            window.location.reload(true);
        };
    }
}

function waitForAppReady() {
    if (completionStarted) return;
    completionStarted = true;
    updateLoadUI(100);
    bootWaitStartedAt = Date.now();
    if (isMicroiAppReady()) {
        finishLoading();
        return;
    }
    appMounted = window.__MICROI_APP_MOUNTED__ === true;
    updateWaitingCopy(0);
    var waited = 0;
    appReadyTimer = setInterval(function () {
        if (isMicroiAppReady()) {
            finishLoading();
            return;
        }
        appMounted = appMounted || window.__MICROI_APP_MOUNTED__ === true;
        waited = Date.now() - bootWaitStartedAt;
        updateWaitingCopy(waited);
        // 只有页面脚本始终没有挂载才判定为启动故障；后端慢响应则持续展示可理解的等待状态。
        if (!appMounted && waited >= 15000) {
            showStartupFailure('script');
        }
    }, 250);
}

function LoadRate(step, t) {
    if (loadingRate < 100) {
        var tTimer = setInterval(function () {
            loadingRate = loadingRate + 1;
            updateLoadUI(loadingRate > 100 ? 100 : loadingRate);
            step--;
            if (step <= 0 || loadingRate >= 100) {
                clearInterval(tTimer);
                if (loadingRate >= 100) {
                    setTimeout(waitForAppReady, 10);
                }
            }
        }, t != undefined ? t : 10);
    }
}

window.addEventListener('microi:app-mounted', function () {
    appMounted = true;
    if (completionStarted) updateWaitingCopy(Date.now() - bootWaitStartedAt);
});
window.addEventListener('microi:app-ready', function () {
    window.__MICROI_APP_READY__ = true;
    // finishLoading 会先固定显示 100% 与“启动完成”，不会提前撤掉遮罩。
    finishLoading();
});
window.addEventListener('microi:app-boot-failed', function (event) {
    var detail = event && event.detail;
    appBootError = (detail && detail.message) || window.__MICROI_APP_BOOT_ERROR__ || appBootError;
    showStartupFailure('service');
});
window.addEventListener('error', function (event) {
    if (isMicroiAppReady()) return;
    appBootError = (event && (event.message || (event.error && event.error.message))) || appBootError;
});
window.addEventListener('unhandledrejection', function (event) {
    if (isMicroiAppReady()) return;
    var reason = event && event.reason;
    appBootError = (reason && (reason.message || String(reason))) || appBootError;
});

// 初始显示
updateLoadUI(loadingRate);

// APK: 从20%开始(hbuilder-app已完成0-20%)，浏览器: 从0%开始
if (isApkEnv) {
    LoadRate(20, 100);  // 20->40 快速阶段
    LoadRate(60, 500);  // 40->100 慢速阶段
} else {
    LoadRate(20, 100);  // 0->20 快速阶段
    LoadRate(80, 500);  // 20->100 慢速阶段
}

if (typeof module === 'object') { window.jQuery = window.$ = module.exports; };
function IEVersion() {
    var userAgent = navigator.userAgent;
    var isIE = userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1;
    var isEdge = userAgent.indexOf("Edge") > -1 && !isIE;
    var isIE11 = userAgent.indexOf('Trident') > -1 && userAgent.indexOf("rv:11.0") > -1;
    if (isIE) {
        var reIE = new RegExp("MSIE (\\d+\\.\\d+);");
        reIE.test(userAgent);
        var fIEVersion = parseFloat(RegExp["$1"]);
        if (fIEVersion == 7) return 7;
        else if (fIEVersion == 8) return 8;
        else if (fIEVersion == 9) return 9;
        else if (fIEVersion == 10) return 10;
        else return 6;
    } else if (isEdge) {
        return 'edge';
    } else if (isIE11) {
        return 11;
    } else {
        return -1;
    }
}
if (IEVersion() != -1) {
    alert('请使用非IE浏览器访问本系统，国产浏览器请切换至极速模式！');
}
