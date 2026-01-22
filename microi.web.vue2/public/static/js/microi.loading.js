var loadingRate = 0;
var firstLoginCover = true;
var isNeedLogin = false;
var rateEl = document.getElementById('microi_loading_progress');
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
LoadRate(20, 10);//default
LoadRate(100, 100);
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