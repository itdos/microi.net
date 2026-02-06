var loadingRate = 0;
var firstLoginCover = true;
var isNeedLogin = false;
var rateEl = document.getElementById('microi_loading_progress');
var speedEl = document.getElementById('microi_loading_speed');
var sizeEl = document.getElementById('microi_loading_size');

// 资源加载监控
var resourceMonitor = {
    totalSize: 0,
    loadedSize: 0,
    maxLoadedSize: 0, // 记录最大已加载大小，防止回退
    startTime: Date.now(),
    speeds: [], // 最近5次速度记录，用于平滑显示
    
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
        // 使用最大值，防止已加载大小回退
        this.maxLoadedSize = Math.max(this.maxLoadedSize, loaded);
        this.loadedSize = this.maxLoadedSize;
        this.totalSize = Math.max(total, this.maxLoadedSize);
        
        var elapsed = (Date.now() - this.startTime) / 1000; // 秒
        var currentSpeed = elapsed > 0 ? this.loadedSize / elapsed : 0;
        
        // 平滑速度显示（取最近5次平均值）
        this.speeds.push(currentSpeed);
        if (this.speeds.length > 5) this.speeds.shift();
        var avgSpeed = this.speeds.reduce(function(a, b) { return a + b; }, 0) / this.speeds.length;
        
        // 更新显示
        if (speedEl) {
            speedEl.innerHTML = '速度: ' + this.formatSpeed(avgSpeed);
        }
        if (sizeEl) {
            sizeEl.innerHTML = this.formatSize(this.loadedSize) + ' / ' + this.formatSize(this.totalSize);
        }
    }
};

// 监听所有资源加载
if (window.performance && window.PerformanceObserver) {
    var observer = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        
        // 获取所有已完成的资源
        var allResources = window.performance.getEntriesByType('resource');
        var totalLoaded = 0;
        
        allResources.forEach(function(entry) {
            if (entry.transferSize && entry.responseEnd > 0) {
                totalLoaded += entry.transferSize;
            }
        });
        
        // 估算总大小（实际构建后约9MB）
        var estimatedTotal = Math.max(totalLoaded, 9 * 1024 * 1024);
        resourceMonitor.update(totalLoaded, estimatedTotal);
    });
    
    try {
        observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
        console.log('PerformanceObserver not supported');
    }
}

function LoadRate(step, t) {
    //default 20%、、main.js 80%、wait 0%
    if (loadingRate < 100) {
        var tTimer = setInterval(function () {
            loadingRate = loadingRate + 1;
            rateEl.innerHTML = (loadingRate > 100 ? 100 : loadingRate) + '%';
            step--;
            if (step <= 0 || loadingRate >= 100) {
                clearInterval(tTimer);
                if (loadingRate >= 100) {
                    setTimeout(function () {
                        var loadEl = document.getElementById('microi_loading');
                        if (loadEl != null) {
                            loadEl.style.opacity = 0;
                            setTimeout(function () {
                                loadEl.remove();
                                if (isNeedLogin) {
                                    document.getElementById('divLogin').style.top = '0%';
                                }
                                firstLoginCover = false;
                            }, 30);
                        }
                    }, 10);
                }
            }
        }, t != undefined ? t : 10);
    }
}
LoadRate(20, 100);//default
LoadRate(80, 500);
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
        if (fIEVersion == 7) {
            return 7;
        } else if (fIEVersion == 8) {
            return 8;
        } else if (fIEVersion == 9) {
            return 9;
        } else if (fIEVersion == 10) {
            return 10;
        } else {
            return 6;//IE <=7
        }
    } else if (isEdge) {
        return 'edge';//edge
    } else if (isIE11) {
        return 11; //IE11  
    } else {
        return -1;//not ie
    }
}
if (IEVersion() != -1) {
    alert('请使用非IE浏览器访问本系统，国产浏览器请切换至极速模式！');
}