/*
    * Microi Loading Animation Script
    注意：修改此文件一定要去【Microi.Client\index.html】修改
    【/static/js/microi.loading.js?d=20260424】时间戳，防止浏览器缓存不更新
*/
var isApkEnv = !!(window.plus || navigator.userAgent.indexOf('Html5Plus') > -1);
var loadingRate = window.__microi_apk_start || 0;
var firstLoginCover = true;
var isNeedLogin = false;
var rateEl = document.getElementById('loadPercent');
var barEl = document.getElementById('progressBar');

function updateLoadUI(rate) {
    var r = Math.min(rate, 100);
    if (rateEl) rateEl.textContent = r + '%';
    if (barEl) barEl.style.width = r + '%';
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
                    setTimeout(function () {
                        // 解锁页面滚动（与 index.html 中加载期 .is-loading 锁配合）
                        // 层1：标准 classList（大多数浏览器）
                        try { document.documentElement.classList.remove('is-loading'); } catch(e) {}
                        // 层2：className 字符串替换（兼容部分旧版移动端 WebView classList 静默失效）
                        try {
                            if (document.documentElement.className.indexOf('is-loading') !== -1) {
                                document.documentElement.className =
                                    document.documentElement.className.replace(/\bis-loading\b/g, '').trim();
                            }
                        } catch(e) {}
                        // 层3：requestAnimationFrame 下一帧再移除一次（防止渲染未刷新）
                        try {
                            requestAnimationFrame(function () {
                                document.documentElement.classList.remove('is-loading');
                                // 终极保险：直接强制解锁 overflow，防止类名移除仍未生效
                                if (document.documentElement.className.indexOf('is-loading') !== -1) {
                                    document.documentElement.style.setProperty('overflow', 'auto', 'important');
                                    document.documentElement.style.setProperty('height', 'auto', 'important');
                                    document.body.style.setProperty('overflow', 'auto', 'important');
                                    document.body.style.setProperty('height', 'auto', 'important');
                                }
                            });
                        } catch(e) {}
                        var loadEl = document.getElementById('microi_loading');
                        if (loadEl != null) {
                            loadEl.classList.add('fade-out');
                            
                            setTimeout(function () {
                                loadEl.remove();
                                if (isNeedLogin) {
                                    document.getElementById('divLogin').style.top = '0%';
                                }
                                firstLoginCover = false;
                            }, 500);
                        }
                    }, 10);
                }
            }
        }, t != undefined ? t : 10);
    }
}

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