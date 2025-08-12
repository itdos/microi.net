// 插件初始化管理器
import pluginManager from './plugin-manager.js'
import pluginConfigManager from './plugin-config-manager.js'
import { initializePluginConfig } from './plugin-config.js'
import { registerAllPlugins } from './plugin-registry.js'

class PluginInitializer {
  constructor() {
    this.initialized = false
  }

  /**
   * 初始化插件系统
   * @param {Object} options 初始化选项
   * @param {Object} options.router Vue Router实例
   * @param {Object} options.store Vuex Store实例
   */
  async initialize(options = {}) {
    if (this.initialized) {
      console.log('插件系统已经初始化')
      return
    }

    try {
      console.log('开始初始化插件系统...')

      // 初始化插件配置
      initializePluginConfig()

      // 注册所有插件配置
      registerAllPlugins()

      // 设置插件管理器的依赖
      if (options.router) {
        pluginManager.setRouter(options.router)
      }
      if (options.store) {
        pluginManager.setStore(options.store)
      }

      // 初始化已启用的插件
      await this.initializeEnabledPlugins()

      this.initialized = true
      console.log('插件系统初始化完成')
    } catch (error) {
      console.error('插件系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化已启用的插件
   */
  async initializeEnabledPlugins() {
    try {
      // 从配置管理器获取已启用的插件列表
      const enabledPlugins = pluginConfigManager.getEnabledPlugins()

      console.log('已启用的插件:', enabledPlugins)

      // 注册已启用的插件
      for (const pluginName of enabledPlugins) {
        try {
          await pluginManager.registerPlugin(pluginName, { enabled: true })
          console.log(`插件 ${pluginName} 注册成功`)
        } catch (error) {
          console.error(`插件 ${pluginName} 注册失败:`, error)
          // 继续注册其他插件，不中断整个流程
        }
      }
    } catch (error) {
      console.error('初始化已启用插件失败:', error)
      throw error
    }
  }

  /**
   * 获取插件系统状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabledPlugins: pluginConfigManager.getEnabledPlugins(),
      registeredPlugins: pluginManager.getRegisteredPlugins(),
      configStats: pluginConfigManager.getConfigStats()
    }
  }

  /**
   * 重新初始化插件系统
   */
  async reinitialize() {
    this.initialized = false
    await this.initialize()
  }
}

// 导出单例实例
export default new PluginInitializer()
