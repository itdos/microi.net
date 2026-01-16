// 示例插件 - 展示独立依赖管理
// 这个插件演示了如何使用新的依赖管理系统
var pluginDebug = false;
// 插件路由配置
export const routes = [
    {
        path: "/dependency-demo",
        name: "DependencyDemo",
        component: () => import("./components/DependencyDemo.vue")
    }
];

// 插件组件（用于在选中区域中渲染）
export const components = {
    DependencyDemo: () => import("./components/DependencyDemo.vue")
};

// 插件依赖配置 - 这是关键部分！
export const dependencies = {
    // 对等依赖 - 使用主项目的依赖
    vue: "^2.6.0",
    "vue-router": "^3.0.0",
    vuex: "^3.0.0",
    "element-ui": "^2.15.0",

    // 外部依赖 - 从CDN加载
    lodash: {
        type: "external",
        version: "^4.17.21",
        source: "https://unpkg.com/lodash@4.17.21/lodash.min.js"
    },
    moment: {
        type: "external",
        version: "^2.29.1",
        source: "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js",
        fallback: true // 如果加载失败，使用降级方案
    }
};

// 插件初始化函数 - 现在可以接收依赖注入器
export async function init(dependencyInjector) {
    if (pluginDebug) console.log("依赖演示插件初始化开始...");

    // 使用依赖注入器获取依赖
    const lodash = dependencyInjector.get("lodash");
    const moment = dependencyInjector.get("moment");

    // 检查依赖是否可用
    if (dependencyInjector.has("lodash")) {
        if (pluginDebug) cconsole.log("Lodash 可用:", lodash);
        // 使用 lodash 进行一些操作
        if (lodash && lodash.debounce) {
            window.debounce = lodash.debounce;
        }
    }

    if (dependencyInjector.has("moment")) {
        if (pluginDebug) cconsole.log("Moment.js 可用:", moment);
        // 使用 moment 进行日期操作
        if (moment) {
            window.moment = moment;
        }
    }

    // 将依赖注入到全局对象（可选）
    dependencyInjector.inject(window, ["lodash", "moment"]);

    if (pluginDebug) cconsole.log("依赖演示插件初始化完成");
}

// 插件卸载函数
export async function destroy(dependencyInjector) {
    if (pluginDebug) cconsole.log("依赖演示插件卸载开始...");

    // 清理全局变量
    delete window.debounce;
    delete window.moment;

    if (pluginDebug) cconsole.log("依赖演示插件卸载完成");
}
