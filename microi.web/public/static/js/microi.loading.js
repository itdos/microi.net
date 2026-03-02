var isApkEnv = !!(window.plus || navigator.userAgent.indexOf('Html5Plus') > -1);
var loadingRate = window.__microi_apk_start || 0;
var firstLoginCover = true;
var isNeedLogin = false;
var rateEl = document.getElementById('loadPercent');
var speedEl = document.getElementById('loadSpeed');
var sizeEl = document.getElementById('loadSize');
var barEl = document.getElementById('progressBar');

// 资源加载监控
var resourceMonitor = {
    totalSize: 0,
    loadedSize: 0,
    maxLoadedSize: 0,
    startTime: Date.now(),
    speeds: [],

    formatSize: function(bytes) {
        if (bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    },

    formatSpeed: function(bytesPerSec) {
        if (bytesPerSec === 0) return '0 B/s';
        var k = 1024;
        var speeds = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        var i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
        return (bytesPerSec / Math.pow(k, i)).toFixed(2) + ' ' + speeds[i];
    },

    update: function(loaded, total) {
        this.maxLoadedSize = Math.max(this.maxLoadedSize, loaded);
        this.loadedSize = this.maxLoadedSize;
        this.totalSize = Math.max(total, this.maxLoadedSize);
        var elapsed = (Date.now() - this.startTime) / 1000;
        var currentSpeed = elapsed > 0 ? this.loadedSize / elapsed : 0;
        this.speeds.push(currentSpeed);
        if (this.speeds.length > 5) this.speeds.shift();
        var avgSpeed = this.speeds.reduce(function(a, b) { return a + b; }, 0) / this.speeds.length;
        if (speedEl) {
            speedEl.textContent = '速度: ' + this.formatSpeed(avgSpeed);
        }
        if (sizeEl) {
            sizeEl.textContent = this.formatSize(this.loadedSize) + ' / ' + this.formatSize(this.totalSize);
        }
    }
};

// PerformanceObserver 监听资源加载
if (window.performance && window.PerformanceObserver) {
    var observer = new PerformanceObserver(function(list) {
        var allResources = window.performance.getEntriesByType('resource');
        var totalLoaded = 0;
        allResources.forEach(function(entry) {
            if (entry.transferSize && entry.responseEnd > 0) {
                totalLoaded += entry.transferSize;
            }
        });
        var estimatedTotal = Math.max(totalLoaded, 9 * 1024 * 1024);
        resourceMonitor.update(totalLoaded, estimatedTotal);
    });
    try {
        observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
        console.log('PerformanceObserver not supported');
    }
}

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