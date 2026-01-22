import Vue from "vue";
import Router from "vue-router";
import pluginConfigManager from "./plugin-config-manager.js";
import pluginDiscovery from "./plugin-discovery.js";
import { importPlugin, isPluginImportable } from "./plugin-importer.js";
import pluginDependencyLoader from "./plugin-dependency-loader.js";

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.router = null;
    }

    // 设置路由实例
    setRouter(router) {
        this.router = router;
    }

    // 设置store实例
    setStore(store) {
        this.$store = store;
    }

    // 注册插件
    async registerPlugin(pluginName, pluginConfig) {
        try {
            // 检查插件是否已启用
            if (!pluginConfigManager.isPluginEnabled(pluginName)) {
                console.log(`插件 ${pluginName} 未启用，跳过注册`);
                return;
            }

            // 获取插件配置
            const pluginConfig = pluginDiscovery.getPlugin(pluginName);
            if (!pluginConfig) {
                throw new Error(`插件配置未找到: ${pluginName}`);
            }

            // 检查插件是否支持导入
            if (!isPluginImportable(pluginName)) {
                throw new Error(`插件不支持导入: ${pluginName}`);
            }

            // 加载插件依赖
            // console.log(`开始加载插件 ${pluginName} 的依赖...`);
            const dependencyResult = await pluginDependencyLoader.loadPluginDependencies(pluginName, pluginConfig);

            if (!dependencyResult.success) {
                console.warn(`插件 ${pluginName} 依赖加载有问题:`, dependencyResult.errors);
                // 依赖加载失败不阻止插件注册，但会记录警告
            }

            // 动态导入插件模块
            let pluginModule;
            try {
                pluginModule = await importPlugin(pluginName);
            } catch (importError) {
                console.error(`导入插件模块失败 ${pluginName}:`, importError);
                throw new Error(`导入插件模块失败: ${pluginName}`);
            }

            // 创建依赖注入器
            const dependencyInjector = pluginDependencyLoader.createDependencyInjector(pluginName);

            // 注册路由
            if (pluginModule.routes) {
                this.registerPluginRoutes(pluginName, pluginModule.routes);
            }

            // 注册组件
            if (pluginModule.components) {
                this.registerPluginComponents(pluginName, pluginModule.components);
            }

            // 注册Vuex模块
            if (pluginModule.store) {
                this.registerPluginStore(pluginName, pluginModule.store);
            }

            // 执行插件初始化（注入依赖）
            if (pluginModule.init) {
                try {
                    // 将依赖注入器传递给初始化函数
                    await pluginModule.init(dependencyInjector);
                } catch (initError) {
                    console.warn(`插件 ${pluginName} 初始化失败:`, initError);
                    // 初始化失败不影响插件注册
                }
            }

            // 存储插件信息（包含依赖信息）
            this.plugins.set(pluginName, {
                ...pluginConfig,
                dependencyResult,
                dependencyInjector
            });

            // console.log(`插件 ${pluginName} 注册成功`);
        } catch (error) {
            console.error(`插件 ${pluginName} 注册失败:`, error);
            throw error;
        }
    }

    // 注册插件路由
    registerPluginRoutes(pluginName, routes) {
        if (!this.router) {
            console.warn("Router not initialized");
            return;
        }

        // console.log(`注册插件路由: ${pluginName}`);
        routes.forEach((route) => {
            const pluginRoute = {
                ...route,
                path: `/plugin/${pluginName}${route.path}`,
                meta: {
                    ...route.meta,
                    plugin: pluginName
                }
            };
            // console.log(`插件路由配置: ${pluginRoute.path}`);
        });
    }

    // 注册插件组件
    registerPluginComponents(pluginName, components) {
        Object.keys(components).forEach((componentName) => {
            const fullComponentName = `${pluginName}-${componentName}`;
            Vue.component(fullComponentName, components[componentName]);
        });
    }

    // 注册插件Vuex模块
    registerPluginStore(pluginName, storeModule) {
        if (this.$store) {
            this.$store.registerModule(pluginName, storeModule);
        }
    }

    // 卸载插件
    async unregisterPlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.log(`插件 ${pluginName} 未在插件管理器中注册，跳过卸载`);
            return;
        }

        try {
            console.log(`开始卸载插件: ${pluginName}`);

            // 执行插件卸载函数
            if (plugin.dependencyInjector) {
                try {
                    // 尝试获取插件模块并执行卸载
                    const pluginModule = await importPlugin(pluginName);
                    if (pluginModule.destroy) {
                        await pluginModule.destroy(plugin.dependencyInjector);
                    }
                } catch (error) {
                    console.warn(`插件 ${pluginName} 卸载函数执行失败:`, error);
                }
            }

            // 清理插件依赖
            pluginDependencyLoader.cleanupPluginDependencies(pluginName);

            // 移除Vuex模块
            if (this.$store && this.$store.hasModule(pluginName)) {
                this.$store.unregisterModule(pluginName);
            }

            // 移除插件信息
            this.plugins.delete(pluginName);

            console.log(`插件 ${pluginName} 卸载成功`);
        } catch (error) {
            console.error(`卸载插件 ${pluginName} 时发生错误:`, error);
            throw error;
        }
    }

    // 获取已注册的插件列表
    getRegisteredPlugins() {
        return Array.from(this.plugins.keys());
    }

    // 检查插件是否已注册
    isPluginRegistered(pluginName) {
        return this.plugins.has(pluginName);
    }

    // 初始化所有已启用的插件
    async initializeEnabledPlugins() {
        const enabledPlugins = pluginConfigManager.getEnabledPlugins();

        for (const pluginName of enabledPlugins) {
            try {
                await this.registerPlugin(pluginName, { enabled: true });
            } catch (error) {
                console.error(`初始化插件 ${pluginName} 失败:`, error);
            }
        }
    }

    // 获取插件依赖信息
    getPluginDependencies(pluginName) {
        const plugin = this.plugins.get(pluginName);
        return plugin ? plugin.dependencyResult : null;
    }

    // 获取插件依赖注入器
    getPluginDependencyInjector(pluginName) {
        const plugin = this.plugins.get(pluginName);
        return plugin ? plugin.dependencyInjector : null;
    }

    // 预加载常用依赖
    async preloadCommonDependencies() {
        try {
            await pluginDependencyLoader.preloadCommonDependencies();
            console.log("常用依赖预加载完成");
        } catch (error) {
            console.error("常用依赖预加载失败:", error);
        }
    }

    // 获取依赖管理统计信息
    getDependencyStats() {
        return pluginDependencyLoader.getLoadingStats();
    }
}

export default new PluginManager();
