/**
 * 浏览器兼容的路径工具函数
 * 用于替代 Node.js 的 path 模块
 */

/**
 * 类似 Node.js path.resolve 的浏览器兼容实现
 * 将路径或路径片段解析为绝对路径
 * @param  {...string} paths - 路径片段
 * @returns {string} 解析后的绝对路径
 */
export function resolve(...paths) {
    let resolvedPath = "";

    for (let i = paths.length - 1; i >= 0 && !isAbsolute(resolvedPath); i--) {
        const path = paths[i];
        if (path && typeof path === "string") {
            resolvedPath = path + (resolvedPath ? "/" + resolvedPath : "");
        }
    }

    // 规范化路径
    resolvedPath = normalizePath(resolvedPath);

    // 确保以 / 开头（对于绝对路径）
    if (resolvedPath && !resolvedPath.startsWith("/") && !resolvedPath.startsWith("http")) {
        resolvedPath = "/" + resolvedPath;
    }

    return resolvedPath || "/";
}

/**
 * 检查路径是否为绝对路径
 * @param {string} path
 * @returns {boolean}
 */
function isAbsolute(path) {
    return path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://");
}

/**
 * 规范化路径（移除多余的斜杠和处理 .. 和 .）
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
    if (!path) return "";

    // 处理 http:// 和 https:// 开头的路径
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    // 分割路径
    const parts = path.split("/").filter(Boolean);
    const result = [];

    for (const part of parts) {
        if (part === "..") {
            result.pop();
        } else if (part !== ".") {
            result.push(part);
        }
    }

    return (path.startsWith("/") ? "/" : "") + result.join("/");
}

/**
 * 获取路径的目录名
 * @param {string} path
 * @returns {string}
 */
export function dirname(path) {
    if (!path) return ".";
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return ".";
    if (lastSlash === 0) return "/";
    return path.substring(0, lastSlash);
}

/**
 * 获取路径的基础名
 * @param {string} path
 * @param {string} ext - 可选的扩展名
 * @returns {string}
 */
export function basename(path, ext) {
    if (!path) return "";
    const lastSlash = path.lastIndexOf("/");
    let base = lastSlash === -1 ? path : path.substring(lastSlash + 1);
    if (ext && base.endsWith(ext)) {
        base = base.substring(0, base.length - ext.length);
    }
    return base;
}

/**
 * 连接路径
 * @param  {...string} paths
 * @returns {string}
 */
export function join(...paths) {
    return normalizePath(paths.filter(Boolean).join("/"));
}

// 默认导出，模拟 Node.js path 模块的接口
export default {
    resolve,
    dirname,
    basename,
    join
};
