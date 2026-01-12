// 插件导入器
// 负责处理插件的动态导入和组件注册

import pluginComponentAdapter from "./plugin-component-adapter.js";

// 插件导入映射表
const pluginImports = {
    "test-plugin": () => import("@/views/plugins/test-plugin/index.js"),
    "demo-plugin": () => import("@/views/plugins/demo-plugin/index.js"),
    "dependency-demo-plugin": () => import("@/views/plugins/dependency-demo-plugin/index.js")
};

// 插件组件映射表
const pluginComponentImports = {
    "test-plugin": {
        TestHome: () => import("@/views/plugins/test-plugin/components/TestHome.vue"),
        TestCounter: () => import("@/views/plugins/test-plugin/components/TestCounter.vue"),
        TestForm: () => import("@/views/plugins/test-plugin/components/TestForm.vue")
    },
    "demo-plugin": {
        DemoComponent: () => import("@/views/plugins/demo-plugin/index.vue")
    },
    "dependency-demo-plugin": {
        DependencyDemo: () => import("@/views/plugins/dependency-demo-plugin/components/DependencyDemo.vue")
    }
};

/**
 * 导入插件
 * @param {string} pluginName 插件名称
 * @returns {Promise} 插件模块
 */
export async function importPlugin(pluginName) {
    if (!pluginImports[pluginName]) {
        throw new Error(`插件 ${pluginName} 不存在或未注册`);
    }

    try {
        const pluginModule = await pluginImports[pluginName]();
        console.log(`插件 ${pluginName} 导入成功`);

        // 注册插件组件到适配器
        if (pluginModule.components) {
            Object.keys(pluginModule.components).forEach((componentName) => {
                pluginComponentAdapter.registerPluginComponent(pluginName, componentName, pluginModule.components[componentName]);
            });
        }

        return pluginModule;
    } catch (error) {
        console.error(`插件 ${pluginName} 导入失败:`, error);
        throw error;
    }
}

/**
 * 导入插件组件
 * @param {string} pluginName 插件名称
 * @param {string} componentName 组件名称
 * @returns {Promise} 组件模块
 */
export async function importPluginComponent(pluginName, componentName) {
    try {
        // 首先尝试从插件组件映射表导入
        if (pluginComponentImports[pluginName] && pluginComponentImports[pluginName][componentName]) {
            const component = await pluginComponentImports[pluginName][componentName]();
            return component.default || component;
        }

        // 如果映射表中没有，尝试从插件组件适配器导入
        return await pluginComponentAdapter.importPluginComponent(pluginName, componentName);
    } catch (error) {
        console.error(`插件组件 ${pluginName}:${componentName} 导入失败:`, error);
        throw error;
    }
}

/**
 * 检查插件是否可导入
 * @param {string} pluginName 插件名称
 * @returns {boolean} 是否可导入
 */
export function isPluginImportable(pluginName) {
    return pluginImports.hasOwnProperty(pluginName);
}

/**
 * 获取可导入的插件列表
 * @returns {Array} 插件名称列表
 */
export function getImportablePlugins() {
    return Object.keys(pluginImports);
}

/**
 * 注册插件导入函数
 * @param {string} pluginName 插件名称
 * @param {Function} importFunction 导入函数
 */
export function registerPluginImport(pluginName, importFunction) {
    pluginImports[pluginName] = importFunction;
    console.log(`插件导入函数已注册: ${pluginName}`);
}

/**
 * 注册插件组件导入函数
 * @param {string} pluginName 插件名称
 * @param {string} componentName 组件名称
 * @param {Function} importFunction 导入函数
 */
export function registerPluginComponentImport(pluginName, componentName, importFunction) {
    if (!pluginComponentImports[pluginName]) {
        pluginComponentImports[pluginName] = {};
    }
    pluginComponentImports[pluginName][componentName] = importFunction;
    console.log(`插件组件导入函数已注册: ${pluginName}:${componentName}`);
}

// 导出插件组件适配器（通过 index.js 统一导出）
// export { pluginComponentAdapter }
