// 动态插件路由加载器
import Layout from "@/layout";
import { pluginConfigManager } from "@/views/plugins/index.js";
var pluginDebug = false;
/**
 * 动态加载插件路由
 * 遍历 @/views/plugins 目录下的所有插件，读取其路由配置
 * 只加载已启用的插件路由
 */
export function loadPluginRoutes() {
    const pluginRoutes = [];

    try {
        // 使用 require.context 动态导入所有插件
        // 匹配 plugins 目录下的所有 index.js 文件
        const pluginContext = require.context("@/views/plugins", true, /^\.\/([^/]+)\/index\.js$/);

        pluginContext.keys().forEach((pluginPath) => {
            const pluginName = pluginPath.match(/^\.\/([^/]+)\/index\.js$/)[1];

            // 检查插件是否已启用
            if (!pluginConfigManager.isPluginEnabled(pluginName)) {
                if(pluginDebug)
                    console.log(`插件 ${pluginName} 未启用，跳过路由加载`);
                return;
            }

            try {
                // 导入插件模块
                const pluginModule = pluginContext(pluginPath);

                // 检查插件是否有路由配置
                if (pluginModule.routes && Array.isArray(pluginModule.routes)) {
                    // 处理插件路由，添加插件前缀
                    const processedRoutes = pluginModule.routes.map((route) => {
                        // 为每个路由添加插件前缀
                        const processedRoute = {
                            ...route,
                            path: `/plugin/${pluginName}${route.path}`,
                            children: route.children
                                ? route.children.map((child) => ({
                                      ...child,
                                      path: `/plugin/${pluginName}${child.path}`,
                                      meta: {
                                          ...child.meta,
                                          plugin: pluginName
                                      }
                                  }))
                                : []
                        };
                        return processedRoute;
                    });

                    pluginRoutes.push(...processedRoutes);
                    if(pluginDebug)
                        console.log(`插件 ${pluginName} 路由加载成功`);
                }
            } catch (error) {
                if(pluginDebug)
                    console.warn(`加载插件 ${pluginName} 的路由配置失败:`, error);
            }
        });
    } catch (error) {
        if(pluginDebug)
            console.error("加载插件路由时发生错误:", error);
    }

    return pluginRoutes;
}
