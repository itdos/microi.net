/**
 * Element Plus 图标数据列表
 * 用于图标选择器组件
 */
import * as ElementPlusIcons from "@element-plus/icons-vue";

// 获取所有 Element Plus 图标名称
const iconNames = Object.keys(ElementPlusIcons);

// 生成图标类名列表（用于兼容旧代码）
let classList = iconNames.map(name => `element-plus-icon ${name}`);

// 生成图标对象列表
// 每个对象包含 name（图标名）和 className（Element Plus 组件名）
export const fontawesomeList = iconNames.map(name => ({
    name: name,
    className: name, // 存储 Element Plus 图标组件名，如 "Search", "Edit", "Document" 等
    componentName: name // 组件名（与 className 相同）
}));

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {Number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
    let timer;
    return function (...args) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * 模糊查询函数
 * @param {Array} list - 要查询的列表
 * @param {String} keyWord - 搜索关键词
 * @returns {Array} 匹配的结果列表
 */
export function fuzzyQuery(list, keyWord) {
    if (!keyWord) {
        return list;
    }
    let reg = new RegExp(keyWord, 'i'); // 添加 'i' 标志使其不区分大小写
    let arr = list.filter((item) => {
        return reg.test(item.name);
    });
    return arr;
}

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {Number} gapTime - 间隔时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, gapTime) {
    if (gapTime == null || gapTime == undefined) {
        gapTime = 1500;
    }

    let _lastTime = null;

    // 返回新的函数
    return function () {
        let _nowTime = +new Date();
        if (_nowTime - _lastTime > gapTime || !_lastTime) {
            fn.apply(this, arguments); //将this和参数传给原函数
            _lastTime = _nowTime;
        }
    };
}

/**
 * 列表分页函数
 * @param {Array} list - 要分页的列表
 * @param {Number} page - 当前页码（从1开始）
 * @param {Number} limit - 每页显示数量
 * @returns {Array} 当前页的数据
 */
export const listPage = (list, page = 1, limit = 10) => {
    return list.slice(limit * (page - 1), limit * page);
};
