// 插件依赖动态加载器
// 负责在运行时动态加载插件的依赖包

import pluginDependencyManager from "./plugin-dependency-manager.js";

class PluginDependencyLoader {
    constructor() {
        this.loadingQueue = new Map(); // 加载队列
        this.loadedModules = new Map(); // 已加载的模块
        this.moduleResolvers = new Map(); // 模块解析器
    }

    /**
     * 注册模块解析器
     * @param {string} moduleName 模块名称
     * @param {Function} resolver 解析器函数
     */
    registerModuleResolver(moduleName, resolver) {
        this.moduleResolvers.set(moduleName, resolver);
    }

    /**
     * 动态加载插件依赖
     * @param {string} pluginName 插件名称
     * @param {Object} pluginConfig 插件配置
     * @returns {Promise} 加载结果
     */
    async loadPluginDependencies(pluginName, pluginConfig) {
        // console.log(`开始加载插件 ${pluginName} 的依赖...`);

        // 检查插件是否有依赖配置
        if (!pluginConfig.dependencies || Object.keys(pluginConfig.dependencies).length === 0) {
            console.log(`插件 ${pluginName} 无需加载依赖`);
            return { success: true, dependencies: {} };
        }

        try {
            // 使用依赖管理器加载依赖
            const dependencyResult = await pluginDependencyManager.loadPluginDependencies(pluginName, pluginConfig.dependencies);

            // 处理加载结果
            const loadResult = await this._processDependencyResult(pluginName, dependencyResult);

            // console.log(`插件 ${pluginName} 依赖加载完成:`, loadResult);
            return loadResult;
        } catch (error) {
            console.error(`插件 ${pluginName} 依赖加载失败:`, error);
            throw error;
        }
    }

    /**
     * 处理依赖加载结果
     * @param {string} pluginName 插件名称
     * @param {Object} dependencyResult 依赖加载结果
     * @returns {Promise} 处理结果
     */
    async _processDependencyResult(pluginName, dependencyResult) {
        const processedResult = {
            success: true,
            dependencies: {},
            errors: [],
            warnings: []
        };

        // 处理外部依赖
        Object.entries(dependencyResult.external).forEach(([depName, depInfo]) => {
            if (depInfo && depInfo.loaded) {
                processedResult.dependencies[depName] = {
                    type: "external",
                    source: depInfo.source,
                    version: depInfo.version,
                    global: depInfo.global
                };
            } else {
                processedResult.errors.push(`外部依赖 ${depName} 加载失败`);
            }
        });

        // 处理内部依赖
        Object.entries(dependencyResult.internal).forEach(([depName, depInfo]) => {
            if (depInfo && depInfo.loaded) {
                processedResult.dependencies[depName] = {
                    type: "internal",
                    source: depInfo.source,
                    version: depInfo.version,
                    module: depInfo.module
                };
            } else {
                processedResult.errors.push(`内部依赖 ${depName} 加载失败`);
            }
        });

        // 处理对等依赖
        Object.entries(dependencyResult.peer).forEach(([depName, depInfo]) => {
            if (depInfo && depInfo.available) {
                processedResult.dependencies[depName] = {
                    type: "peer",
                    source: depInfo.source,
                    version: depInfo.version,
                    module: depInfo.module
                };
            } else {
                processedResult.warnings.push(`对等依赖 ${depName} 不可用: ${depInfo?.error || "未知错误"}`);
            }
        });

        // 处理可选依赖
        Object.entries(dependencyResult.optional).forEach(([depName, depInfo]) => {
            if (depInfo && depInfo.available) {
                processedResult.dependencies[depName] = {
                    type: "optional",
                    version: depInfo.version,
                    module: depInfo.module
                };
            } else if (depInfo && depInfo.fallback) {
                processedResult.warnings.push(`可选依赖 ${depName} 不可用，使用降级方案`);
            }
        });

        // 处理错误
        dependencyResult.errors.forEach((error) => {
            processedResult.errors.push(`${error.type} 依赖 ${error.name} 加载失败: ${error.error.message}`);
        });

        // 如果有严重错误，标记为失败
        if (processedResult.errors.length > 0) {
            processedResult.success = false;
        }

        return processedResult;
    }

    /**
     * 获取插件依赖模块
     * @param {string} pluginName 插件名称
     * @param {string} depName 依赖名称
     * @returns {any} 依赖模块
     */
    getPluginDependency(pluginName, depName) {
        const dependencies = pluginDependencyManager.getPluginDependencies(pluginName);
        if (!dependencies) return null;

        const depInfo = dependencies[depName];
        if (!depInfo) return null;

        switch (depInfo.type) {
            case "external": {
                // 对于 lodash，应该返回 window._ 而不是 window.lodash
                if (depName === "lodash") {
                    return window._ || window.lodash;
                }
                // 对于 moment，应该返回 window.moment
                if (depName === "moment") {
                    return window.moment;
                }
                return depInfo.global || window[depName];
            }
            case "internal":
                return depInfo.module;
            case "peer":
                return depInfo.module;
            case "optional":
                return depInfo.module;
            default:
                return null;
        }
    }

    /**
     * 检查插件依赖是否可用
     * @param {string} pluginName 插件名称
     * @param {string} depName 依赖名称
     * @returns {boolean} 是否可用
     */
    isPluginDependencyAvailable(pluginName, depName) {
        return pluginDependencyManager.isDependencyLoaded(pluginName, depName);
    }

    /**
     * 创建依赖注入器
     * @param {string} pluginName 插件名称
     * @returns {Object} 依赖注入器
     */
    createDependencyInjector(pluginName) {
        const dependencies = pluginDependencyManager.getPluginDependencies(pluginName);

        return {
            // 获取依赖
            get: (depName) => this.getPluginDependency(pluginName, depName),

            // 检查依赖是否可用
            has: (depName) => this.isPluginDependencyAvailable(pluginName, depName),

            // 获取所有依赖
            getAll: () => dependencies,

            // 依赖注入到对象
            inject: (target, depNames) => {
                depNames.forEach((depName) => {
                    const dep = this.getPluginDependency(pluginName, depName);
                    if (dep) {
                        target[depName] = dep;
                    }
                });
                return target;
            }
        };
    }

    /**
     * 清理插件依赖
     * @param {string} pluginName 插件名称
     */
    cleanupPluginDependencies(pluginName) {
        pluginDependencyManager.cleanupPluginDependencies(pluginName);
        this.loadedModules.delete(pluginName);
    }

    /**
     * 预加载常用依赖
     * @param {Array} dependencies 依赖列表
     * @returns {Promise} 预加载结果
     */
    async preloadCommonDependencies(dependencies = []) {
        const commonDeps = {
            vue: { type: "peer", version: "^2.6.0" },
            "vue-router": { type: "peer", version: "^3.0.0" },
            vuex: { type: "peer", version: "^3.0.0" },
            "element-ui": { type: "peer", version: "^2.15.0" },
            ...dependencies
        };

        console.log("开始预加载常用依赖...");

        try {
            const result = await pluginDependencyManager.loadPluginDependencies("__common__", commonDeps);

            console.log("常用依赖预加载完成:", result);
            return result;
        } catch (error) {
            console.error("常用依赖预加载失败:", error);
            throw error;
        }
    }

    /**
     * 获取加载统计信息
     * @returns {Object} 统计信息
     */
    getLoadingStats() {
        return {
            ...pluginDependencyManager.getDependencyStats(),
            loadedModules: this.loadedModules.size,
            moduleResolvers: this.moduleResolvers.size
        };
    }
}

// 导出单例实例
export default new PluginDependencyLoader();
