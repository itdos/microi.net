// 插件系统配置文件
// 用于管理插件系统的默认配置和初始化设置
// 注意：具体的插件配置请参考 plugin-registry.js

/**
 * 插件系统默认配置
 */
export const pluginDefaults = {
  // 默认启用的插件列表
  defaultEnabledPlugins: [
    // 'test-plugin' // 测试插件默认启用（可选）
  ],

  // 系统配置
  system: {
    autoUpdate: true
  }
}

/**
 * 获取插件默认配置
 * @param {string} pluginName 插件名称
 * @returns {Object} 插件默认配置
 * @deprecated 插件配置已迁移到 plugin-registry.js
 */
export function getPluginDefaultConfig(pluginName) {
  console.warn('getPluginDefaultConfig 已废弃，请使用 plugin-registry.js 中的配置')
  return {}
}

/**
 * 获取系统默认配置
 * @returns {Object} 系统默认配置
 */
export function getSystemDefaultConfig() {
  return pluginDefaults.system
}

/**
 * 获取默认启用的插件列表
 * @returns {Array} 默认启用的插件列表
 */
export function getDefaultEnabledPlugins() {
  return pluginDefaults.defaultEnabledPlugins
}

/**
 * 检查插件是否默认启用
 * @param {string} pluginName 插件名称
 * @returns {boolean} 是否默认启用
 */
export function isPluginDefaultEnabled(pluginName) {
  return pluginDefaults.defaultEnabledPlugins.includes(pluginName)
}

/**
 * 初始化插件配置
 * 在系统首次启动时设置默认配置
 */
export function initializePluginConfig() {
  const configManager = require('./plugin-config-manager.js').default

  // 获取当前配置
  const currentConfig = configManager.getConfig()

  // 如果配置为空或未初始化，设置默认配置
  if (!currentConfig.enabledPlugins || currentConfig.enabledPlugins.length === 0) {
    console.log('初始化插件默认配置...')

    // 启用默认插件
    pluginDefaults.defaultEnabledPlugins.forEach(pluginName => {
      configManager.enablePlugin(pluginName)
    })

    // 插件特定配置现在由 plugin-registry.js 管理
    // 这里只处理系统级别的配置

    // 设置系统配置
    Object.keys(pluginDefaults.system).forEach(setting => {
      if (setting === 'autoUpdate') {
        configManager.setAutoUpdate(pluginDefaults.system[setting])
      }
      // 可以添加更多系统配置的处理
    })

    console.log('插件默认配置初始化完成')
  }
}
