/**
 * WebOS 模块检测工具
 * 
 * 使用 Vite 的 import.meta.glob 在构建时探测 @/webos/ 目录是否存在。
 * 如果目录不存在（未开源 / 未安装），glob 返回空对象，不会报错。
 * 
 * 使用方法：
 *   import { hasWebOS, loadDesktop, loadAppContainer } from '@/utils/webos-detect.js';
 *   if (hasWebOS) { ... }
 */

// 探测 WebOS 关键文件
const desktopModules = import.meta.glob('@/webos/layouts/desktop.vue');
const containerModules = import.meta.glob('@/webos/layouts/app-container.vue');

/**
 * 是否安装了 WebOS 模块
 */
export const hasWebOS = Object.keys(desktopModules).length > 0;

/**
 * WebOS 桌面（全屏）布局的懒加载函数，可直接用作路由 component
 * 无 WebOS 时为 null
 */
export const loadDesktop = hasWebOS ? Object.values(desktopModules)[0] : null;

/**
 * WebOS 应用容器布局的懒加载函数（带缓存）
 * 首次调用时执行异步 import，后续调用直接返回缓存结果
 * 无 WebOS 时为 null
 */
let _containerPromise = null;
let _containerModule = null;

export const loadAppContainer = hasWebOS
    ? () => {
        if (_containerPromise) return _containerPromise;
        _containerPromise = Object.values(containerModules)[0]().then(m => {
            _containerModule = m;
            return m;
        });
        return _containerPromise;
    }
    : null;

/**
 * 同步获取已缓存的 AppContainer 模块
 * 如果尚未加载完成则返回 null
 */
export function getAppContainerSync() {
    return _containerModule;
}
