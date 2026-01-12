import Vue from "vue";

/**
 * 1. 在调用的时候必须写v-
 * 2. 在使用的组件上或者div的位置必须是绝对的，在需要拖拽的最外层样式上加上 position: absolute;
 * 3. 在所需要的样式上使用 v-drag
 * 4. 激活之后的样式名为 v-drag-active 没有激活的样式名为 v-drag-inactive
 *
 * @author iTdos
 * @type {DirectiveOptions}
 */
const drag = Vue.directive("drag", {
  // 指令绑定到元素上回立刻执行bind函数，只执行一次
  bind: function (el) { },
  //inserted表示一个元素，插入到DOM中会执行inserted函数，只触发一次
  inserted: function (el) {
    let wMax = document.documentElement.clientWidth - el.offsetWidth;
    let hMax = document.documentElement.clientHeight - el.offsetHeight;

    if ("ontouchstart" in window) {
      // 移动端
      el.ontouchstart = function (e) {
        let time1 = new Date().getTime();
        let x = e.touches[0].pageX - el.offsetLeft;
        let y = e.touches[0].pageY - el.offsetTop;
        // 抑制浏览器端默认拖拽行为，移动端是拖拽屏幕，pc端无
        // e.preventDefault(); 开启后点击 子集点击事件事件会无效
        document.ontouchmove = function (e) {
          let time2 = new Date().getTime();
          if (time2 - time1 > 300) {
            el.classList.remove("v-drag-inactive");
            el.classList.add("v-drag-active");
          }
          let left = e.touches[0].pageX - x;
          let top = e.touches[0].pageY - y;

          if (left < 0) left = 0;
          else if (left > wMax) left = wMax;

          if (top < 0) top = 0;
          else if (top > hMax) top = hMax;

          el.style.left = left + "px";
          el.style.top = top + "px";
        };
        document.ontouchend = function () {
          let time2 = new Date().getTime();
          if (time2 - time1 > 300) {
            el.classList.remove("v-drag-active");
            el.classList.add("v-drag-inactive");
          }

          document.ontouchmove = document.ontouchend = null;
        };
      };
    } else {
      // pc端
      el.onmousedown = function (e) {
        let time1 = new Date().getTime();
        let x = e.pageX - el.offsetLeft;
        let y = e.pageY - el.offsetTop;
        document.onmousemove = function (e) {
          let time2 = new Date().getTime();
          if (time2 - time1 > 300) {
            el.classList.remove("v-drag-inactive");
            el.classList.add("v-drag-active");
          }
          el.style.left = e.pageX - x + "px";
          el.style.top = e.pageY - y + "px";
        };
        document.onmouseup = function () {
          let time2 = new Date().getTime();
          if (time2 - time1 > 300) {
            el.classList.remove("v-drag-active");
            el.classList.add("v-drag-inactive");
          }
          document.onmousemove = document.onmouseup = null;
        };
      };
    }
  },
  updated: function (el) { }
});
export default drag;

/*
DosCommon.Common.js
by www.itdos.com
update 2018-05-16
*/
var UA = navigator.userAgent;
var ipad = !!UA.match(/(iPad).*OS\s([\d_]+)/);
var isIphone = !!(!ipad && UA.match(/(iPhone\sOS)\s([\d_]+)/));
var isAndroid = !!UA.match(/(Android)\s+([\d.]+)/);
var isMobile = !!(isIphone || isAndroid);
// var CLICK = isMobile ? "tap" : 'click'; // 移动端触摸、PC单击 事件

var DosCommon = {
  ipad: ipad,
  isIphone: isIphone,
  isAndroid: isAndroid,
  isMobile: isMobile,
  whichTransitionEventEnd: function () {
    var t;
    var el = document.createElement("surface");
    var transitions = {
      transition: "transitionend",
      OTransition: "oTransitionEnd",
      MozTransition: "transitionend",
      WebkitTransition: "webkitTransitionEnd"
    };

    for (t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t];
      }
    }
  },
  GetFileSize($bytesize) {
    let $i = 0;
    // 当$bytesize 大于是1024字节时，开始循环，当循环到第4次时跳出；
    while (Math.abs($bytesize) >= 1024) {
      $bytesize = $bytesize / 1024;
      $i++;
      if ($i === 4) break;
    }
    // 将Bytes,KB,MB,GB,TB定义成一维数组；
    const $units = ["B", "KB", "MB", "GB", "TB"];
    const $newsize = Math.round($bytesize, 2);
    return $newsize + " " + $units[$i];
  },
  // 加法
  calcAdd: function (a, b) {
    var c, d, e;
    try {
      c = a.toString().split(".")[1].length;
    } catch (f) {
      c = 0;
    }
    try {
      d = b.toString().split(".")[1].length;
    } catch (f) {
      d = 0;
    }
    return (e = Math.pow(10, Math.max(c, d))), (DosCommon.calcMul(a, e) + DosCommon.calcMul(b, e)) / e;
  },
  CalcAdd: function (a, b) {
    return calcAdd(a, b);
  },
  // 减法
  calcSub: function (a, b) {
    var c, d, e;
    try {
      c = a.toString().split(".")[1].length;
    } catch (f) {
      c = 0;
    }
    try {
      d = b.toString().split(".")[1].length;
    } catch (f) {
      d = 0;
    }
    return (e = Math.pow(10, Math.max(c, d))), (DosCommon.calcMul(a, e) - DosCommon.calcMul(b, e)) / e;
  },
  CalcSub: function (a, b) {
    return calcSub(a, b);
  },
  // 乘法
  calcMul: function (a, b) {
    var c = 0;
    var d = a.toString();
    var e = b.toString();
    try {
      c += d.split(".")[1].length;
    } catch (f) { }
    try {
      c += e.split(".")[1].length;
    } catch (f) { }
    return (Number(d.replace(".", "")) * Number(e.replace(".", ""))) / Math.pow(10, c);
  },
  CalcMul: function (a, b) {
    return calcMul(a, b);
  },
  // 除法
  calcDiv: function (a, b) {
    var c;
    var d;
    var e = 0;
    var f = 0;
    try {
      e = a.toString().split(".")[1].length;
    } catch (g) { }
    try {
      f = b.toString().split(".")[1].length;
    } catch (g) { }
    return (c = Number(a.toString().replace(".", ""))), (d = Number(b.toString().replace(".", ""))), DosCommon.calcMul(c / d, Math.pow(10, f - e));
  },
  CalcDiv: function (a, b) {
    return calcDiv(a, b);
  },
  getUrlParam: function (name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return r[2];
    return null;
  },
  IsEmail: function (email) {
    if (!/^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(email)) {
      return false;
    }
    return true;
  },
  IsPhone: function (phone) {
    return phone.match(/^0?1[3|4|5|7|8][0-9]\d{8}$/);
  },

  IsIdNo: function (IdNum) {
    if (!/^(\d{17}[\dXx])$/.test(IdNum)) {
      return false;
    } else {
      return true;
    }
  },
  IsNull: function (str) {
    // try {
    if (str == null || str == undefined || str === "" || str === "undefined" || str === "null") {
      return true;
    }
    return false;
    // } catch (error) {
    //     return true
    // }
  },
  getBool: function (b) {
    if (DosCommon.IsNull(b)) {
      return false;
    } else {
      switch (b) {
        case true:
          return true;
        case false:
          return false;
        case "true":
          return true;
        case "false":
          return false;
        default:
          return false;
      }
    }
  },
  toJson: function (jsonStr) {
    if (DosCommon.IsNull(jsonStr)) {
      return null;
    }
    return JSON.parse(JSON.stringify(obj));
    return formatted;
  },
  toJsonStr: function (json) {
    if (typeof json !== "object") {
      json = JSON.parse(json);
    }
    var formatted = JSON.stringify(json, null, 4);
  },
  randInt: function (n, m) {
    var c = m - n + 1;
    return Math.floor(Math.random() * c + n);
  },
  DateTimeFormat: function (time, format) {
    if (DosCommon.IsNull(format)) {
      return time;
    }
    var o = {
      "M+": time.getMonth() + 1, // month
      "d+": time.getDate(), // day
      "h+": time.getHours(), // hour
      "H+": time.getHours(), // hour
      "m+": time.getMinutes(), // minute
      "s+": time.getSeconds(), // second
      "q+": Math.floor((time.getMonth() + 3) / 3), // quarter
      S: time.getMilliseconds() // millisecond
    };
    if (/(y+)/.test(format)) {
      format = format.replace(RegExp.$1, (time.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
      if (new RegExp("(" + k + ")").test(format)) {
        format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
      }
    }
    return format;
  }
};

// $.getScript = function(url, callback, cache) {
//   $.ajax({
//     type: 'GET',
//     url: url,
//     success: callback,
//     dataType: 'script',
//     ifModified: true,
//     cache: cache
//   })
// }

// jQuery.extend({
//   browser: function() {
//     var
//       rwebkit = /(webkit)\/([\w.]+)/
//     var ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/
//     var rmsie = /(msie) ([\w.]+)/
//     var rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/
//     var browser = {}
//     var ua = window.navigator.userAgent
//     var browserMatch = uaMatch(ua)

//     if (browserMatch.browser) {
//       browser[browserMatch.browser] = true
//       browser.version = browserMatch.version
//     }
//     return {
//       browser: browser
//     }
//   }
// })

function uaMatch(ua) {
  ua = ua.toLowerCase();

  var match = rwebkit.exec(ua) || ropera.exec(ua) || rmsie.exec(ua) || (ua.indexOf("compatible") < 0 && rmozilla.exec(ua)) || [];

  return {
    browser: match[1] || "",
    version: match[2] || "0"
  };
}

Array.prototype.Contains = function (obj) {
  var i = this.length;
  while (i--) {
    if (this[i] === obj) {
      return true;
    }
  }
  return false;
};
Date.prototype.Format = function (format) {
  if (DosCommon.IsNull(format)) {
    return this;
  }
  var o = {
    "M+": this.getMonth() + 1, // month
    "d+": this.getDate(), // day
    "h+": this.getHours(), // hour
    "H+": this.getHours(), // hour
    "m+": this.getMinutes(), // minute
    "s+": this.getSeconds(), // second
    "q+": Math.floor((this.getMonth() + 3) / 3), // quarter
    S: this.getMilliseconds() // millisecond
  };
  if (/(y+)/.test(format)) {
    format = format.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(format)) {
      format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
    }
  }
  return format;
};

Date.prototype.AddTime = function (strInterval, Number) {
  var dtTmp = this;
  switch (strInterval) {
    //秒
    case "s":
      return new Date(Date.parse(dtTmp) + 1000 * Number);
    //分
    case "n":
      return new Date(Date.parse(dtTmp) + 60000 * Number);
    //分
    case "m":
      return new Date(Date.parse(dtTmp) + 60000 * Number);
    //小时
    case "h":
      return new Date(Date.parse(dtTmp) + 3600000 * Number);
    //小时
    case "H":
      return new Date(Date.parse(dtTmp) + 3600000 * Number);
    //天
    case "d":
      return new Date(Date.parse(dtTmp) + 86400000 * Number);
    //周
    case "w":
      return new Date(Date.parse(dtTmp) + 86400000 * 7 * Number);
    //季
    case "q":
      return new Date(dtTmp.getFullYear(), dtTmp.getMonth() + Number * 3, dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds());
    //月
    case "M":
      return new Date(dtTmp.getFullYear(), dtTmp.getMonth() + Number, dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds());
    //年
    case "y":
      return new Date(dtTmp.getFullYear() + Number, dtTmp.getMonth(), dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds());
  }
  return null;
};

Date.prototype.DateDiff = function (interval, objDate2) {
  var d = this;
  var i = {};
  var t = d.getTime();
  var t2 = objDate2.getTime();
  i["y"] = objDate2.getFullYear() - d.getFullYear();
  i["q"] = i["y"] * 4 + Math.floor(objDate2.getMonth() / 4) - Math.floor(d.getMonth() / 4);
  i["m"] = i["y"] * 12 + objDate2.getMonth() - d.getMonth();
  i["ms"] = objDate2.getTime() - d.getTime();
  i["w"] = Math.floor((t2 + 345600000) / 604800000) - Math.floor((t + 345600000) / 604800000);
  i["d"] = Math.floor(t2 / 86400000) - Math.floor(t / 86400000);
  i["h"] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000);
  i["n"] = Math.floor(t2 / 60000) - Math.floor(t / 60000);
  i["s"] = Math.floor(t2 / 1000) - Math.floor(t / 1000);
  return i[interval];
};

//去除字符串头尾空格或指定字符
String.prototype.Trim = function (c) {
  if (c == null || c == "") {
    var str = this.replace(/^s*/, "");
    var rg = /s/;
    var i = str.length;
    while (rg.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  } else {
    var rg = new RegExp("^" + c + "*");
    var str = this.replace(rg, "");
    rg = new RegExp(c);
    var i = str.length;
    while (rg.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  }
};
//去除字符串头部空格或指定字符
String.prototype.TrimStart = function (c) {
  if (c == null || c == "") {
    var str = this.replace(/^s*/, "");
    return str;
  } else {
    var rg = new RegExp("^" + c + "*");
    var str = this.replace(rg, "");
    return str;
  }
};

//去除字符串尾部空格或指定字符
String.prototype.TrimEnd = function (c) {
  if (c == null || c == "") {
    var str = this;
    var rg = /s/;
    var i = str.length;
    while (rg.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  } else {
    var str = this;
    var rg = new RegExp(c);
    var i = str.length;
    while (rg.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  }
};

// Object.defineProperty(window, 'Dos', {
// 	configurable: false,
// 	writable: false
// });
export { DosCommon };

/* 重写resize 监听div大小变化  放到这里会报错：TypeError: h[k] is not a function。而放到index.html则不会。*/
// (function($,h,c){var a=$([]),e=$.resize=$.extend($.resize,{}),i,k="setTimeout",j="resize",d=j+"-special-event",b="delay",f="throttleWindow";e[b]=250;e[f]=true;$.event.special[j]={setup:function(){if(!e[f]&&this[k]){return false}var l=$(this);a=a.add(l);$.data(this,d,{w:l.width(),h:l.height()});if(a.length===1){g()}},teardown:function(){if(!e[f]&&this[k]){return false}var l=$(this);a=a.not(l);l.removeData(d);if(!a.length){clearTimeout(i)}},add:function(l){if(!e[f]&&this[k]){return false}var n;function m(s,o,p){var q=$(this),r=$.data(this,d);r.w=o!==c?o:q.width();r.h=p!==c?p:q.height();n.apply(this,arguments)}if($.isFunction(l)){n=l;return m}else{n=l.handler;l.handler=m}}};function g(){i=h[k](function(){a.each(function(){var n=$(this),m=n.width(),l=n.height(),o=$.data(this,d);if(m!==o.w||l!==o.h){n.trigger(j,[o.w=m,o.h=l])}});g()},e[b])}})(jQuery,this);
/* end*/

// jQuery.cookie = function(name, value, options) {
//   if (typeof value !== 'undefined') { // name and value given, set cookie
//     options = options || {}
//     if (value === null) {
//       value = ''
//       options.expires = -1
//     }
//     var expires = ''
//     if (options.expires && (typeof options.expires === 'number' || options.expires.toUTCString)) {
//       var date
//       if (typeof options.expires === 'number') {
//         date = new Date()
//         date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000))
//       } else {
//         date = options.expires
//       }
//       expires = '; expires=' + date.toUTCString() // use expires attribute, max-age is not supported by IE
//     }
//     var path = options.path ? '; path=' + options.path : ''
//     var domain = options.domain ? '; domain=' + options.domain : ''
//     var secure = options.secure ? '; secure' : ''
//     document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('')
//   } else { // only name given, get cookie
//     var cookieValue = null
//     if (document.cookie && document.cookie != '') {
//       var cookies = document.cookie.split(';')
//       for (var i = 0; i < cookies.length; i++) {
//         var cookie = jQuery.trim(cookies[i])
//         // Does this cookie string begin with the name we want?
//         if (cookie.substring(0, name.length + 1) == (name + '=')) {
//           cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
//           break
//         }
//       }
//     }
//     return cookieValue
//   }
// }
