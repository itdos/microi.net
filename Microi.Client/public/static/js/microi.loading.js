/*
    * Microi Loading Animation Script
    注意：修改此文件一定要去【Microi.Client\index.html】修改
    【/static/js/microi.loading.js?d=20260716】时间戳，防止浏览器缓存不更新
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

function updateLoadUI(rate) {
    var r = Math.min(rate, 100);
    if (rateEl) rateEl.textContent = r + '%';
    if (barEl) barEl.style.width = r + '%';
}

function isMicroiAppReady() {
    if (window.__MICROI_APP_MOUNTED__ === true) {
        return true;
    }
    var appEl = document.getElementById('app_microi');
    return !!(appEl && appEl.childNodes && appEl.childNodes.length > 0);
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
    if (loadingFinished) return;
    loadingFinished = true;
    if (appReadyTimer) {
        clearInterval(appReadyTimer);
        appReadyTimer = null;
    }
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
}

function getBrowserCoreDescription() {
    var ua = navigator.userAgent || '';
    var match = ua.match(/(?:Chrome|Chromium)\/(\d+)/i);
    if (match && match[1]) {
        return '检测到 Chromium 内核 ' + match[1] + '。';
    }
    return '';
}

function showStartupFailure() {
    if (loadingFinished || isMicroiAppReady()) {
        finishLoading();
        return;
    }
    if (appReadyTimer) {
        clearInterval(appReadyTimer);
        appReadyTimer = null;
    }
    var loadEl = document.getElementById('microi_loading');
    var subtitleEl = document.querySelector('.mci-app-subtitle');
    var messageEl = document.getElementById('startupErrorMessage');
    var retryEl = document.getElementById('startupRetry');
    if (loadEl) loadEl.classList.add('startup-failed');
    if (subtitleEl) subtitleEl.textContent = '页面脚本未能启动';
    if (rateEl) rateEl.textContent = '!';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#E8294A';
    }
    if (messageEl) {
        var detail = appBootError
            ? '启动错误：' + appBootError + ' '
            : '';
        messageEl.textContent = detail + getBrowserCoreDescription()
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
    if (isMicroiAppReady()) {
        finishLoading();
        return;
    }
    var subtitleEl = document.querySelector('.mci-app-subtitle');
    if (subtitleEl) subtitleEl.textContent = '正在启动应用';
    var waited = 0;
    appReadyTimer = setInterval(function () {
        if (isMicroiAppReady()) {
            finishLoading();
            return;
        }
        waited += 250;
        if (waited >= 15000) {
            showStartupFailure();
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
    if (completionStarted) {
        finishLoading();
    }
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
