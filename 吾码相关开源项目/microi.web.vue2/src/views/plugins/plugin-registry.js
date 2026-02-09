// 插件配置注册文件
// 在这里注册所有可用的插件配置

import pluginDiscovery from "./plugin-discovery.js";
import { getImportablePlugins } from "./plugin-importer.js";

// 测试插件配置
const testPluginConfig = {
    name: "test-plugin",
    displayName: "测试插件",
    description: "这是一个简单的测试插件，用于熟悉插件系统的使用流程。包含计数器、表单和列表等基本功能。",
    version: "1.0.0",
    author: "李赛赛",
    entry: "index.js",
    routes: true,
    components: true,
    store: true,
    permissions: ["test:read", "test:write"],
    features: ["计数器功能", "表单处理", "列表管理", "状态管理", "路由导航"],
    dependencies: {
        vue: "^2.6.0",
        "vue-router": "^3.0.0",
        vuex: "^3.0.0",
        "element-ui": "^2.15.0"
    }
};

// 演示插件配置
const demoPluginConfig = {
    name: "demo-plugin",
    displayName: "演示插件",
    description: "这是一个演示插件，用于展示插件系统的动态发现功能。",
    version: "1.0.0",
    author: "演示作者",
    entry: "index.js",
    routes: true,
    components: true,
    store: false,
    permissions: ["demo:read"],
    features: ["演示功能", "动态发现", "配置管理"],
    dependencies: {
        vue: "^2.6.0"
    }
};

// 依赖演示插件配置
const dependencyDemoPluginConfig = {
    name: "dependency-demo-plugin",
    displayName: "依赖管理演示",
    description: "这是一个演示插件，用于展示插件系统的独立依赖管理功能。支持外部依赖、内部依赖、对等依赖和可选依赖。",
    version: "1.0.0",
    author: "插件系统",
    entry: "index.js",
    routes: true,
    components: true,
    store: false,
    permissions: ["dependency:read", "dependency:test"],
    features: ["独立依赖管理", "CDN动态加载", "依赖注入", "降级方案", "依赖状态检查"],
    dependencies: {
        // 对等依赖 - 使用主项目的依赖
        vue: "^2.6.0",
        "vue-router": "^3.0.0",
        vuex: "^3.0.0",
        "element-ui": "^2.15.0"

        // 外部依赖 - 从CDN加载
        // lodash: {
        //     type: "external",
        //     version: "^4.17.21",
        //     source: "https://unpkg.com/lodash@4.17.21/lodash.min.js"
        // },
        // moment: {
        //     type: "external",
        //     version: "^2.29.1",
        //     source: "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js",
        //     fallback: true
        // }

        // 注释掉的依赖（如果将来需要再启用）
        // "chart-utils": {
        //   type: "internal",
        //   version: "^1.0.0",
        //   path: "./utils/chart-utils.js"
        // },
        // "echarts": {
        //   type: "optional",
        //   version: "^5.0.0",
        //   fallback: true
        // }
    }
};

// 注册所有插件配置
export function registerAllPlugins() {
    // console.log("开始注册插件配置...");

    // 获取可导入的插件列表
    const importablePlugins = getImportablePlugins();

    // 只注册有对应文件的插件
    const pluginsToRegister = [
        { name: "test-plugin", config: testPluginConfig },
        { name: "demo-plugin", config: demoPluginConfig },
        { name: "dependency-demo-plugin", config: dependencyDemoPluginConfig }
    ];

    pluginsToRegister.forEach(({ name, config }) => {
        if (importablePlugins.includes(name)) {
            pluginDiscovery.registerPluginConfig(name, config);
            // console.log(`插件配置已注册: ${name}`);

            // 自动启用插件（可选）
            // 注意：这会覆盖用户的手动设置，请谨慎使用
            // const pluginConfigManager = require('./plugin-config-manager.js').default
            // if (!pluginConfigManager.isPluginEnabled(name)) {
            //   pluginConfigManager.enablePlugin(name)
            //   console.log(`插件 ${name} 已自动启用`)
            // }
        } else {
            console.warn(`跳过插件 ${name}，因为缺少对应的导入文件`);
        }
    });

    // console.log("插件配置注册完成");
}

// 导出插件配置（用于其他模块引用）
export const pluginConfigs = {
    "test-plugin": testPluginConfig,
    "demo-plugin": demoPluginConfig,
    "dependency-demo-plugin": dependencyDemoPluginConfig
};
