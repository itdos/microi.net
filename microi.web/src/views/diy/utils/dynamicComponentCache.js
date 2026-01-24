/**
 * 动态组件缓存池
 * 用于缓存动态加载的组件，避免重复创建导致的内存泄漏
 * 
 * 问题背景：
 * 每次调用 defineAsyncComponent(() => import(...)) 都会创建新的组件定义
 * 当组件被频繁创建和销毁时（如打开/关闭抽屉），这些定义不会被垃圾回收
 * 导致内存持续增长
 * 
 * 解决方案：
 * 使用全局缓存池，相同路径的组件只创建一次
 * 使用 import.meta.glob 预加载所有 vue 组件模块
 */
import { defineAsyncComponent, markRaw } from 'vue';

// 使用 import.meta.glob 预加载所有 views 下的 .vue 组件
// 这是 Vite 推荐的动态导入方式，必须在模块顶层使用静态字符串
const viewModules = import.meta.glob('/src/views/**/*.vue');

const DynamicComponentCache = {
    _cache: new Map(),
    _modules: viewModules,
    
    /**
     * 标准化组件路径
     * @param {string} path - 原始路径
     * @returns {string} - 标准化后的路径
     */
    _normalizePath(path) {
        if (!path) return '';
        
        // 移除开头的 @/ 或 /views 等前缀
        let normalized = path
            .replace(/^@\/views/, '')
            .replace(/^@\//, '')
            .replace(/^\/views/, '')
            .replace(/^views/, '');
        
        // 确保路径以 / 开头
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        
        // 确保路径以 .vue 结尾
        if (!normalized.endsWith('.vue')) {
            normalized = normalized + '.vue';
        }
        
        return normalized;
    },
    
    /**
     * 根据路径查找模块加载器
     * @param {string} path - 组件路径
     * @returns {Function|null} - 模块加载函数
     */
    _findModuleLoader(path) {
        const normalized = this._normalizePath(path);
        
        // 构建可能的完整路径
        const possiblePaths = [
            `/src/views${normalized}`,
            `/src/views${normalized.replace('.vue', '')}/index.vue`,
        ];
        
        for (const fullPath of possiblePaths) {
            if (this._modules[fullPath]) {
                return this._modules[fullPath];
            }
        }
        
        // 尝试模糊匹配（处理路径变体）
        const fileName = normalized.split('/').pop();
        for (const [modulePath, loader] of Object.entries(this._modules)) {
            if (modulePath.endsWith(normalized) || modulePath.endsWith('/' + fileName)) {
                return loader;
            }
        }
        
        return null;
    },
    
    /**
     * 获取或创建缓存的组件
     * @param {string} name - 组件名称
     * @param {string} path - 组件路径（相对于 @/views）
     * @param {Object} customComponent - 自定义组件对象（可选）
     * @returns {Object} - 组件定义
     */
    getOrCreate(name, path, customComponent = null) {
        // 使用名称+路径作为缓存键，确保唯一性
        const cacheKey = `${name}:${path}`;
        
        // 如果已缓存，直接返回
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }
        
        let component;
        if (customComponent) {
            // 使用传入的自定义组件
            component = markRaw(customComponent);
        } else {
            // 使用 import.meta.glob 预加载的模块
            const moduleLoader = this._findModuleLoader(path);
            
            if (moduleLoader) {
                component = defineAsyncComponent({
                    loader: moduleLoader,
                    loadingComponent: null,
                    errorComponent: null,
                    delay: 0,
                    timeout: 30000,
                    onError(error, retry, fail) {
                        console.error(`[DynamicComponentCache] 加载组件失败: ${path}`, error);
                        fail();
                    }
                });
            } else {
                console.warn(`[DynamicComponentCache] 未找到组件: ${path}`);
                // 返回一个空组件占位符，避免渲染错误
                component = defineAsyncComponent({
                    loader: () => Promise.resolve({ 
                        template: `<div class="component-not-found">组件未找到: ${path}</div>` 
                    })
                });
            }
        }
        
        // 缓存组件
        this._cache.set(cacheKey, component);
        console.log(`[DynamicComponentCache] 缓存组件: ${name}, 路径: ${path}, 缓存大小: ${this._cache.size}`);
        
        return component;
    },
    
    /**
     * 检查组件是否已缓存
     * @param {string} name - 组件名称
     * @param {string} path - 组件路径
     */
    has(name, path) {
        const cacheKey = `${name}:${path}`;
        return this._cache.has(cacheKey);
    },
    
    /**
     * 获取缓存大小
     */
    get size() {
        return this._cache.size;
    },
    
    /**
     * 清理缓存（一般不需要调用，除非需要重新加载组件）
     */
    clear() {
        this._cache.clear();
    },
    
    /**
     * 获取所有可用的模块路径（用于调试）
     * @param {string} filter - 可选的过滤字符串
     * @returns {string[]} - 匹配的模块路径列表
     */
    getAvailableModules(filter = '') {
        const paths = Object.keys(this._modules);
        if (filter) {
            return paths.filter(p => p.toLowerCase().includes(filter.toLowerCase()));
        }
        return paths;
    }
};

// 将缓存池挂载到 window 以便调试
if (typeof window !== 'undefined') {
    window.__DynamicComponentCache = DynamicComponentCache;
}

export default DynamicComponentCache;
