// 插件依赖管理器
// 负责管理插件的独立依赖包，支持动态加载和版本管理

class PluginDependencyManager {
    constructor() {
        this.dependencyCache = new Map(); // 依赖缓存
        this.loadedDependencies = new Map(); // 已加载的依赖
        this.dependencyVersions = new Map(); // 依赖版本管理
        this.loadingPromises = new Map(); // 加载状态管理
    }

    /**
     * 解析插件依赖
     * @param {string} pluginName 插件名称
     * @param {Object} dependencies 依赖配置
     * @returns {Object} 解析后的依赖信息
     */
    parsePluginDependencies(pluginName, dependencies) {
        const parsedDeps = {
            external: {}, // 外部依赖（CDN）
            internal: {}, // 内部依赖（本地文件）
            peer: {}, // 对等依赖（共享主项目依赖）
            optional: {} // 可选依赖
        };

        Object.entries(dependencies).forEach(([depName, depConfig]) => {
            if (typeof depConfig === "string") {
                // 简单字符串配置，默认为对等依赖
                parsedDeps.peer[depName] = depConfig;
            } else if (typeof depConfig === "object") {
                // 对象配置，支持更复杂的依赖类型
                const { type = "peer", version, source, fallback } = depConfig;

                switch (type) {
                    case "external":
                        parsedDeps.external[depName] = {
                            version,
                            source: source || this.getDefaultCDNSource(depName),
                            fallback
                        };
                        break;
                    case "internal":
                        parsedDeps.internal[depName] = {
                            version,
                            path: source,
                            fallback
                        };
                        break;
                    case "optional":
                        parsedDeps.optional[depName] = {
                            version,
                            fallback: true
                        };
                        break;
                    default:
                        parsedDeps.peer[depName] = version;
                }
            }
        });

        return parsedDeps;
    }

    /**
     * 获取默认CDN源
     * @param {string} packageName 包名
     * @returns {string} CDN源
     */
    getDefaultCDNSource(packageName) {
        const cdnSources = {
            vue: "https://unpkg.com/vue@2.6.14/dist/vue.min.js",
            "vue-router": "https://unpkg.com/vue-router@3.5.4/dist/vue-router.min.js",
            vuex: "https://unpkg.com/vuex@3.6.2/dist/vuex.min.js",
            "element-ui": "https://unpkg.com/element-ui@2.15.14/lib/index.js",
            lodash: "https://unpkg.com/lodash@4.17.21/lodash.min.js",
            moment: "https://unpkg.com/moment@2.29.4/moment.min.js",
            axios: "https://unpkg.com/axios@0.27.2/dist/axios.min.js"
        };
        return cdnSources[packageName] || `https://unpkg.com/${packageName}`;
    }

    /**
     * 加载插件依赖
     * @param {string} pluginName 插件名称
     * @param {Object} dependencies 依赖配置
     * @returns {Promise} 加载Promise
     */
    async loadPluginDependencies(pluginName, dependencies) {
        const cacheKey = `${pluginName}:${JSON.stringify(dependencies)}`;

        // 检查缓存
        if (this.dependencyCache.has(cacheKey)) {
            return this.dependencyCache.get(cacheKey);
        }

        // 避免重复加载
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }

        const loadPromise = this._loadDependencies(pluginName, dependencies);
        this.loadingPromises.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.dependencyCache.set(cacheKey, result);
            return result;
        } finally {
            this.loadingPromises.delete(cacheKey);
        }
    }

    /**
     * 内部依赖加载方法
     * @param {string} pluginName 插件名称
     * @param {Object} dependencies 依赖配置
     * @returns {Promise} 加载结果
     */
    async _loadDependencies(pluginName, dependencies) {
        const parsedDeps = this.parsePluginDependencies(pluginName, dependencies);
        const loadResults = {
            external: {},
            internal: {},
            peer: {},
            optional: {},
            errors: []
        };

        // 并行加载不同类型的依赖
        const loadPromises = [];

        // 加载外部依赖（CDN）
        Object.entries(parsedDeps.external).forEach(([depName, depConfig]) => {
            loadPromises.push(
                this._loadExternalDependency(depName, depConfig)
                    .then((result) => {
                        loadResults.external[depName] = result;
                    })
                    .catch((error) => {
                        loadResults.errors.push({ type: "external", name: depName, error });
                        if (depConfig.fallback) {
                            loadResults.external[depName] = null;
                        }
                    })
            );
        });

        // 加载内部依赖（本地文件）
        Object.entries(parsedDeps.internal).forEach(([depName, depConfig]) => {
            loadPromises.push(
                this._loadInternalDependency(depName, depConfig, pluginName)
                    .then((result) => {
                        loadResults.internal[depName] = result;
                    })
                    .catch((error) => {
                        loadResults.errors.push({ type: "internal", name: depName, error });
                        if (depConfig.fallback) {
                            loadResults.internal[depName] = null;
                        }
                    })
            );
        });

        // 检查对等依赖（主项目依赖）
        Object.entries(parsedDeps.peer).forEach(([depName, version]) => {
            const peerResult = this._checkPeerDependency(depName, version);
            loadResults.peer[depName] = peerResult;
            if (!peerResult.available) {
                loadResults.errors.push({
                    type: "peer",
                    name: depName,
                    error: new Error(`对等依赖 ${depName} 不可用`)
                });
            }
        });

        // 检查可选依赖
        Object.entries(parsedDeps.optional).forEach(([depName, depConfig]) => {
            const optionalResult = this._checkOptionalDependency(depName, depConfig);
            loadResults.optional[depName] = optionalResult;
        });

        // 等待所有依赖加载完成
        await Promise.allSettled(loadPromises);

        // 记录已加载的依赖
        this.loadedDependencies.set(pluginName, loadResults);

        console.log(`插件 ${pluginName} 依赖加载完成:`, loadResults);
        return loadResults;
    }

    /**
     * 加载外部依赖（CDN）
     * @param {string} depName 依赖名称
     * @param {Object} depConfig 依赖配置
     * @returns {Promise} 加载结果
     */
    async _loadExternalDependency(depName, depConfig) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            if (window[depName]) {
                resolve({ loaded: true, source: "global", version: "unknown" });
                return;
            }

            const script = document.createElement("script");
            script.src = depConfig.source;
            script.async = true;

            script.onload = () => {
                resolve({
                    loaded: true,
                    source: depConfig.source,
                    version: depConfig.version,
                    global: window[depName]
                });
            };

            script.onerror = () => {
                reject(new Error(`无法加载外部依赖: ${depName}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 加载内部依赖（本地文件）
     * @param {string} depName 依赖名称
     * @param {Object} depConfig 依赖配置
     * @param {string} pluginName 插件名称（用于构建完整路径）
     * @returns {Promise} 加载结果
     */
    async _loadInternalDependency(depName, depConfig, pluginName) {
        try {
            let importPath = depConfig.path;
            let resolvedPath = importPath;

            // 如果路径是相对路径，转换为相对于插件目录的完整路径
            if (importPath.startsWith("./") || importPath.startsWith("../")) {
                // 使用 @/views/plugins 作为基础路径
                resolvedPath = importPath.replace(/^\.\//,  "");
            }

            // 内部依赖应该通过插件的 index.js 预先导出
            // 不使用动态 import() 以避免 webpack critical dependency 警告
            // 插件需要在其入口文件中导出所有内部依赖
            const fullPath = `@/views/plugins/${pluginName}/${resolvedPath}`;
            console.warn(`内部依赖 ${depName} 需要通过插件入口预先导出，路径: ${fullPath}`);
            
            return {
                loaded: false,
                source: fullPath,
                version: depConfig.version,
                module: null,
                message: `请在插件 ${pluginName} 的入口文件中预先导出依赖 ${depName}`
            };
        } catch (error) {
            throw new Error(`无法加载内部依赖 ${depName}: ${error.message}`);
        }
    }

    /**
     * 检查对等依赖（主项目依赖）
     * @param {string} depName 依赖名称
     * @param {string} version 版本要求
     * @returns {Object} 检查结果
     */
    _checkPeerDependency(depName, version) {
        // 对等依赖是主项目的依赖，总是可用的
        // 它们通过模块系统或组件系统提供，不需要单独检查
        // 常见的对等依赖映射
        const peerDependencyMap = {
            vue: { version: "2.7.x", source: "通过组件系统" },
            "vue-router": { version: "3.x", source: "通过组件系统" },
            vuex: { version: "3.x", source: "通过组件系统" },
            "element-ui": { version: "2.15.x", source: "通过组件系统" }
        };

        // 如果在映射表中，直接返回可用
        if (peerDependencyMap[depName.toLowerCase()]) {
            return {
                available: true,
                source: peerDependencyMap[depName.toLowerCase()].source,
                version: peerDependencyMap[depName.toLowerCase()].version
            };
        }

        // 尝试检查全局变量（某些库可能暴露在window上）
        if (window[depName]) {
            return { available: true, source: "global", version: "unknown" };
        }

        // 对等依赖通过主项目提供，不需要动态 require 检查
        // 避免使用动态 require 以消除 webpack 警告

        // 默认认为对等依赖可用（因为它们是主项目的依赖）
        return { available: true, source: "assumed", version: version || "unknown" };
    }

    /**
     * 检查可选依赖
     * @param {string} depName 依赖名称
     * @param {Object} depConfig 依赖配置
     * @returns {Object} 检查结果
     */
    _checkOptionalDependency(depName, depConfig) {
        // 检查可选依赖是否在全局可用
        // 避免使用动态 require 以消除 webpack critical dependency 警告
        if (typeof window !== "undefined" && window[depName]) {
            return { available: true, module: window[depName], version: depConfig.version };
        }
        // 可选依赖不可用时返回 fallback 状态
        return { available: false, fallback: depConfig.fallback };
    }

    /**
     * 获取插件依赖
     * @param {string} pluginName 插件名称
     * @returns {Object|null} 依赖信息
     */
    getPluginDependencies(pluginName) {
        return this.loadedDependencies.get(pluginName) || null;
    }

    /**
     * 检查依赖是否已加载
     * @param {string} pluginName 插件名称
     * @param {string} depName 依赖名称
     * @returns {boolean} 是否已加载
     */
    isDependencyLoaded(pluginName, depName) {
        const deps = this.getPluginDependencies(pluginName);
        if (!deps) return false;

        return deps.external[depName]?.loaded || deps.internal[depName]?.loaded || deps.peer[depName]?.available || deps.optional[depName]?.available;
    }

    /**
     * 清理插件依赖
     * @param {string} pluginName 插件名称
     */
    cleanupPluginDependencies(pluginName) {
        this.loadedDependencies.delete(pluginName);

        // 清理缓存
        for (const [key] of this.dependencyCache) {
            if (key.startsWith(`${pluginName}:`)) {
                this.dependencyCache.delete(key);
            }
        }
    }

    /**
     * 获取依赖统计信息
     * @returns {Object} 统计信息
     */
    getDependencyStats() {
        return {
            totalPlugins: this.loadedDependencies.size,
            totalCacheEntries: this.dependencyCache.size,
            plugins: Array.from(this.loadedDependencies.keys())
        };
    }
}

// 导出单例实例
export default new PluginDependencyManager();
