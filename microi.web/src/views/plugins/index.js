// 插件系统统一入口
// 导出所有插件相关的模块和工具

// 核心管理器
export { default as pluginManager } from './plugin-manager.js'
export { default as pluginConfigManager } from './plugin-config-manager.js'
export { default as pluginInitializer } from './plugin-initializer.js'

// 插件发现器
export { default as pluginDiscovery } from './plugin-discovery.js'

// 插件注册器
export { registerAllPlugins } from './plugin-registry.js'

// 插件导入器
export { importPlugin, isPluginImportable, getImportablePlugins, importPluginComponent } from './plugin-importer.js'

// 配置管理
export * from './plugin-config.js'

// 插件组件适配器
export { default as pluginComponentAdapter } from './plugin-component-adapter.js'

// 插件依赖管理
export { default as pluginDependencyManager } from './plugin-dependency-manager.js'
export { default as pluginDependencyLoader } from './plugin-dependency-loader.js'

// 插件系统状态
export function getPluginSystemStatus() {
  const pluginInitializer = require('./plugin-initializer.js').default
  return pluginInitializer.getStatus()
}

// 插件系统初始化
export async function initializePluginSystem(options = {}) {
  const pluginInitializer = require('./plugin-initializer.js').default
  return await pluginInitializer.initialize(options)
}


