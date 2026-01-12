// 插件组件适配器
// 用于在选中区域中渲染插件组件

import { pluginManager, pluginConfigManager } from "./index.js";
import * as pluginRegistry from "./plugin-registry.js";

class PluginComponentAdapter {
    constructor() {
        this.registeredComponents = new Map();
    }

    /**
     * 注册插件组件
     * @param {string} pluginName 插件名称
     * @param {string} componentName 组件名称
     * @param {Object} component 组件定义
     */
    registerPluginComponent(pluginName, componentName, component) {
        const key = `${pluginName}:${componentName}`;
        this.registeredComponents.set(key, component);
        console.log(`插件组件已注册: ${key}`);
    }

    /**
     * 获取插件组件
     * @param {string} pluginName 插件名称
     * @param {string} componentName 组件名称
     * @returns {Object|null} 组件定义
     */
    getPluginComponent(pluginName, componentName) {
        const key = `${pluginName}:${componentName}`;
        return this.registeredComponents.get(key) || null;
    }

    /**
     * 检查插件组件是否存在
     * @param {string} pluginName 插件名称
     * @param {string} componentName 组件名称
     * @returns {boolean} 是否存在
     */
    hasPluginComponent(pluginName, componentName) {
        const key = `${pluginName}:${componentName}`;
        return this.registeredComponents.has(key);
    }

    /**
     * 获取所有已注册的插件组件
     * @returns {Array} 组件列表
     */
    getAllPluginComponents() {
        return Array.from(this.registeredComponents.entries()).map(([key, component]) => ({
            key,
            component,
            pluginName: key.split(":")[0],
            componentName: key.split(":")[1]
        }));
    }

    /**
     * 动态导入插件组件
     * @param {string} pluginName 插件名称
     * @param {string} componentName 组件名称
     * @returns {Promise} 组件导入Promise
     */
    async importPluginComponent(pluginName, componentName) {
        try {
            // 尝试从插件管理器获取组件
            const plugin = pluginManager.getPlugin(pluginName);
            if (plugin && plugin.components && plugin.components[componentName]) {
                return plugin.components[componentName];
            }

            // 尝试从已注册的组件中获取
            if (this.hasPluginComponent(pluginName, componentName)) {
                return this.getPluginComponent(pluginName, componentName);
            }

            // 尝试从插件注册表获取
            const pluginConfigs = pluginRegistry.pluginConfigs || {};
            if (pluginConfigs[pluginName] && pluginConfigs[pluginName].components && pluginConfigs[pluginName].components[componentName]) {
                return pluginConfigs[pluginName].components[componentName];
            }

            // 如果以上都没有找到，抛出错误
            // 注意：移除了动态 import() 以消除 webpack critical dependency 警告
            // 插件组件应该通过 pluginManager 或 pluginRegistry 预先注册
            throw new Error(`插件组件未注册: ${pluginName}:${componentName}，请确保插件已正确注册组件`);
        } catch (error) {
            console.error(`导入插件组件失败: ${pluginName}:${componentName}`, error);
            throw error;
        }
    }

    /**
     * 创建组件工厂函数
     * @param {string} pluginName 插件名称
     * @param {string} componentName 组件名称
     * @returns {Function} 组件工厂函数
     */
    createComponentFactory(pluginName, componentName) {
        return (resolve, reject) => {
            this.importPluginComponent(pluginName, componentName)
                .then((component) => {
                    resolve(component);
                })
                .catch((error) => {
                    console.error(`创建插件组件工厂失败: ${pluginName}:${componentName}`, error);
                    reject(error);
                });
        };
    }
}

// 导出单例实例
export default new PluginComponentAdapter();
