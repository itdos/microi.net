// 日期基础函数单源：运行时启动兜底与系统设置应用种子共用，不访问 V8/数据库/网络。
function DateFormat(date, format) {
    if (date === null || date === undefined || date === '') return null;
    var value = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (isNaN(value.getTime())) return null;
    format = format || 'yyyy-MM-dd HH:mm:ss';
    var pad = function (n, width) { return (new Array(width + 1).join('0') + n).slice(-width); };
    var tokens = {
        yyyy: pad(value.getFullYear(), 4), yy: pad(value.getFullYear() % 100, 2),
        MM: pad(value.getMonth() + 1, 2), M: value.getMonth() + 1,
        dd: pad(value.getDate(), 2), d: value.getDate(),
        HH: pad(value.getHours(), 2), H: value.getHours(),
        hh: pad(value.getHours(), 2), h: value.getHours(),
        mm: pad(value.getMinutes(), 2), m: value.getMinutes(),
        ss: pad(value.getSeconds(), 2), s: value.getSeconds(),
        SSS: pad(value.getMilliseconds(), 3), q: Math.floor(value.getMonth() / 3) + 1
    };
    return String(format).replace(/yyyy|yy|MM|dd|HH|hh|mm|ss|SSS|M|d|H|h|m|s|q/g, function (token) { return tokens[token]; });
}

function DateNow(format) {
    return DateFormat(new Date(), format || 'yyyy-MM-dd HH:mm:ss');
}

function DateAdd(date, interval, number, format) {
    if (date === null || date === undefined || date === '') return null;
    var value = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    var amount = Number(number);
    if (isNaN(value.getTime()) || !isFinite(amount)) return null;
    // 月、季度、年加减按目标月末截断，避免 1 月 31 日加一个月溢出到 3 月。
    if (interval === 'M' || interval === 'q' || interval === 'y') {
        var day = value.getDate();
        value.setDate(1);
        value.setMonth(value.getMonth() + amount * (interval === 'y' ? 12 : interval === 'q' ? 3 : 1));
        var last = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
        value.setDate(Math.min(day, last));
    } else if (interval === 's') value.setSeconds(value.getSeconds() + amount);
    else if (interval === 'm' || interval === 'n') value.setMinutes(value.getMinutes() + amount);
    else if (interval === 'h' || interval === 'H') value.setHours(value.getHours() + amount);
    else if (interval === 'd' || interval === 'w') value.setDate(value.getDate() + amount * (interval === 'w' ? 7 : 1));
    else throw new Error('DateAdd 不支持的时间单位：' + interval);
    return DateFormat(value, format || 'yyyy-MM-dd HH:mm:ss');
}
